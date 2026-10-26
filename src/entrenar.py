"""Entrenamiento y evaluación (CRISP-DM fases 4-5). Uso: python -m src.entrenar"""
import json
import os
import platform
import sys
from importlib.metadata import version
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

from .evaluacion import metricas
from .modelos import lstm as lm
from .modelos import xgboost_modelo as xm
from .modelos.base import predecir_base
from .pipeline import ejecutar
from .preparacion import COLUMNAS_BASE, matriz_modelo

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RES = Path("results")
MOD = Path("models")


def coma(x, dec=3):
    return f"{x:.{dec}f}".replace(".", ",")


def datos_modelo():
    validos, serie, estados, var = ejecutar()  # escribe data/processed/
    modelables = sorted(estados[estados == "modelable"].index)
    cats = sorted(var.loc[var.plato.isin(modelables), "categoria"].unique())
    X = matriz_modelo(var[var.plato.isin(modelables)], modelables, cats)
    columnas = COLUMNAS_BASE + [f"plato_{p}" for p in modelables] + [f"cat_{c}" for c in cats]
    X = X[X["idx_semana"] >= 4].reset_index(drop=True)  # sin rezagos completos: se excluyen
    return validos, serie, estados, X, columnas, modelables, cats, var


def evaluar(df, pred):
    """Métricas por plato-semana y de la demanda total semanal."""
    pl = metricas(df["unidades"], pred)
    tot = df.assign(pred=pred).groupby("semana")[["unidades", "pred"]].sum()
    return {"por_plato": pl, "total_semanal": metricas(tot["unidades"], tot["pred"])}


