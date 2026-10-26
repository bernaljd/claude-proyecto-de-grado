import numpy as np
import pandas as pd
import pytest

from src.evaluacion import smape
from src.preparacion import COLUMNAS_BASE, preparar


@pytest.fixture(scope="module")
def d():
    return preparar()


def test_hechos_verificados(d):
    validos, serie, estados, var = d
    assert len(validos) == 4361
    assert validos["Quantity"].sum() == 7118
    assert round(validos["Gross Sales"].sum(), 2) == 38480.25
    assert validos["Line item name"].nunique() == 62
    assert validos["Date"].nunique() == 661
    assert (validos["Date"].dt.dayofweek != 6).all()
    assert serie["semana"].nunique() == 157 and len(serie) == 9734
    assert serie["semana"].min() == pd.Timestamp("2023-01-02")
    assert serie["semana"].max() == pd.Timestamp("2025-12-29")
    assert round(validos["Est. Cost"].sum() / (validos["Price Per Item"] * validos["Quantity"]).sum(), 4) == 0.3498


def test_promedio_semanal_por_anio(d):
    u = d[0].groupby(d[0]["Date"].dt.year)["Quantity"].sum() / 52
    assert [round(x, 1) for x in u] == [70.6, 42.6, 23.7]


def test_ca01_suma_serie(d):
    assert d[1]["unidades"].sum() == d[0]["Quantity"].sum()


def test_estados_ca02(d):
    e = d[2]
    assert e.value_counts().to_dict() == {"modelable": 45, "historial_insuficiente": 7, "retirado": 10}
    assert sorted(e[e == "historial_insuficiente"].index) == sorted([
        "Asun goat meat", "Bitterleaf soup", "Fried Yam", "Goat Meat Peppersoup",
        "Nkwobi", "Oha Soup", "PEPPERED TURKEY"])


def test_particion_ca04(d):
    var = d[3]
    assert var.groupby("conjunto")["semana"].nunique().to_dict() == {
        "entrenamiento": 105, "validacion": 26, "prueba": 26}


def test_sin_fuga(d):
    var = d[3]
    for plato in ["Efo Riro", "Meat Pie"]:
        g = var[var.plato == plato].reset_index(drop=True)
        for t in range(4, len(g)):
            esperado = g.loc[t - 4:t - 1, "unidades"].to_numpy()
            assert g.loc[t, "lag_1"] == g.loc[t - 1, "unidades"]
            assert g.loc[t, "lag_4"] == g.loc[t - 4, "unidades"]
            assert np.isclose(g.loc[t, "mm4"], esperado.mean())
            assert g.loc[t, "precio_prev"] == g.loc[t - 1, "precio"]
    # Cambiar y_t no altera las variables de la semana t
    assert "unidades" not in COLUMNAS_BASE


def test_smape_cero_cero():
    assert smape([0, 0], [0, 0]) == 0.0
    assert smape([0], [2]) == 200.0


def test_dataset_procesado_en_disco():
    """Los modelos leen data/processed/: la serie y el dataset de modelado deben existir y cuadrar."""
    from src.pipeline import PROCESADOS, ejecutar
    ejecutar()
    s = pd.read_parquet(PROCESADOS / "serie_semanal.parquet")
    m = pd.read_parquet(PROCESADOS / "dataset_modelado.parquet")
    assert len(s) == 9734 and s["unidades"].sum() == 7118
    assert m["plato"].nunique() == 45
    assert m.groupby("conjunto")["semana"].nunique().to_dict() == {"entrenamiento": 105, "validacion": 26, "prueba": 26}


def test_ventaneo_a_mano():
    from src.ventaneo import ventanear
    serie = pd.DataFrame({"plato": ["A"] * 6, "semana": pd.date_range("2024-01-01", periods=6, freq="7D"),
                          "unidades": [20, 25, 5, 20, 30, 40]})
    w = ventanear(serie, 3)
    assert len(w) == 3
    assert w.iloc[0][["x_1", "x_2", "x_3", "y"]].tolist() == [20, 25, 5, 20]
    assert w.iloc[1][["x_1", "x_2", "x_3", "y"]].tolist() == [25, 5, 20, 30]
    assert w.iloc[2][["x_1", "x_2", "x_3", "y"]].tolist() == [5, 20, 30, 40]


def test_ventaneo_coincide_con_los_rezagos(d):
    """La ventana de 4 semanas es la misma información que lag_1..lag_4 de las variables de XGBoost."""
    from src.ventaneo import ventanear
    serie, var = d[1], d[3]
    w = ventanear(serie, 4, {"Efo Riro"}).set_index("semana")
    v = var[var.plato == "Efo Riro"].set_index("semana").loc[w.index]
    assert (w["x_4"] == v["lag_1"]).all() and (w["x_1"] == v["lag_4"]).all() and (w["y"] == v["unidades"]).all()
