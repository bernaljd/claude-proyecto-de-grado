"""Ingesta: lectura y validación del CSV de ventas (flujos F1-F3)."""
from pathlib import Path

import pandas as pd

RUTA_CSV = Path("data/raw/Anonymized_Restaurant_Sales_Data.csv")
COLUMNAS_MINIMAS = ["Date", "Category", "Line item name", "Quantity",
                    "Price Per Item", "Est. Cost", "Cancelled"]


def leer_ventas(ruta=RUTA_CSV) -> pd.DataFrame:
    """Lee el CSV crudo; las fechas vienen como dd/mm/yyyy."""
    df = pd.read_csv(ruta)
    faltan = [c for c in COLUMNAS_MINIMAS if c not in df.columns]
    if faltan:
        raise ValueError(f"Faltan columnas en el archivo: {', '.join(faltan)}")
    df["Date"] = pd.to_datetime(df["Date"], dayfirst=True)
    return df


def depurar(df: pd.DataFrame) -> pd.DataFrame:
    """Excluye los registros cancelados (D1: ventas depuradas)."""
    return df[df["Cancelled"].astype(str).str.strip().str.lower() != "yes"].copy()