def main():
    RES.mkdir(exist_ok=True)
    MOD.mkdir(exist_ok=True)
    validos, serie, estados, X, cols, modelables, cats, var = datos_modelo()
    tr = X[X.conjunto == "entrenamiento"]
    va = X[X.conjunto == "validacion"]
    te = X[X.conjunto == "prueba"]
    tv = X[X.conjunto != "prueba"]
    print(f"Entrenamiento: {len(tr)} filas (tras quitar 4 semanas sin rezagos x {len(modelables)} platos)")

    # XGBoost con ventaneo: se elige la ventana (4, 8 o 12) junto con los hiperparámetros, en validación,
    # con las mismas entradas por paso que la LSTM (unidades, precio, seno y coseno de la semana).
    res, mejor = [], None
    for v in xm.VENTANAS:
        Xw, cw = xm.matriz_ventana(var, modelables, cats, v)
        trw, vaw = Xw[Xw.conjunto == "entrenamiento"], Xw[Xw.conjunto == "validacion"]
        p_v, n_v, r_v = xm.buscar(trw[cw], trw["unidades"], vaw[cw], vaw["unidades"])
        for r in r_v:
            r["ventana"] = v
        res += r_v
        mae_v = min(r["mae_val"] for r in r_v)
        print(f"XGBoost ventana {v}: MAE validación {mae_v:.4f}", flush=True)
        if mejor is None or mae_v < mejor["mae"]:
            mejor = {"mae": mae_v, "v": v, "params": p_v, "n": n_v, "Xw": Xw, "cols": cw}
    params, n_arb, v_xgb = mejor["params"], mejor["n"], mejor["v"]
    Xw, cw = mejor["Xw"], mejor["cols"]
    trw, vaw, tew = (Xw[Xw.conjunto == c] for c in ("entrenamiento", "validacion", "prueba"))
    tvw = Xw[Xw.conjunto != "prueba"]
    print("Mejor XGBoost:", v_xgb, params, n_arb)
    pd.DataFrame(res).sort_values("mae_val").to_csv(RES / "busqueda_xgb.csv", index=False)

    m_val = xm.ajustar(params, n_arb, trw[cw], trw["unidades"])       # solo entrenamiento
    m_fin = xm.ajustar(params, n_arb, tvw[cw], tvw["unidades"])       # entrenamiento + validación
    clip = lambda a: np.clip(a, 0, None)
    alinear = lambda df, d: np.array([d[(p, s)] for p, s in zip(df.plato, df.semana)])
    llave = lambda w, pr: dict(zip(zip(w.plato, w.semana), pr))
    preds = {
        "Modelo base (mm4)": {"validacion": predecir_base(va), "prueba": predecir_base(te)},
        "XGBoost": {"validacion": alinear(va, llave(vaw, clip(m_val.predict(vaw[cw])))),
                    "prueba": alinear(te, llave(tew, clip(m_fin.predict(tew[cw]))))},
    }
    # LSTM (fase E): ajuste en validación; mismas filas de evaluación que los otros modelos
    reusar = os.environ.get("REUSAR_LSTM") == "1"  # evita repetir la grilla de 27 configuraciones (≈25 min)
    ls = lm.buscar_y_evaluar(var, modelables, cats, MOD / "lstm", reusar)
    if not reusar:
        pd.DataFrame(ls["busqueda"]).sort_values("mae_val").to_csv(RES / "busqueda_lstm.csv", index=False)
    preds["LSTM"] = {"validacion": alinear(va, ls["val"]), "prueba": alinear(te, ls["prueba"])}
    sets = {"validacion": va, "prueba": te}
    metr = {m: {c: evaluar(sets[c], p[c]) for c in sets} for m, p in preds.items()}

    filas = [{"modelo": m, "conjunto": c, "nivel": n, "metrica": k, "valor": v}
             for m, d in metr.items() for c, dd in d.items() for n, mm in dd.items() for k, v in mm.items()]
    pd.DataFrame(filas).to_csv(RES / "metricas.csv", index=False)
    (RES / "metricas.json").write_text(json.dumps(metr, indent=2, ensure_ascii=False))

    # Selección del modelo vigente (CA-07): menor MAE por plato en validación.
    vigente = min(metr, key=lambda m: metr[m]["validacion"]["por_plato"]["MAE"])
    base_ok = metr["Modelo base (mm4)"]["prueba"]
    criterio = {}
    for m in metr:  # criterio de éxito: menor error que el base en al menos 2 de 3 métricas (prueba)
        n_pl = sum(metr[m]["prueba"]["por_plato"][k] < base_ok["por_plato"][k] for k in base_ok["por_plato"])
        n_tot = sum(metr[m]["prueba"]["total_semanal"][k] < base_ok["total_semanal"][k] for k in base_ok["total_semanal"])
        criterio[m] = {"por_plato_n_de_3": int(n_pl), "total_semanal_n_de_3": int(n_tot)}
    hip = {"XGBoost": dict(params, ventana=v_xgb), "LSTM": ls["config"]}.get(vigente, {})
    (MOD / "modelo_vigente.json").write_text(json.dumps({
        "nombre": vigente, "hiperparametros": hip, "n_arboles_xgb": n_arb, "metricas": metr[vigente],
        "criterio_exito_vs_base": criterio}, indent=2, ensure_ascii=False))
    mejores = criterio["XGBoost"]["por_plato_n_de_3"]
    m_fin.save_model(MOD / "xgb.json")
    (MOD / "xgb_config.json").write_text(json.dumps({"params": params, "n_arboles": n_arb, "ventana": v_xgb}, indent=2))

    tablas(metr, params, n_arb, res, v_xgb)
    figuras(preds, sets, m_fin, cw)
    versiones()
    print(json.dumps(metr, indent=2))
    print("Vigente:", vigente, "| criterio de éxito vs base:", json.dumps(criterio))


