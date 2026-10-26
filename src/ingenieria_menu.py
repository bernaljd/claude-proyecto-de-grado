"""Ingeniería de menú (Kasavana y Smith). Misma lógica que web/src/lib/ingenieriaMenu.ts."""
import pandas as pd

ACCIONES = {
    "Estrella": "Mantener precio, porción y visibilidad en la carta.",
    "Caballo de arado": "Revisar el precio o la porción, o combinarlo con platos de mayor margen.",
    "Puzzle": "Promoverlo, reubicarlo en la carta o recomendarlo en el servicio.",
    "Perro": "Evaluar retirarlo o reemplazarlo.",
}


def clasificar(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """df: plato, unidades, precio, costo (unitarios). Solo platos con unidades > 0."""
    d = df[df["unidades"] > 0].copy()
    n = len(d)
    total = d["unidades"].sum()
    if n == 0:
        return d.assign(margen=[], popularidad=[], categoria_menu=[]), {
            "margen_ponderado": 0.0, "umbral_popularidad": 0.0, "n_platos": 0}
    d["margen"] = d["precio"] - d["costo"]
    margen_pond = float((d["margen"] * d["unidades"]).sum() / total)
    umbral = 0.7 / n
    d["popularidad"] = d["unidades"] / total
    alto = d["margen"] >= margen_pond
    pop = d["popularidad"] >= umbral
    d["categoria_menu"] = ["Estrella" if a and p else "Caballo de arado" if p else "Puzzle" if a else "Perro"
                           for a, p in zip(alto, pop)]
    return d, {"margen_ponderado": margen_pond, "umbral_popularidad": umbral, "n_platos": n}


def agregar_periodo(serie: pd.DataFrame, desde, hasta) -> pd.DataFrame:
    """Unidades, precio y costo unitarios ponderados de un periodo de semanas."""
    s = serie[(serie["semana"] >= desde) & (serie["semana"] <= hasta)]
    g = s.groupby("plato").agg(unidades=("unidades", "sum"), ingreso=("ingreso", "sum"), costo_t=("costo", "sum"))
    g = g[g["unidades"] > 0]
    g["precio"] = g["ingreso"] / g["unidades"]
    g["costo"] = g["costo_t"] / g["unidades"]
    return g.reset_index()[["plato", "unidades", "precio", "costo"]]


def alertas(hist: pd.DataFrame, proy: pd.DataFrame) -> list[dict]:
    m = hist.set_index("plato")["categoria_menu"]
    out = []
    for _, r in proy.iterrows():
        h = m.get(r["plato"])
        if h is not None and h != r["categoria_menu"]:
            out.append({"plato": r["plato"], "historica": h, "proyectada": r["categoria_menu"],
                        "accion": ACCIONES[r["categoria_menu"]]})
    return out
