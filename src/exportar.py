"""Exporta los JSON que consume el dashboard. Uso: python -m src.exportar"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from .entrenar import datos_modelo
from .ingenieria_menu import ACCIONES, agregar_periodo, alertas, clasificar
from .modelos import xgboost_modelo as xm
from .preparacion import COLUMNAS_BASE
from .proyeccion_diaria import DIAS, mayor_residuo, participaciones, pesos_plato

OUT = Path("web/public/data")
FIXT = Path("web/src/lib/__fixtures__")
SEMANAS_PERIODO = 12


def redondear(x: float) -> int:
    """Redondeo half-up (igual que Math.floor(x + 0.5) en TypeScript)."""
    return int(np.floor(max(x, 0.0) + 0.5))


def dump(nombre, obj, carpeta=OUT):
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_text(json.dumps(obj, ensure_ascii=False, indent=1, default=float))


def fila_siguiente(g: pd.DataFrame, semana: pd.Timestamp) -> dict:
    """Variables de la semana siguiente al último dato, con la información hasta t-1."""
    u = g["unidades"].to_numpy()
    f = {f"lag_{k}": float(u[-k]) for k in range(1, 5)}
    f["mm4"] = float(np.mean(u[-4:]))
    w = int(semana.isocalendar().week)
    f.update(sem_sin=float(np.sin(2 * np.pi * w / 52)), sem_cos=float(np.cos(2 * np.pi * w / 52)),
             mes=int(semana.month), precio_prev=float(g["precio"].iloc[-1]))
    return f


def main():
    validos, serie, estados, X, cols, modelables, cats = datos_modelo()
    vigente = json.loads(Path("models/modelo_vigente.json").read_text())
    cfg = json.loads(Path("models/xgb_config.json").read_text())
    ultima = serie["semana"].max()
    siguiente = ultima + pd.Timedelta(weeks=1)
    semanas = sorted(serie["semana"].unique())
    cat_plato = serie.groupby("plato")["categoria"].first()

    # --- Modelo XGBoost entrenado con todo el periodo (se exporta para el navegador) ---
    modelo = xm.ajustar(cfg["params"], cfg["n_arboles"], X[cols], X["unidades"])
    OUT.mkdir(parents=True, exist_ok=True)
    modelo.get_booster().save_model(str(OUT / "modelo_xgb.json"))
    conf = json.loads(modelo.get_booster().save_config())["learner"]["learner_model_param"]
    meta = {"vigente": "xgboost" if vigente["nombre"] == "XGBoost" else "base",
            "columnas": cols, "platos": modelables, "categorias": cats,
            "objetivo": cfg["params"]["objective"], "base_score": float(str(conf["base_score"]).strip("[]")),
            "n_arboles": cfg["n_arboles"], "semana_proyectada": str(siguiente.date())}
    dump("modelo_meta.json", meta)

    # --- Proyección semanal por plato ---
    proy, filas, exactas = {}, {}, {}
    for plato, g in serie.groupby("plato"):
        g = g.sort_values("semana")
        est = estados[plato]
        if est == "retirado":
            continue
        f = fila_siguiente(g, siguiente)
        if est == "historial_insuficiente":
            primera = g.loc[g["unidades"] > 0, "semana"].min()
            disp = g[g["semana"] >= primera]["unidades"].to_numpy()[-4:]
            exactas[plato] = float(np.mean(disp)); proy[plato] = redondear(exactas[plato])
        elif meta["vigente"] == "base":
            exactas[plato] = f["mm4"]; proy[plato] = redondear(f["mm4"])
        else:
            filas[plato] = f
    if filas:
        M = pd.DataFrame(filas).T
        for p in modelables:
            M[f"plato_{p}"] = (M.index == p).astype(int)
        for c in cats:
            M[f"cat_{c}"] = [int(cat_plato[p] == c) for p in M.index]
        pred = np.clip(modelo.predict(M[cols].astype(float)), 0, None)
        exactas.update({p: float(v) for p, v in zip(M.index, pred)})
        proy.update({p: redondear(float(v)) for p, v in zip(M.index, pred)})

    # --- Ingeniería de menú: histórica (últimas 12 semanas) y proyectada ---
    desde, hasta = semanas[-SEMANAS_PERIODO], semanas[-1]
    h_raw = agregar_periodo(serie, desde, hasta)
    h_raw["categoria"] = h_raw["plato"].map(cat_plato)
    hist, umb_h = clasificar(h_raw)
    ult = serie[serie["unidades"] > 0].sort_values("semana").groupby("plato").tail(1).set_index("plato")
    p_raw = pd.DataFrame({"plato": list(proy), "unidades": list(proy.values())})
    mh = h_raw.set_index("plato")
    p_raw["precio"] = [mh["precio"].get(p, ult.loc[p, "ingreso"] / ult.loc[p, "unidades"]) for p in p_raw.plato]
    p_raw["costo"] = [mh["costo"].get(p, ult.loc[p, "costo"] / ult.loc[p, "unidades"]) for p in p_raw.plato]
    p_raw["categoria"] = p_raw["plato"].map(cat_plato)
    pro, umb_p = clasificar(p_raw)
    # La proyectada usa los márgenes del último periodo histórico (umbral de margen del menú proyectado).
    alts = alertas(hist, pro)

    def filas_menu(d):
        return [{"plato": r.plato, "categoria": r.categoria, "unidades": float(r.unidades),
                 "precio": r.precio, "costo": r.costo, "margen": r.margen,
                 "popularidad": r.popularidad, "categoria_menu": r.categoria_menu,
                 "accion": ACCIONES[r.categoria_menu]} for r in d.itertuples()]
    dump("ingenieria_menu.json", {
        "periodo": {"desde": str(desde.date()), "hasta": str(hasta.date())},
        "historica": {"umbrales": umb_h, "platos": filas_menu(hist)},
        "proyectada": {"umbrales": umb_p, "platos": filas_menu(pro)},
        "alertas": alts, "acciones": ACCIONES})

    # --- Reparto diario y platos.json ---
    por_plato, por_cat = participaciones(validos, cat_plato)
    plist = []
    for plato, g in serie.groupby("plato"):
        g = g.sort_values("semana")
        est = estados[plato]
        w = pesos_plato(plato, cat_plato[plato], por_plato, por_cat)
        u = ult.loc[plato] if plato in ult.index else None
        pr = float(mh["precio"].get(plato, u["ingreso"] / u["unidades"]))
        co = float(mh["costo"].get(plato, u["costo"] / u["unidades"]))
        plist.append({
            "plato": plato, "categoria": cat_plato[plato], "estado": est,
            "ultimas_12": [{"semana": str(s.date()), "unidades": int(x)}
                           for s, x in zip(g["semana"].tail(12), g["unidades"].tail(12))],
            "proyeccion": proy.get(plato), "proyeccion_exacta": exactas.get(plato), "participacion_dia": w,
            "reparto_diario": mayor_residuo(proy[plato], w) if plato in proy else None,
            "precio": pr, "costo": co, "margen": pr - co})
    dump("platos.json", {"dias": DIAS, "platos": plist})

    dump("serie_semanal.json", {
        "semanas": [str(s.date()) for s in semanas],
        "platos": {p: {"categoria": cat_plato[p], "estado": estados[p],
                       "u": g.sort_values("semana")["unidades"].tolist(),
                       "i": g.sort_values("semana")["ingreso"].round(4).tolist(),
                       "c": g.sort_values("semana")["costo"].round(4).tolist()}
                   for p, g in serie.groupby("plato")}})

    # --- Ranking ---
    tot = serie.groupby("semana")
    top5 = serie.assign(r=tot["unidades"].rank(method="min", ascending=False))
    top5 = top5[(top5["r"] <= 5) & (top5["unidades"] > 0)].groupby("plato").size()
    rk = []
    for p, g in serie.groupby("plato"):
        cv = g[g["unidades"] > 0]["unidades"]
        rk.append({"plato": p, "unidades": int(g["unidades"].sum()), "semanas_top5": int(top5.get(p, 0)),
                   "pct_semanas_con_venta": float(100 * len(cv) / len(g)),
                   "mediana_unidades_con_venta": float(cv.median()) if len(cv) else 0.0})
    rk.sort(key=lambda r: -r["unidades"])
    for i, r in enumerate(rk, 1):
        r["puesto_total"] = i
    dump("ranking.json", {"ranking": rk})

    # --- Confiabilidad ---
    mp = vigente["metricas"]["prueba"]["por_plato"] if "prueba" in vigente["metricas"] else vigente["metricas"]
    mt = vigente["metricas"]["prueba"]["total_semanal"]
    nombre = vigente["nombre"]
    dump("confiabilidad.json", {
        "modelo_vigente": nombre, "hiperparametros": vigente["hiperparametros"],
        "metricas_prueba": {"por_plato": mp, "total_semanal": mt},
        "rango_datos": {"desde": str(semanas[0].date()), "hasta": str(ultima.date())},
        "fecha_calculo": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "frases": {
            "MAE": f"En promedio, la proyección se aleja {mp['MAE']:.2f} unidades por plato y semana.",
            "RMSE": f"Los errores grandes pesan más: el desvío típico es de {mp['RMSE']:.2f} unidades por plato y semana.",
            "SMAPE": f"En porcentaje, el error relativo promedio por plato es de {mp['SMAPE']:.0f} %; "
                     "es alto porque la mayoría de platos vende pocas unidades por semana.",
            "total": f"Para la demanda total de la semana, la proyección se aleja {mt['MAE']:.1f} unidades en promedio."}})

    # --- Resumen ---
    tsem = serie.groupby("semana")["unidades"].sum()
    dump("resumen.json", {
        "rango": {"desde": str(semanas[0].date()), "hasta": str(ultima.date())},
        "ultima_semana": str(ultima.date()), "semana_proyectada": str(siguiente.date()),
        "unidades_ultima_semana": int(tsem.iloc[-1]), "unidades_semana_anterior": int(tsem.iloc[-2]),
        "total_proyectado": int(sum(proy.values())), "n_alertas": len(alts),
        "platos_por_categoria": hist["categoria_menu"].value_counts().to_dict(),
        "fecha_calculo": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M")})

    # --- Fixture de paridad del XGBoost (200 filas) ---
    muestra = X.sample(200, random_state=42)
    pr = modelo.predict(muestra[cols].astype(float))
    dump("paridad.json", {"filas": muestra[cols].astype(float).values.tolist(), "predicciones": pr.tolist()}, FIXT)
    # Fixture de paridad de la serie (para verificar preparacion.ts)
    dump("serie_paridad.json", {"semanas": [str(s.date()) for s in semanas],
         "u": {p: g.sort_values("semana")["unidades"].tolist() for p, g in serie.groupby("plato")},
         "estados": estados.to_dict(), "proy": proy,
         "clasif_hist": {r["plato"]: r["categoria_menu"] for r in filas_menu(hist)},
         "clasif_proy": {r["plato"]: r["categoria_menu"] for r in filas_menu(pro)},
         "reparto": {p["plato"]: p["reparto_diario"] for p in plist if p["reparto_diario"]}}, FIXT)
    print("Exportado. Proyección total:", sum(proy.values()), "| alertas:", len(alts), "| vigente:", meta["vigente"])


if __name__ == "__main__":
    main()
