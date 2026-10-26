"""XGBoost global: búsqueda en grilla sobre validación y reentrenamiento."""
import itertools

import numpy as np
import xgboost as xgb

from ..evaluacion import mae

MAX_ARBOLES = 1000
PARADA = 50
SEMILLA = 42

VENTANAS = [4, 8, 12]  # mismas ventanas que explora la LSTM

GRILLA = {
    "max_depth": [3, 4, 6],
    "learning_rate": [0.03, 0.1],
    "subsample": [0.8, 1.0],
    "colsample_bytree": [0.8, 1.0],
    "min_child_weight": [1, 5],
}
OBJETIVOS = [("reg:squarederror", None), ("reg:tweedie", 1.2), ("reg:tweedie", 1.5)]


def combinaciones():
    claves = list(GRILLA)
    for obj, pot in OBJETIVOS:
        for vals in itertools.product(*GRILLA.values()):
            p = dict(zip(claves, vals), objective=obj)
            if pot is not None:
                p["tweedie_variance_power"] = pot
            yield p


def _modelo(params, n_estimators, parada=None):
    return xgb.XGBRegressor(
        n_estimators=n_estimators, random_state=SEMILLA, tree_method="hist", n_jobs=1,
        eval_metric="mae", early_stopping_rounds=parada, **params)


def buscar(Xtr, ytr, Xva, yva):
    """Devuelve (mejores params, n_árboles, lista de resultados) por menor MAE en validación."""
    resultados = []
    for params in combinaciones():
        m = _modelo(params, MAX_ARBOLES, PARADA)
        m.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False)
        pred = np.clip(m.predict(Xva), 0, None)
        resultados.append({**params, "n_arboles": int(m.best_iteration) + 1,
                           "mae_val": mae(yva, pred)})
    mejor = min(resultados, key=lambda r: r["mae_val"])
    params = {k: v for k, v in mejor.items() if k not in ("n_arboles", "mae_val")}
    return params, mejor["n_arboles"], resultados


def ajustar(params, n_arboles, X, y):
    m = _modelo(params, n_arboles)
    m.fit(X, y, verbose=False)
    return m


def matriz_ventana(var, platos, cats, ventana, semanas_objetivo=None):
    """Dataset ventaneado + one-hot de plato y categoría (igual que la LSTM). Devuelve (DataFrame, columnas)."""
    from ..ventaneo import columnas_ventana, ventanear_variables
    w = ventanear_variables(var, platos, ventana, semanas_objetivo)
    for p in platos:
        w[f"plato_{p}"] = (w["plato"] == p).astype(int)
    for c in cats:
        w[f"cat_{c}"] = (w["categoria"] == c).astype(int)
    return w, columnas_ventana(ventana) + [f"plato_{p}" for p in platos] + [f"cat_{c}" for c in cats]
