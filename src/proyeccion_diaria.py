"""Reparto diario de la proyección semanal (RF-05). Misma lógica que web/src/lib/repartoDiario.ts."""
import numpy as np

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
MIN_UNIDADES = 20


def mayor_residuo(total: int, pesos) -> list[int]:
    """Reparte `total` en enteros proporcionales a `pesos`; la suma es exactamente `total`."""
    pesos = np.asarray(pesos, float)
    if total <= 0 or pesos.sum() <= 0:
        return [0] * len(pesos)
    exacto = total * pesos / pesos.sum()
    base = np.floor(exacto + 1e-9).astype(int)
    resto = total - int(base.sum())
    orden = sorted(range(len(pesos)), key=lambda i: (-(exacto[i] - base[i]), i))
    for i in orden[:resto]:
        base[i] += 1
    return base.tolist()


def participaciones(validos, estados_cat: dict):
    """Unidades por día (lun-sáb) por plato y por categoría en las últimas 26 semanas."""
    v = validos.copy()
    v["Semana"] = v["Date"].dt.to_period("W-SUN").dt.start_time
    corte = v["Semana"].max() - __import__("pandas").Timedelta(weeks=25)
    v = v[(v["Semana"] >= corte) & (v["Date"].dt.dayofweek < 6)]
    v["dia"] = v["Date"].dt.dayofweek
    por_plato = v.pivot_table(index="Line item name", columns="dia", values="Quantity", aggfunc="sum", fill_value=0)
    por_plato = por_plato.reindex(columns=range(6), fill_value=0)
    cat = v.merge(estados_cat.rename("cat"), left_on="Line item name", right_index=True)
    por_cat = cat.pivot_table(index="cat", columns="dia", values="Quantity", aggfunc="sum", fill_value=0)
    return por_plato.reindex(columns=range(6), fill_value=0), por_cat.reindex(columns=range(6), fill_value=0)


def pesos_plato(plato, categoria, por_plato, por_cat) -> list[float]:
    if plato in por_plato.index and por_plato.loc[plato].sum() >= MIN_UNIDADES:
        return por_plato.loc[plato].tolist()
    if categoria in por_cat.index:
        return por_cat.loc[categoria].tolist()
    return [1.0] * 6
