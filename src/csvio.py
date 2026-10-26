"""Lectura y escritura de tablas clave,valor en CSV (reemplazan a los JSON de configuración)."""
import csv
from pathlib import Path


def _valor(texto: str):
    for tipo in (int, float):
        try:
            return tipo(texto)
        except ValueError:
            pass
    return texto


def escribir_clave_valor(ruta, datos: dict):
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["clave", "valor"])
        for k, v in datos.items():
            w.writerow([k, "" if v is None else repr(v) if isinstance(v, float) else v])


def leer_clave_valor(ruta) -> dict:
    with open(ruta, newline="", encoding="utf-8") as f:
        return {fila["clave"]: _valor(fila["valor"]) for fila in csv.DictReader(f)}
