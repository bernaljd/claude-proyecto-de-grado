"""Exporta las tablas CSV que consume el dashboard (web/public/data/). Uso: python -m src.exportar"""
from pathlib import Path

import numpy as np
import pandas as pd

from .csvio import escribir_clave_valor, leer_clave_valor
from .entrenar import datos_modelo
from .ingenieria_menu import ACCIONES, agregar_periodo, alertas, clasificar
from .modelos import lstm as lm
from .modelos import xgboost_modelo as xm
from .proyeccion_diaria import DIAS, mayor_residuo, participaciones, pesos_plato

OUT = Path("web/public/data")
FIXT = Path("web/src/lib/__fixtures__")
SEMANAS_PERIODO = 12
ABREV = ["lun", "mar", "mie", "jue", "vie", "sab"]


def redondear(x: float) -> int:
    """Redondeo half-up (igual que Math.floor(x + 0.5) en TypeScript)."""
    return int(np.floor(max(x, 0.0) + 0.5))


def csv(nombre, df, carpeta=OUT):
    carpeta.mkdir(parents=True, exist_ok=True)
    df.to_csv(carpeta / nombre, index=False)


def fila_media(g: pd.DataFrame) -> dict:
    """Media móvil de 4 semanas (modelo base) con la información hasta la última semana."""
    return {"mm4": float(np.mean(g["unidades"].to_numpy()[-4:]))}


def fila_ventana(var: pd.DataFrame, plato: str, ventana: int) -> dict:
    """Entradas de la semana siguiente: las últimas V semanas (x_k, p_k, ss_k, sc_k), k = V es la última semana."""
    g = var[var.plato == plato].sort_values("semana").tail(ventana)
    f = {}
    for k, (u, p, ss, sc) in enumerate(zip(g["unidades"], g["precio"], g["sem_sin"], g["sem_cos"]), 1):
        f[f"x_{k}"], f[f"p_{k}"], f[f"ss_{k}"], f[f"sc_{k}"] = float(u), float(p), float(ss), float(sc)
    return f


def tabla_arboles(booster) -> pd.DataFrame:
    """Un renglón por nodo: si variable < umbral va a `si`, si no a `no`, y si falta a `faltante`."""
    d = booster.trees_to_dataframe()
    nodo = lambda s: s.map(lambda v: int(str(v).split("-")[1]) if isinstance(v, str) else np.nan)
    hoja = d["Feature"] == "Leaf"
    return pd.DataFrame({
        "arbol": d["Tree"], "nodo": d["Node"], "variable": np.where(hoja, "", d["Feature"]),
        "umbral": np.where(hoja, np.nan, d["Split"]), "si": nodo(d["Yes"]), "no": nodo(d["No"]),
        "faltante": nodo(d["Missing"]), "valor_hoja": np.where(hoja, d["Gain"], np.nan)})


