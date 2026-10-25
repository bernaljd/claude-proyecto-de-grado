"""Modelo base: ŷ_t = media móvil retrasada de 4 semanas (mm4). Sin parámetros."""
import numpy as np


def predecir_base(df) -> np.ndarray:
    return np.clip(df["mm4"].to_numpy(float), 0, None)
