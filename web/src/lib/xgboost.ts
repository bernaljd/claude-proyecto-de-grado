// Evaluación en el navegador de un XGBoost exportado con booster.save_model(*.json).
import type { ModeloMeta } from "../types";

interface Arbol {
  left_children: number[]; right_children: number[]; split_indices: number[];
  split_conditions: number[]; default_left: number[];
}
export interface ModeloXgb { trees: Arbol[] }

export function cargarModelo(json: any): ModeloXgb {
  const trees: Arbol[] = json.learner.gradient_booster.model.trees;
  return { trees };
}

function evaluarArbol(a: Arbol, x: number[]): number {
  let n = 0;
  while (a.left_children[n] !== -1) {
    const v = x[a.split_indices[n]];
    if (Number.isNaN(v)) n = a.default_left[n] ? a.left_children[n] : a.right_children[n];
    else n = Math.fround(v) < Math.fround(a.split_conditions[n]) ? a.left_children[n] : a.right_children[n];
  }
  return a.split_conditions[n]; // en una hoja, split_conditions guarda el valor
}

/** Suma de hojas + base_score (en Tweedie, margen base = log(base_score) y se aplica exp). */
export function predecir(m: ModeloXgb, meta: Pick<ModeloMeta, "objetivo" | "base_score">, x: number[]): number {
  let margen = 0;
  for (const a of m.trees) margen += evaluarArbol(a, x);
  if (meta.objetivo === "reg:tweedie") return Math.exp(margen + Math.log(meta.base_score));
  return margen + meta.base_score;
}
