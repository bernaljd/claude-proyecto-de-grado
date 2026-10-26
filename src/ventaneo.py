"""Ventaneo (ventana deslizante): convierte la serie semanal en un dataset supervisado.

Para cada plato y cada semana objetivo t, la fila contiene las V semanas previas (t-V ... t-1) como entradas
y las unidades de t como salida. Es el formato que consumen los modelos de ML (XGBoost y LSTM).

   Semana | Plato | Ventas(u)         ventana V = 3 sobre un plato:
   1      | 1     | 20                fila objetivo t=4: x_1=20 (sem 1), x_2=25 (sem 2), x_3=5 (sem 3), y=20 (sem 4)
   2      | 1     | 25                fila objetivo t=5: x_1=25 (sem 2), x_2=5  (sem 3), x_3=20 (sem 4), y=30 (sem 5)
   3      | 1     | 5                 ...
"""
import pandas as pd


def ventanear(serie: pd.DataFrame, ventana: int, platos=None) -> pd.DataFrame:
    """serie: columnas plato, semana, unidades. Devuelve una fila por (plato, semana objetivo)."""
    filas = []
    for plato, g in serie.sort_values(["plato", "semana"]).groupby("plato"):
        if platos is not None and plato not in platos:
            continue
        u = g["unidades"].to_numpy()
        sem = g["semana"].to_numpy()
        for t in range(ventana, len(u)):
            fila = {"plato": plato, "semana": sem[t], "y": int(u[t])}
            fila.update({f"x_{k + 1}": int(u[t - ventana + k]) for k in range(ventana)})  # x_V = semana t-1
            filas.append(fila)
    return pd.DataFrame(filas)


def ventanear_variables(var: pd.DataFrame, platos, ventana: int, semanas_objetivo=None) -> pd.DataFrame:
    """Ventaneo con las MISMAS entradas por paso que la LSTM: unidades, precio y seno/coseno de la semana.

    Columnas: x_k (unidades), p_k (precio), ss_k / sc_k (seno / coseno de la semana ISO), con k = 1..V;
    k = V es la semana t-1. Más plato, categoria, conjunto y unidades (objetivo, semana t).
    """
    filas = []
    for plato, g in var[var.plato.isin(platos)].groupby("plato"):
        g = g.sort_values("semana").reset_index(drop=True)
        u, pr = g["unidades"].to_numpy(), g["precio"].to_numpy()
        ss, sc = g["sem_sin"].to_numpy(), g["sem_cos"].to_numpy()
        for t in range(ventana, len(g)):
            if semanas_objetivo is not None and g["semana"].iloc[t] not in semanas_objetivo:
                continue
            f = {"plato": plato, "categoria": g["categoria"].iloc[0], "semana": g["semana"].iloc[t],
                 "conjunto": g["conjunto"].iloc[t], "unidades": int(u[t])}
            for k in range(ventana):
                j = t - ventana + k
                f[f"x_{k + 1}"], f[f"p_{k + 1}"], f[f"ss_{k + 1}"], f[f"sc_{k + 1}"] = u[j], pr[j], ss[j], sc[j]
            filas.append(f)
    return pd.DataFrame(filas)


def columnas_ventana(ventana: int) -> list[str]:
    return [f"{c}_{k}" for k in range(1, ventana + 1) for c in ("x", "p", "ss", "sc")]
