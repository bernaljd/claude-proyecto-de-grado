"""Flujos F1-F5 en Python: CSV -> ventas depuradas (D1) -> serie semanal -> dataset de modelado.

Los modelos NO leen el CSV: leen los archivos de data/processed/, que escribe esta función.
Uso: python -m src.pipeline
"""
from pathlib import Path

import pandas as pd

from .preparacion import COLUMNAS_BASE, preparar

PROCESADOS = Path("data/processed")


def ejecutar(guardar: bool = True):
    """Prepara los datos y, si `guardar`, los escribe en data/processed/. Devuelve (validos, serie, estados, var)."""
    validos, serie, estados, var = preparar()
    if guardar:
        PROCESADOS.mkdir(parents=True, exist_ok=True)
        # D1: ventas depuradas (sin cancelados), una fila por registro del CSV
        validos.to_parquet(PROCESADOS / "ventas_depuradas.parquet", index=False)
        # Serie semanal: unidades, ingreso y costo por plato y semana (con ceros)
        serie.to_parquet(PROCESADOS / "serie_semanal.parquet", index=False)
        serie.to_csv(PROCESADOS / "serie_semanal.csv", index=False)
        # Estado de cada plato (modelable / historial_insuficiente / retirado)
        estados.rename_axis("plato").reset_index().to_csv(PROCESADOS / "estados_platos.csv", index=False)
        # Dataset de modelado: variables + objetivo + conjunto (entrenamiento/validacion/prueba)
        modelo = var[var["estado"] == "modelable"]
        cols = ["plato", "categoria", "semana", "conjunto", "idx_semana", "unidades"] + COLUMNAS_BASE
        modelo[cols].to_parquet(PROCESADOS / "dataset_modelado.parquet", index=False)
        modelo[cols].to_csv(PROCESADOS / "dataset_modelado.csv", index=False)
    return validos, serie, estados, var


if __name__ == "__main__":
    _, serie, estados, var = ejecutar()
    print(f"serie_semanal: {len(serie)} filas | platos: {estados.value_counts().to_dict()}")
    print(pd.read_parquet(PROCESADOS / "dataset_modelado.parquet").groupby("conjunto").size().to_dict())
