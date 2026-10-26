"""LSTM global (PyTorch): ventana de semanas por plato, una capa LSTM, dropout y capa densa.

Variables por paso de la ventana: unidades y precio (escalados a [0, 1] con mínimos y máximos
calculados SOLO en entrenamiento) y seno/coseno de la semana ISO. El plato y la categoría entran
como one-hot a la capa densa. Predice las unidades de la semana t con las semanas t-V..t-1.
"""
import itertools
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

from ..csvio import escribir_clave_valor, leer_clave_valor
from ..evaluacion import mae

SEMILLA = 42
MAX_EPOCAS = 200
PACIENCIA = 15
LOTE = 64
GRILLA = {"ventana": [4, 8, 12], "unidades": [16, 32, 64], "dropout": [0.0, 0.2, 0.4]}
VENTANA_BASE, UNIDADES_BASE = 8, 32  # configuración de referencia de la tesis


def fijar_semilla():
    torch.manual_seed(SEMILLA)
    np.random.seed(SEMILLA)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)


class Escalador:
    """Mínimo y máximo de entrenamiento para unidades y precio."""

    def __init__(self, tr):
        self.umax = float(tr["unidades"].max())
        self.pmin, self.pmax = float(tr["precio"].min()), float(tr["precio"].max())

    def unidades(self, x):
        return np.asarray(x, float) / self.umax

    def precio(self, x):
        return (np.asarray(x, float) - self.pmin) / (self.pmax - self.pmin)

    def a_dict(self):
        return {"umax": self.umax, "pmin": self.pmin, "pmax": self.pmax}


class Red(nn.Module):
    def __init__(self, n_est, unidades, dropout):
        super().__init__()
        self.lstm = nn.LSTM(4, unidades, batch_first=True)
        self.drop = nn.Dropout(dropout)
        self.salida = nn.Linear(unidades + n_est, 1)

    def forward(self, seq, est):
        _, (h, _) = self.lstm(seq)
        return self.salida(torch.cat([self.drop(h[-1]), est], dim=1)).squeeze(1)


def ventanas(var, esc, platos, cats, ventana, semanas_objetivo=None):
    """Arma (secuencias, estáticas, y, filas) para cada fila objetivo con `ventana` semanas previas."""
    S, E, Y, F = [], [], [], []
    for plato, g in var[var.plato.isin(platos)].groupby("plato"):
        g = g.sort_values("semana").reset_index(drop=True)
        paso = np.column_stack([esc.unidades(g["unidades"]), esc.precio(g["precio"]), g["sem_sin"], g["sem_cos"]])
        est = np.array([plato == p for p in platos] + [g["categoria"].iloc[0] == c for c in cats], float)
        for t in range(ventana, len(g)):
            if semanas_objetivo is not None and g["semana"].iloc[t] not in semanas_objetivo:
                continue
            S.append(paso[t - ventana:t]); E.append(est)
            Y.append(g["unidades"].iloc[t] / esc.umax); F.append((plato, g["semana"].iloc[t]))
    return (torch.tensor(np.array(S), dtype=torch.float32), torch.tensor(np.array(E), dtype=torch.float32),
            torch.tensor(np.array(Y), dtype=torch.float32), F)


def _entrenar(red, tr, va=None, epocas=None):
    """Adam + MSE. Con `va`, parada temprana (devuelve la mejor época); con `epocas`, ajuste fijo."""
    opt = torch.optim.Adam(red.parameters(), lr=1e-3)
    S, E, Y = tr
    gen = torch.Generator().manual_seed(SEMILLA)
    mejor, mejor_ep, sin_mejora, estado = np.inf, 0, 0, None
    for ep in range(1, (epocas or MAX_EPOCAS) + 1):
        red.train()
        for idx in torch.randperm(len(Y), generator=gen).split(LOTE):
            opt.zero_grad()
            nn.functional.mse_loss(red(S[idx], E[idx]), Y[idx]).backward()
            opt.step()
        if va is not None:
            red.eval()
            with torch.no_grad():
                perd = float(nn.functional.mse_loss(red(va[0], va[1]), va[2]))
            if perd < mejor - 1e-9:
                mejor, mejor_ep, sin_mejora = perd, ep, 0
                estado = {k: v.clone() for k, v in red.state_dict().items()}
            else:
                sin_mejora += 1
                if sin_mejora >= PACIENCIA:
                    break
    if estado is not None:
        red.load_state_dict(estado)
    return mejor_ep or epocas


