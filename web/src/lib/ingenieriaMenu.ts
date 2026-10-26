// Ingeniería de menú (Kasavana y Smith). Misma lógica que src/ingenieria_menu.py.
import type { Alerta, CategoriaMenu, FilaMenu, SerieSemanal, Umbrales } from "../types";

export const ACCIONES: Record<CategoriaMenu, string> = {
  Estrella: "Mantener precio, porción y visibilidad en la carta.",
  "Caballo de arado": "Revisar el precio o la porción, o combinarlo con platos de mayor margen.",
  Puzzle: "Promoverlo, reubicarlo en la carta o recomendarlo en el servicio.",
  Perro: "Evaluar retirarlo o reemplazarlo.",
};

export interface EntradaMenu { plato: string; categoria: string; unidades: number; precio: number; costo: number }

export function clasificar(entrada: EntradaMenu[]): { platos: FilaMenu[]; umbrales: Umbrales } {
  const d = entrada.filter((e) => e.unidades > 0);
  const n = d.length;
  const total = d.reduce((a, e) => a + e.unidades, 0);
  if (n === 0) return { platos: [], umbrales: { margen_ponderado: 0, umbral_popularidad: 0, n_platos: 0 } };
  const margenPond = d.reduce((a, e) => a + (e.precio - e.costo) * e.unidades, 0) / total;
  const umbral = 0.7 / n;
  const platos = d.map((e) => {
    const margen = e.precio - e.costo;
    const popularidad = e.unidades / total;
    const alto = margen >= margenPond;
    const pop = popularidad >= umbral;
    const cat: CategoriaMenu = alto && pop ? "Estrella" : pop ? "Caballo de arado" : alto ? "Puzzle" : "Perro";
    return { ...e, margen, popularidad, categoria_menu: cat, accion: ACCIONES[cat] };
  });
  return { platos, umbrales: { margen_ponderado: margenPond, umbral_popularidad: umbral, n_platos: n } };
}

/** Unidades, precio y costo unitarios ponderados de las semanas [desde, hasta] (índices inclusivos). */
export function agregarPeriodo(serie: SerieSemanal, desde: number, hasta: number): EntradaMenu[] {
  const out: EntradaMenu[] = [];
  for (const [plato, s] of Object.entries(serie.platos)) {
    let u = 0, i = 0, c = 0;
    for (let k = desde; k <= hasta; k++) { u += s.u[k]; i += s.i[k]; c += s.c[k]; }
    if (u > 0) out.push({ plato, categoria: s.categoria, unidades: u, precio: i / u, costo: c / u });
  }
  return out;
}

export function calcularAlertas(hist: FilaMenu[], proy: FilaMenu[]): Alerta[] {
  const m = new Map(hist.map((f) => [f.plato, f.categoria_menu]));
  const out: Alerta[] = [];
  for (const r of proy) {
    const h = m.get(r.plato);
    if (h && h !== r.categoria_menu)
      out.push({ plato: r.plato, historica: h, proyectada: r.categoria_menu, accion: ACCIONES[r.categoria_menu] });
  }
  return out;
}
