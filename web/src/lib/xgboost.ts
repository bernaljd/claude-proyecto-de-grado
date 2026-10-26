// Evaluación en el navegador de un XGBoost exportado como tabla de nodos (modelo_xgb_arboles.csv).
import type { ModeloMeta } from "../types";
import { filas } from "./csv";

interface Nodo { v: number; umbral: number; si: number; no: number; falta: number; hoja: boolean; valor: number }
export interface ModeloXgb { arboles: Nodo[][] }

/** Cada fila del CSV es un nodo: si x[variable] < umbral va a `si`; si no, a `no`; si falta, a `faltante`. */
export function cargarModelo(texto: string, columnas: string[]): ModeloXgb {
  const pos = new Map(columnas.map((c, i) => [c, i]));
  const arboles: Nodo[][] = [];
  for (const f of filas<Record<string, string | number | null>>(texto)) {
    const hoja = !f.variable;
    (arboles[Number(f.arbol)] ??= [])[Number(f.nodo)] = {
      hoja, v: hoja ? -1 : pos.get(String(f.variable))!, umbral: Math.fround(Number(f.umbral)),
      si: Number(f.si), no: Number(f.no), falta: Number(f.faltante), valor: Number(f.valor_hoja),
    };
  }
  return { arboles };
}

function evaluarArbol(a: Nodo[], x: number[]): number {
  let n = a[0];
  while (!n.hoja) {
    const v = x[n.v];
    n = a[Number.isNaN(v) ? n.falta : Math.fround(v) < n.umbral ? n.si : n.no];
  }
  return n.valor;
}

/** Suma de hojas + base_score (en Tweedie, margen base = log(base_score) y se aplica exp). */
export function predecir(m: ModeloXgb, meta: Pick<ModeloMeta, "objetivo" | "base_score">, x: number[]): number {
  let margen = 0;
  for (const a of m.arboles) margen += evaluarArbol(a, x);
  if (meta.objetivo === "reg:tweedie") return Math.exp(margen + Math.log(meta.base_score));
  return margen + meta.base_score;
}