def main():
    validos, serie, estados, X, _, modelables, cats, var = datos_modelo()
    vigente = leer_clave_valor("models/modelo_vigente.csv")
    cfg = leer_clave_valor("models/xgb_config.csv")
    nombre_vig = vigente["nombre"]
    es_base = nombre_vig.startswith("Modelo base")
    V = int(cfg["ventana"])
    params = {k[6:]: v for k, v in cfg.items() if k.startswith("param_")}
    ultima = serie["semana"].max()
    siguiente = ultima + pd.Timedelta(weeks=1)
    semanas = sorted(serie["semana"].unique())
    cat_plato = serie.groupby("plato")["categoria"].first()

    # --- XGBoost ventaneado entrenado con todo el periodo (se exporta para el navegador) ---
    Xw, cw = xm.matriz_ventana(var, modelables, cats, V)
    modelo = xm.ajustar(params, int(cfg["n_arboles"]), Xw[cw], Xw["unidades"])
    booster = modelo.get_booster()
    conf = str(__import__("json").loads(booster.save_config())["learner"]["learner_model_param"]["base_score"])
    meta = {"vigente": "base" if es_base else "xgboost", "modelo_vigente": nombre_vig,
            "objetivo": params["objective"], "base_score": float(conf.strip("[]")),
            "n_arboles": int(cfg["n_arboles"]), "ventana": V, "semana_proyectada": str(siguiente.date())}
    escribir_clave_valor(OUT / "modelo_meta.csv", meta)
    csv("modelo_columnas.csv", pd.DataFrame({"orden": range(len(cw)), "columna": cw}))
    csv("modelo_platos.csv", pd.DataFrame({"plato": modelables}))
    csv("modelo_categorias.csv", pd.DataFrame({"categoria": cats}))
    csv("modelo_xgb_arboles.csv", tabla_arboles(booster))

    # --- Proyección semanal por plato ---
    proy, exactas, f_mod, f_ven, fila_fx = {}, {}, {}, {}, {}
    for plato, g in serie.groupby("plato"):
        g = g.sort_values("semana")
        est = estados[plato]
        if est == "retirado":
            continue
        f = fila_media(g)
        fila_fx[plato] = f
        if est == "historial_insuficiente":
            primera = g.loc[g["unidades"] > 0, "semana"].min()
            disp = g[g["semana"] >= primera]["unidades"].to_numpy()[-4:]
            exactas[plato] = float(np.mean(disp))
        else:
            f_mod[plato] = f
            f_ven[plato] = fila_ventana(var, plato, V)
            if es_base:
                exactas[plato] = f["mm4"]

    def pred_xgb(fs):
        M = pd.DataFrame(fs).T
        for p in modelables:
            M[f"plato_{p}"] = (M.index == p).astype(int)
        for c in cats:
            M[f"cat_{c}"] = [int(cat_plato[p] == c) for p in M.index]
        return dict(zip(M.index, np.clip(modelo.predict(M[cw].astype(float)), 0, None))), M

    pred_x, M_fx = pred_xgb(f_ven)
    if nombre_vig == "LSTM":
        exactas.update(lm.proyectar_siguiente(var, modelables, Path("models/lstm"), modelables, cats))
    elif not es_base:
        exactas.update({p: float(v) for p, v in pred_x.items()})
    proy = {p: redondear(v) for p, v in exactas.items()}
    # Lo que reproduce el navegador al recargar un archivo: base si el vigente es el base; si no, XGBoost
    if es_base:
        proy_nav = dict(proy)
    else:
        proy_nav = {p: v for p, v in proy.items() if p not in f_mod}
        proy_nav.update({p: redondear(float(v)) for p, v in pred_x.items()})

    # --- Ingeniería de menú: histórica (últimas 12 semanas) y proyectada ---
    desde, hasta = semanas[-SEMANAS_PERIODO], semanas[-1]
    h_raw = agregar_periodo(serie, desde, hasta)
    h_raw["categoria"] = h_raw["plato"].map(cat_plato)
    hist, umb_h = clasificar(h_raw)
    ult = serie[serie["unidades"] > 0].sort_values("semana").groupby("plato").tail(1).set_index("plato")
    mh = h_raw.set_index("plato")

    def clas_proy(pd_):
        p_raw = pd.DataFrame({"plato": list(pd_), "unidades": list(pd_.values())})
        p_raw["precio"] = [mh["precio"].get(p, ult.loc[p, "ingreso"] / ult.loc[p, "unidades"]) for p in p_raw.plato]
        p_raw["costo"] = [mh["costo"].get(p, ult.loc[p, "costo"] / ult.loc[p, "unidades"]) for p in p_raw.plato]
        p_raw["categoria"] = p_raw["plato"].map(cat_plato)
        return clasificar(p_raw)
    pro, umb_p = clas_proy(proy)
    pro_nav, _ = clas_proy(proy_nav)
    alts = alertas(hist, pro)

    def tabla_menu(d):
        t = d[["plato", "categoria", "unidades", "precio", "costo", "margen", "popularidad", "categoria_menu"]].copy()
        t["accion"] = t["categoria_menu"].map(ACCIONES)
        return t
    csv("menu_historica.csv", tabla_menu(hist))
    csv("menu_proyectada.csv", tabla_menu(pro))
    csv("menu_umbrales.csv", pd.DataFrame([
        {"version": "historica", **umb_h, "desde": str(desde.date()), "hasta": str(hasta.date())},
        {"version": "proyectada", **umb_p, "desde": str(siguiente.date()), "hasta": str(siguiente.date())}]))
    csv("menu_alertas.csv", pd.DataFrame(alts, columns=["plato", "historica", "proyectada", "accion"]))
    csv("menu_acciones.csv", pd.DataFrame({"categoria_menu": list(ACCIONES), "accion": list(ACCIONES.values())}))

    # --- Reparto diario y platos.csv ---
    por_plato, por_cat = participaciones(validos, cat_plato)
    filas = []
    for plato in sorted(serie["plato"].unique()):
        w = pesos_plato(plato, cat_plato[plato], por_plato, por_cat)
        u = ult.loc[plato] if plato in ult.index else None
        pr = float(mh["precio"].get(plato, u["ingreso"] / u["unidades"]))
        co = float(mh["costo"].get(plato, u["costo"] / u["unidades"]))
        rep = mayor_residuo(proy[plato], w) if plato in proy else [None] * 6
        fila = {"plato": plato, "categoria": cat_plato[plato], "estado": estados[plato],
                "proyeccion": proy.get(plato), "proyeccion_exacta": exactas.get(plato),
                "precio": pr, "costo": co, "margen": pr - co}
        fila.update({f"part_{a}": x for a, x in zip(ABREV, w)})
        fila.update({f"reparto_{a}": x for a, x in zip(ABREV, rep)})
        filas.append(fila)
    csv("platos.csv", pd.DataFrame(filas).astype({"proyeccion": "Int64"}))

    s = serie.assign(estado=serie["plato"].map(estados), semana=serie["semana"].dt.strftime("%Y-%m-%d"),
                     ingreso=serie["ingreso"].round(4), costo=serie["costo"].round(4))
    csv("serie_semanal.csv", s[["plato", "categoria", "estado", "semana", "unidades", "ingreso", "costo"]])

    # --- Ranking ---
    top5 = serie.assign(r=serie.groupby("semana")["unidades"].rank(method="min", ascending=False))
    top5 = top5[(top5["r"] <= 5) & (top5["unidades"] > 0)].groupby("plato").size()
    rk = []
    for p, g in serie.groupby("plato"):
        cv = g[g["unidades"] > 0]["unidades"]
        rk.append({"plato": p, "unidades": int(g["unidades"].sum()), "semanas_top5": int(top5.get(p, 0)),
                   "pct_semanas_con_venta": float(100 * len(cv) / len(g)),
                   "mediana_unidades_con_venta": float(cv.median()) if len(cv) else 0.0})
    rk = sorted(rk, key=lambda r: -r["unidades"])
    for i, r in enumerate(rk, 1):
        r["puesto_total"] = i
    csv("ranking.csv", pd.DataFrame(rk))

    # --- Confiabilidad (métricas de prueba del modelo vigente, tomadas de results/metricas.csv) ---
    m = pd.read_csv("results/metricas.csv")
    m = m[(m["modelo"] == nombre_vig) & (m["conjunto"] == "prueba")]
    val = {(r.nivel, r.metrica): float(r.valor) for r in m.itertuples()}
    mp, mt = {k: val[("por_plato", k)] for k in ("MAE", "RMSE", "SMAPE")}, {k: val[("total_semanal", k)] for k in ("MAE", "RMSE", "SMAPE")}
    csv("confiabilidad_metricas.csv", m[["nivel", "metrica", "valor"]])
    escribir_clave_valor(OUT / "confiabilidad.csv", {
        "modelo_vigente": nombre_vig, "rango_desde": str(semanas[0].date()), "rango_hasta": str(ultima.date()),
        "fecha_calculo": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "nota_recarga": ("Al cargar un archivo nuevo, el navegador recalcula con XGBoost; las proyecciones originales usan el modelo vigente."
                         if nombre_vig == "LSTM" else ""),
        "frase_MAE": f"En promedio, la proyección se aleja {mp['MAE']:.2f} unidades por plato y semana.",
        "frase_RMSE": f"Los errores grandes pesan más: el desvío típico es de {mp['RMSE']:.2f} unidades por plato y semana.",
        "frase_SMAPE": f"En porcentaje, el error relativo promedio por plato es de {mp['SMAPE']:.0f} %; "
                       "es alto porque la mayoría de platos vende pocas unidades por semana.",
        "frase_total": f"Para la demanda total de la semana, la proyección se aleja {mt['MAE']:.1f} unidades en promedio."})

    # --- Resumen ---
    tsem = serie.groupby("semana")["unidades"].sum()
    resumen = {"desde": str(semanas[0].date()), "hasta": str(ultima.date()), "ultima_semana": str(ultima.date()),
               "semana_proyectada": str(siguiente.date()), "unidades_ultima_semana": int(tsem.iloc[-1]),
               "unidades_semana_anterior": int(tsem.iloc[-2]), "total_proyectado": int(sum(proy.values())),
               "n_alertas": len(alts), "fecha_calculo": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M")}
    resumen.update({f"n_{c}": int(n) for c, n in hist["categoria_menu"].value_counts().items()})
    escribir_clave_valor(OUT / "resumen.csv", resumen)

    # --- Fixtures de paridad para las pruebas del navegador (CSV) ---
    muestra = Xw.sample(200, random_state=42)[cw].astype(float)
    pr = modelo.predict(muestra)
    csv("paridad_xgb.csv", muestra.assign(prediccion=pr), FIXT)
    hist_c = dict(zip(hist["plato"], hist["categoria_menu"]))
    pro_c = dict(zip(pro_nav["plato"], pro_nav["categoria_menu"]))
    filas = []
    for plato in fila_fx:
        fila = {"plato": plato, "estado": estados[plato], "proy_nav": proy_nav[plato],
                "cat_hist": hist_c.get(plato, ""), "cat_proy_nav": pro_c.get(plato, ""), "mm4": fila_fx[plato]["mm4"]}
        rep = mayor_residuo(proy_nav[plato], pesos_plato(plato, cat_plato[plato], por_plato, por_cat))
        fila.update({f"rep_{a}": x for a, x in zip(ABREV, rep)})
        fila.update({f"f_{k}": v for k, v in f_ven.get(plato, {}).items()})
        filas.append(fila)
    csv("paridad_navegador.csv", pd.DataFrame(filas), FIXT)
    print("Exportado. Proyección total:", sum(proy.values()), "| alertas:", len(alts), "| vigente:", nombre_vig)


if __name__ == "__main__":
    main()
