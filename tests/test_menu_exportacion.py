from pathlib import Path

import pandas as pd

from src.ingenieria_menu import clasificar
from src.proyeccion_diaria import mayor_residuo

DATA = Path("web/public/data")


def test_clasificacion_a_mano():
    d = pd.DataFrame({"plato": list("ABCD"), "unidades": [40, 30, 20, 10],
                      "precio": [10, 4, 9, 3], "costo": [4, 2, 4, 2]})
    r, u = clasificar(d)
    assert abs(u["margen_ponderado"] - 4.1) < 1e-12
    assert dict(zip(r.plato, r.categoria_menu)) == {
        "A": "Estrella", "B": "Caballo de arado", "C": "Estrella", "D": "Perro"}


def test_referencia_12_mas_vendidos():
    s = pd.read_csv(DATA / "serie_semanal.csv").groupby("plato")[["unidades", "ingreso", "costo"]].sum()
    s["precio"], s["costo"] = s["ingreso"] / s["unidades"], s["costo"] / s["unidades"]
    top = s.reset_index().sort_values("unidades", ascending=False).head(12)
    r, u = clasificar(top)
    assert round(u["margen_ponderado"], 2) == 3.36
    assert round(u["umbral_popularidad"] * 100, 2) == 5.83
    assert r.categoria_menu.value_counts().to_dict() == {"Caballo de arado": 6, "Puzzle": 4, "Estrella": 2}
    assert set(r[r.categoria_menu == "Estrella"].plato) == {"Efo Riro", "Egusi (Melon Soup)"}


def test_mayor_residuo_suma_exacta():
    for total in range(0, 40):
        assert sum(mayor_residuo(total, [5, 0, 3, 9, 2, 1])) == total


def test_csv_exportados_tienen_las_columnas():
    columnas = {
        "resumen.csv": {"clave", "valor"},
        "platos.csv": {"plato", "categoria", "estado", "proyeccion", "proyeccion_exacta", "precio", "costo", "margen",
                       "part_lun", "part_sab", "reparto_lun", "reparto_sab"},
        "serie_semanal.csv": {"plato", "categoria", "estado", "semana", "unidades", "ingreso", "costo"},
        "menu_historica.csv": {"plato", "categoria", "unidades", "precio", "costo", "margen", "popularidad", "categoria_menu", "accion"},
        "menu_proyectada.csv": {"plato", "categoria", "unidades", "precio", "costo", "margen", "popularidad", "categoria_menu", "accion"},
        "menu_umbrales.csv": {"version", "margen_ponderado", "umbral_popularidad", "n_platos", "desde", "hasta"},
        "menu_alertas.csv": {"plato", "historica", "proyectada", "accion"},
        "menu_acciones.csv": {"categoria_menu", "accion"},
        "ranking.csv": {"plato", "unidades", "semanas_top5", "pct_semanas_con_venta", "mediana_unidades_con_venta", "puesto_total"},
        "confiabilidad.csv": {"clave", "valor"},
        "confiabilidad_metricas.csv": {"nivel", "metrica", "valor"},
        "modelo_meta.csv": {"clave", "valor"},
        "modelo_columnas.csv": {"orden", "columna"},
        "modelo_platos.csv": {"plato"},
        "modelo_categorias.csv": {"categoria"},
        "modelo_xgb_arboles.csv": {"arbol", "nodo", "variable", "umbral", "si", "no", "faltante", "valor_hoja"},
    }
    for nombre, esperadas in columnas.items():
        assert esperadas <= set(pd.read_csv(DATA / nombre).columns), nombre
    assert not list(DATA.glob("*.json")), "los datos del dashboard ya no son JSON"
