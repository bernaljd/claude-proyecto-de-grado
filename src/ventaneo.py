"""Ventaneo (ventana deslizante): convierte la serie semanal en un dataset supervisado.

Para cada plato y cada semana objetivo t, la fila contiene las V semanas previas (t-V ... t-1) como entradas
y las unidades de t como salida. Es el formato que consumen los modelos de ML (XGBoost y LSTM).

   Semana | Plato | Ventas(u)         ventana V = 3 sobre un plato:
   1      | 1     | 20                fila objetivo t=4: x_1=20 (sem 1), x_2=25 (sem 2), x_3=5 (sem 3), y=20 (sem 4)
   2      | 1     | 25                fila objetivo t=5: x_1=25 (sem 2), x_2=5  (sem 3), x_3=20 (sem 4), y=30 (sem 5)
   3      | 1     | 5                 ...
"""
import pandas as pd


def ventanear(serie: pd.DataFrame, ventana: int, platos=None) -> pd.DataFrame:
    """serie: columnas plato, semana, unidades. Devuelve una fila por (plato, semana objetivo)."""
    filas = []
    for plato, g in serie.sort_values(["plato", "semana"]).groupby("plato"):
        if platos is not None and plato not in platos:
            continue
        u = g["unidades"].to_numpy()
        sem = g["semana"].to_numpy()
        for t in range(ventana, len(u)):
            fila = {"plato": plato, "semana": sem[t], "y": int(u[t])}
            fila.update({f"x_{k + 1}": int(u[t - ventana + k]) for k in range(ventana)})  # x_V = semana t-1
            filas.append(fila)
    return pd.DataFrame(filas)