def predecir(red, S, E, esc):
    red.eval()
    with torch.no_grad():
        return np.clip(red(S, E).numpy() * esc.umax, 0, None)


def buscar_y_evaluar(var, platos, cats, salida: Path, reusar=False):
    """Búsqueda en validación; reentrena con entrenamiento+validación y devuelve predicciones.

    Devuelve dict con config, predicciones alineadas por (plato, semana) y los pasos para exportar.
    """
    esc = Escalador(var[(var.conjunto == "entrenamiento") & var.plato.isin(platos) & (var.idx_semana >= 4)])
    sem = {c: set(var.loc[var.conjunto == c, "semana"]) for c in ("entrenamiento", "validacion", "prueba")}
    res = []
    if reusar and (salida / "config.csv").exists():
        # Repite solo el ajuste con la configuración ya elegida (misma semilla: mismos resultados), sin la grilla
        c = leer_clave_valor(salida / "config.csv")
        mejor = {k: c[k] for k in ("ventana", "unidades", "dropout", "epocas", "mae_val")}
        res = [mejor]
    grilla = [] if res else itertools.product(*GRILLA.values())
    for v, u, d in grilla:
        fijar_semilla()
        tr = ventanas(var, esc, platos, cats, v, sem["entrenamiento"])
        va = ventanas(var, esc, platos, cats, v, sem["validacion"])
        red = Red(tr[1].shape[1], u, d)
        ep = _entrenar(red, tr[:3], va[:3])
        mae_val = mae(va[2].numpy() * esc.umax, predecir(red, va[0], va[1], esc))
        res.append({"ventana": v, "unidades": u, "dropout": d, "epocas": int(ep), "mae_val": mae_val})
        print("LSTM", res[-1], flush=True)
    mejor = min(res, key=lambda r: r["mae_val"])
    v, u, d, ep = mejor["ventana"], mejor["unidades"], mejor["dropout"], mejor["epocas"]
    # Predicciones de validación: modelo ajustado solo con entrenamiento (como XGBoost)
    fijar_semilla()
    tr = ventanas(var, esc, platos, cats, v, sem["entrenamiento"])
    va = ventanas(var, esc, platos, cats, v, sem["validacion"])
    red_val = Red(tr[1].shape[1], u, d)
    _entrenar(red_val, tr[:3], va[:3])
    pred_val = dict(zip(va[3], predecir(red_val, va[0], va[1], esc)))
    # Modelo final: entrenamiento + validación, nº de épocas encontrado; prueba una sola vez
    fijar_semilla()
    tv = ventanas(var, esc, platos, cats, v, sem["entrenamiento"] | sem["validacion"])
    te = ventanas(var, esc, platos, cats, v, sem["prueba"])
    red = Red(tv[1].shape[1], u, d)
    _entrenar(red, tv[:3], None, epocas=ep)
    pred_te = dict(zip(te[3], predecir(red, te[0], te[1], esc)))
    salida.mkdir(parents=True, exist_ok=True)
    torch.save(red.state_dict(), salida / "lstm.pt")
    escribir_clave_valor(salida / "config.csv", {**mejor, **esc.a_dict()})
    return {"config": mejor, "busqueda": res, "val": pred_val, "prueba": pred_te}


def proyectar_siguiente(var, platos_proy, directorio: Path, platos, cats):
    """Predicción de la semana siguiente al último dato con el modelo guardado (para exportar.py)."""
    c = leer_clave_valor(directorio / "config.csv")
    esc = Escalador.__new__(Escalador)
    esc.umax, esc.pmin, esc.pmax = c["umax"], c["pmin"], c["pmax"]
    red = Red(len(platos) + len(cats), c["unidades"], c["dropout"])
    red.load_state_dict(torch.load(directorio / "lstm.pt"))
    out = {}
    for plato in platos_proy:
        g = var[var.plato == plato].sort_values("semana").tail(c["ventana"])
        paso = np.column_stack([esc.unidades(g["unidades"]), esc.precio(g["precio"]), g["sem_sin"], g["sem_cos"]])
        est = np.array([plato == p for p in platos] + [g["categoria"].iloc[0] == k for k in cats], float)
        S = torch.tensor(paso[None], dtype=torch.float32)
        E = torch.tensor(est[None], dtype=torch.float32)
        out[plato] = float(predecir(red, S, E, esc)[0])
    return out
