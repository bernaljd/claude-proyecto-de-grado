// Lectura de tablas CSV (los datos del dashboard ya no son JSON).
import Papa from "papaparse";

export type Valor = string | number | boolean | null;
export type Fila = Record<string, Valor>;

/** Convierte el texto de un CSV en filas; los números salen como número y las celdas vacías como null. */
export function filas<T = Fila>(texto: string): T[] {
  return Papa.parse<T>(texto.replace(/^﻿/, ""), { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

/** Tabla de dos columnas (clave, valor) como objeto. */
export function claveValor(texto: string): Record<string, Valor> {
  return Object.fromEntries(filas<{ clave: string; valor: Valor }>(texto).map((f) => [f.clave, f.valor]));
}

/** De dónde salen los CSV: el navegador los pide por red; las pruebas los leen del disco. */
export interface Fuente { texto(nombre: string): Promise<string> }

export const fuenteRed = (base: string): Fuente => ({
  async texto(nombre) {
    const r = await fetch(`${base}data/${nombre}`);
    if (!r.ok) throw new Error(`No se pudo leer ${nombre}`);
    return r.text();
  },
});