def tablas(metr, params, n_arb, res, v_xgb=None):
    L = ["% Cuadro 7.1: métricas en el conjunto de prueba", ""]
    for m, d in metr.items():
        p, t = d["prueba"]["por_plato"], d["prueba"]["total_semanal"]
        v = [coma(p["MAE"]), coma(p["RMSE"]), coma(p["SMAPE"], 2), coma(t["MAE"]), coma(t["RMSE"]), coma(t["SMAPE"], 2)]
        L.append(f"{m} & " + " & ".join(v) + r" \\")
    (RES / "tabla_resultados.tex").write_text("\n".join(L) + "\n")
    explor = {"objective": "reg:squarederror, reg:tweedie", "tweedie_variance_power": "1,2; 1,5",
              "n_estimators": "hasta 1.000 (parada temprana 50)", "max_depth": "3, 4, 6",
              "learning_rate": "0,03; 0,1", "subsample": "0,8; 1,0", "colsample_bytree": "0,8; 1,0",
              "min_child_weight": "1, 5", "random_state": "42", "ventana": "4, 8, 12 semanas"}
    elegido = dict(params, n_estimators=n_arb, random_state=42, ventana=v_xgb)
    L = ["% Cuadro 6.2: configuración de XGBoost", ""]
    for k, e in explor.items():
        val = elegido.get(k, "no aplica")
        L.append(f"\\texttt{{{k.replace('_', chr(92) + '_')}}} & {e} & "
                 f"{str(val).replace('.', ',').replace('_', chr(92) + '_')} " + r"\\")
    (RES / "tabla_config_xgb.tex").write_text("\n".join(L) + "\n")


def figuras(preds, sets, modelo, cols):
    fig, ax = plt.subplots(figsize=(10, 4.5))
    real = pd.concat([d.groupby("semana")["unidades"].sum() for d in sets.values()])
    ax.plot(real.index, real.values, "k-", lw=2, label="Real")
    for m, p in preds.items():
        s = pd.concat([sets[c].assign(pred=p[c]).groupby("semana")["pred"].sum() for c in sets])
        ax.plot(s.index, s.values, "--", label=m)
    ax.axvline(pd.Timestamp("2025-07-07"), color="gray", ls=":")
    ax.set(title="Demanda total semanal: real y proyectada (validación y prueba)",
           xlabel="Semana", ylabel="Unidades por semana")
    ax.legend(); fig.tight_layout(); fig.savefig(RES / "fig_real_vs_pred_total.png", dpi=150); plt.close(fig)

    fig, axs = plt.subplots(3, 1, figsize=(10, 9), sharex=True)
    for ax, plato in zip(axs, ["Efo Riro", "Moi Moi – Beans Pudding", "Meat Pie"]):
        for c, d in sets.items():
            pass
        d = pd.concat(sets.values())
        pl = d[d.plato.str.lower().str.replace("-", "–") == plato.lower()]
        if pl.empty:
            ax.set_title(f"{plato}: no encontrado"); continue
        ax.plot(pl.semana, pl.unidades, "k-", label="Real")
        for m, p in preds.items():
            pr = pd.concat([sets[c].assign(pred=p[c]) for c in sets])
            pr = pr[pr.plato == pl.plato.iloc[0]]
            ax.plot(pr.semana, pr.pred, "--", label=m)
        ax.set(title=f"{plato}", ylabel="Unidades"); ax.legend()
    axs[-1].set_xlabel("Semana"); fig.tight_layout()
    fig.savefig(RES / "fig_real_vs_pred_platos.png", dpi=150); plt.close(fig)

    imp = pd.Series(modelo.get_booster().get_score(importance_type="gain")).sort_values().tail(15)
    imp.index = [i.replace("plato_", "Plato: ").replace("cat_", "Categoría: ") for i in imp.index]
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.barh(imp.index, imp.values)
    ax.set(title="Importancia de variables en XGBoost (ganancia)", xlabel="Ganancia promedio")
    fig.tight_layout(); fig.savefig(RES / "fig_importancia_xgb.png", dpi=150); plt.close(fig)
    pd.Series(modelo.get_booster().get_score(importance_type="gain")).sort_values(ascending=False)\
        .to_csv(RES / "importancia_xgb.csv", header=["ganancia"])


def versiones():
    libs = ["pandas", "numpy", "xgboost", "scikit-learn", "matplotlib", "pyarrow", "torch", "pytest"]
    t = [f"Python {platform.python_version()} ({sys.platform})"] + [f"{l}=={version(l)}" for l in libs]
    (RES / "versions.txt").write_text("\n".join(t) + "\n")
    (Path("requirements.txt")).write_text("\n".join(t[1:]) + "\n")


if __name__ == "__main__":
    main()
