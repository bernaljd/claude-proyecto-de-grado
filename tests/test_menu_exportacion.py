import json
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
    s = json.loads((DATA / "serie_semanal.json").read_text())["platos"]
    filas = []
    for p, x in s.items():
        u = sum(x["u"])
        filas.append({"plato": p, "unidades": u, "precio": sum(x["i"]) / u, "costo": sum(x["c"]) / u})
    top = pd.DataFrame(filas).sort_values("unidades", ascending=False).head(12)
    r, u = clasificar(top)
    assert round(u["margen_ponderado"], 2) == 3.36
    assert round(u["umbral_popularidad"] * 100, 2) == 5.83
    assert r.categoria_menu.value_counts().to_dict() == {"Caballo de arado": 6, "Puzzle": 4, "Estrella": 2}
    assert set(r[r.categoria_menu == "Estrella"].plato) == {"Efo Riro", "Egusi (Melon Soup)"}


def test_mayor_residuo_suma_exacta():
    for total in range(0, 40):
        assert sum(mayor_residuo(total, [5, 0, 3, 9, 2, 1])) == total


def test_json_exportados_tienen_las_claves():
    claves = {
        "resumen": {"rango", "ultima_semana", "unidades_ultima_semana", "unidades_semana_anterior",
                    "total_proyectado", "n_alertas", "platos_por_categoria", "fecha_calculo"},
        "platos": {"dias", "platos"}, "serie_semanal": {"semanas", "platos"},
        "ingenieria_menu": {"periodo", "historica", "proyectada", "alertas", "acciones"},
        "ranking": {"ranking"},
        "confiabilidad": {"modelo_vigente", "metricas_prueba", "rango_datos", "fecha_calculo", "frases"},
        "modelo_meta": {"vigente", "columnas", "categorias", "objetivo", "base_score"},
    }
    for nombre, esperadas in claves.items():
        assert esperadas <= set(json.loads((DATA / f"{nombre}.json").read_text())), nombre
    assert (DATA / "modelo_xgb.json").exists()
