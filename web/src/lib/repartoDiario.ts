// Reparto diario (lunes a sábado) por el método del mayor residuo. Igual que src/proyeccion_diaria.py.
export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MIN_UNIDADES = 20;

export function mayorResiduo(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (total <= 0 || suma <= 0) return pesos.map(() => 0);
  const exacto = pesos.map((p) => (total * p) / suma);
  const base = exacto.map((e) => Math.floor(e + 1e-9));
  const resto = total - base.reduce((a, b) => a + b, 0);
  const orden = exacto
    .map((e, i) => ({ i, r: e - base[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < resto; k++) base[orden[k].i] += 1;
  return base;
}

/** Pesos del plato; si tiene menos de 20 unidades en 26 semanas, los de su categoría. */
export function pesosPlato(
  plato: string, categoria: string,
  porPlato: Record<string, number[]>, porCat: Record<string, number[]>,
): number[] {
  const p = porPlato[plato];
  if (p && p.reduce((a, b) => a + b, 0) >= MIN_UNIDADES) return p;
  return porCat[categoria] ?? [1, 1, 1, 1, 1, 1];
}
