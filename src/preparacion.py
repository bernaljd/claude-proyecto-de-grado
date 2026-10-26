"""Preparación de los datos (CRISP-DM fase 3): serie semanal, estados, variables y partición.

Todas las variables de la semana t usan solo información de semanas < t (sin fuga).
"""
import numpy as np
import pandas as pd

from .ingesta import depurar, leer_ventas

ULTIMA_SEMANA_ENTRENAMIENTO = pd.Timestamp("2024-12-30")
INICIO_VALIDACION = pd.Timestamp("2025-01-06")
FIN_VALIDACION = pd.Timestamp("2025-06-30")
INICIO_PRUEBA = pd.Timestamp("2025-07-07")
SEMANAS_RETIRO = 26
SEMANAS_MIN_HISTORIAL = 26
N_REZAGOS = 4


def asignar_semana(df: pd.DataFrame) -> pd.DataFrame:
    """Semana que inicia el lunes."""
    df = df.copy()
    df["Semana"] = df["Date"].dt.to_period("W-SUN").dt.start_time
    return df


def categoria_por_plato(df: pd.DataFrame) -> pd.Series:
    """Cada plato toma la categoría con más registros (Beef Suya aparece en dos)."""
    conteo = df.groupby(["Line item name", "Category"]).size().rename("n").reset_index()
    conteo = conteo.sort_values(["Line item name", "n", "Category"], ascending=[True, False, True])
    return conteo.drop_duplicates("Line item name").set_index("Line item name")["Category"]


def serie_semanal(validos: pd.DataFrame) -> pd.DataFrame:
    """Unidades por plato y semana, con ceros en semanas sin ventas (157 x 62)."""
    v = asignar_semana(validos)
    semanas = pd.date_range(v["Semana"].min(), v["Semana"].max(), freq="7D")
    platos = sorted(v["Line item name"].unique())
    u = (v.groupby(["Line item name", "Semana"])["Quantity"].sum()
         .unstack("Semana").reindex(index=platos, columns=semanas, fill_value=0).fillna(0))
    largo = u.stack().rename("unidades").reset_index()
    largo.columns = ["plato", "semana", "unidades"]
    largo["unidades"] = largo["unidades"].astype(int)
    # Precio unitario semanal: promedio ponderado por unidades; ffill y luego bfill.
    v = v.assign(ingreso=v["Price Per Item"] * v["Quantity"])
    g = v.groupby(["Line item name", "Semana"]).agg(
        ingreso=("ingreso", "sum"), q=("Quantity", "sum"), costo=("Est. Cost", "sum"))
    for col in ("ingreso", "costo"):  # ingreso y costo semanal (0 en semanas sin ventas)
        m = g[col].unstack("Semana").reindex(index=platos, columns=semanas, fill_value=0).fillna(0)
        largo[col] = m.stack().reindex(pd.MultiIndex.from_frame(largo[["plato", "semana"]])).to_numpy()
    g["precio"] = g["ingreso"] / g["q"]
    p = g["precio"].unstack("Semana").reindex(index=platos, columns=semanas)
    p = p.T.ffill().bfill().T
    largo["precio"] = p.stack().reindex(pd.MultiIndex.from_frame(largo[["plato", "semana"]])).to_numpy()
    cat = categoria_por_plato(validos)
    largo["categoria"] = largo["plato"].map(cat)
    return largo.sort_values(["plato", "semana"]).reset_index(drop=True)


def verificar_ca01(serie: pd.DataFrame, validos: pd.DataFrame) -> None:
    """CA-01: la suma de la serie debe igualar la suma de Quantity válida."""
    assert int(serie["unidades"].sum()) == int(validos["Quantity"].sum()), "CA-01 falla"


def estados_platos(serie: pd.DataFrame) -> pd.Series:
    """CA-02: retirado / historial_insuficiente / modelable."""
    semanas = sorted(serie["semana"].unique())
    ultimas = set(semanas[-SEMANAS_RETIRO:])
    estados = {}
    for plato, g in serie.groupby("plato"):
        con_venta = g[g["unidades"] > 0]
        if not set(con_venta["semana"]) & ultimas:
            estados[plato] = "retirado"
            continue
        primera = con_venta["semana"].min()
        if primera > ULTIMA_SEMANA_ENTRENAMIENTO:
            n = 0
        else:
            n = (ULTIMA_SEMANA_ENTRENAMIENTO - primera).days // 7 + 1
        estados[plato] = "modelable" if n >= SEMANAS_MIN_HISTORIAL else "historial_insuficiente"
    return pd.Series(estados, name="estado")


def construir_variables(serie: pd.DataFrame) -> pd.DataFrame:
    """Rezagos, mm4, calendario y precio previo; solo semanas anteriores a t."""
    d = serie.sort_values(["plato", "semana"]).copy()
    g = d.groupby("plato")
    for k in range(1, N_REZAGOS + 1):
        d[f"lag_{k}"] = g["unidades"].shift(k)
    d["mm4"] = d[[f"lag_{k}" for k in range(1, N_REZAGOS + 1)]].mean(axis=1)
    sem = d["semana"].dt.isocalendar().week.astype(int)
    d["sem_sin"] = np.sin(2 * np.pi * sem / 52)
    d["sem_cos"] = np.cos(2 * np.pi * sem / 52)
    d["mes"] = d["semana"].dt.month
    d["precio_prev"] = g["precio"].shift(1)
    d["idx_semana"] = d.groupby("plato").cumcount()
    return d.reset_index(drop=True)


def asignar_conjunto(semana: pd.Series) -> pd.Series:
    """Partición cronológica (CA-04)."""
    return pd.Series(np.select(
        [semana <= ULTIMA_SEMANA_ENTRENAMIENTO, semana <= FIN_VALIDACION],
        ["entrenamiento", "validacion"], default="prueba"), index=semana.index)


def preparar(ruta=None):
    """Pipeline completo. Devuelve (validos, serie, estados, variables)."""
    df = leer_ventas(ruta) if ruta else leer_ventas()
    validos = depurar(df)
    serie = serie_semanal(validos)
    verificar_ca01(serie, validos)
    estados = estados_platos(serie)
    var = construir_variables(serie)
    var["estado"] = var["plato"].map(estados)
    var["conjunto"] = asignar_conjunto(var["semana"])
    return validos, serie, estados, var


def matriz_modelo(var: pd.DataFrame, platos: list[str], categorias: list[str]) -> pd.DataFrame:
    """Añade el one-hot de plato y categoría con columnas fijas (orden estable)."""
    X = var.copy()
    for p in platos:
        X[f"plato_{p}"] = (X["plato"] == p).astype(int)
    for c in categorias:
        X[f"cat_{c}"] = (X["categoria"] == c).astype(int)
    return X


COLUMNAS_BASE = [f"lag_{k}" for k in range(1, N_REZAGOS + 1)] + [
    "mm4", "sem_sin", "sem_cos", "mes", "precio_prev"]
