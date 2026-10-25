"""Métricas de evaluación: MAE, RMSE y SMAPE (CA-06)."""
import numpy as np


def mae(y, p):
    return float(np.mean(np.abs(np.asarray(y, float) - np.asarray(p, float))))


def rmse(y, p):
    return float(np.sqrt(np.mean((np.asarray(y, float) - np.asarray(p, float)) ** 2)))


def smape(y, p):
    """SMAPE en %; el término vale 0 cuando y = ŷ = 0."""
    y = np.asarray(y, float)
    p = np.asarray(p, float)
    den = (np.abs(y) + np.abs(p)) / 2
    term = np.where(den == 0, 0.0, np.abs(y - p) / np.where(den == 0, 1, den))
    return float(100 * np.mean(term))


def metricas(y, p) -> dict:
    return {"MAE": mae(y, p), "RMSE": rmse(y, p), "SMAPE": smape(y, p)}
