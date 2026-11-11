// Ingeniería de menú de Kasavana y Smith, con la misma fórmula del pipeline (M6).
// Es el único cálculo permitido en el navegador: se usa cuando el usuario cambia
// el período histórico de la matriz. Con el período por defecto (12 semanas)
// reproduce 06_ingenieria_menu.csv (hay una prueba que lo exige).
import type { Clasificacion, FilaSerie } from './tipos';

// Constantes de la tesis: 70 % del umbral de popularidad y 12 semanas por defecto
export const FACTOR_POPULARIDAD = 0.7;
export const SEMANAS_POR_DEFECTO = 12;

export interface EntradaMenu {
  plato: string;
  unidades: number;
  margenUnitario: number;
}

export interface FilaMatriz extends EntradaMenu {
  popularidadPct: number;
  umbralMargen: number;
  umbralPopularidad: number;
  clasificacion: Clasificacion;
}

/** Regla de clasificación: margen alto si ≥ umbral de margen; popularidad alta si ≥ umbral de popularidad. */
export function clasificar(
  margenUnitario: number,
  popularidadPct: number,
  umbralMargen: number,
  umbralPopularidad: number,
): Clasificacion {
  const margenAlto = margenUnitario >= umbralMargen;
  const popular = popularidadPct >= umbralPopularidad;
  if (margenAlto && popular) return 'Estrella';
  if (popular) return 'Caballo de arado';
  if (margenAlto) return 'Puzzle';
  return 'Perro';
}

/**
 * Calcula la matriz de un escenario: popularidad de cada plato, umbrales del
 * menú y clasificación. Entran solo los platos con unidades > 0.
 * - umbral_margen = Σ(margen_unitario × unidades) / Σ unidades (margen ponderado del menú)
 * - umbral_popularidad = 70 % × (1 / N) en %, con N platos que entran
 */
export function calcularMatriz(entradas: EntradaMenu[]): FilaMatriz[] {
  const platos = entradas.filter((entrada) => entrada.unidades > 0);
  const totalUnidades = platos.reduce((suma, entrada) => suma + entrada.unidades, 0);
  if (platos.length === 0 || totalUnidades === 0) return [];
  const umbralMargen =
    platos.reduce((suma, entrada) => suma + entrada.margenUnitario * entrada.unidades, 0) / totalUnidades;
  const umbralPopularidad = (100 * FACTOR_POPULARIDAD) / platos.length;
  return platos.map((entrada) => {
    const popularidadPct = (100 * entrada.unidades) / totalUnidades;
    return {
      ...entrada,
      popularidadPct,
      umbralMargen,
      umbralPopularidad,
      clasificacion: clasificar(entrada.margenUnitario, popularidadPct, umbralMargen, umbralPopularidad),
    };
  });
}

export type Periodo = { tipo: 'semanas'; semanas: number } | { tipo: 'rango'; desde: string; hasta: string };

/** Las semanas de la serie que entran en un período (las N con mayor semana_inicio, o un rango de fechas). */
export function semanasDelPeriodo(todasLasSemanas: string[], periodo: Periodo): Set<string> {
  const ordenadas = [...todasLasSemanas].sort();
  if (periodo.tipo === 'semanas') {
    return new Set(ordenadas.slice(-periodo.semanas));
  }
  return new Set(ordenadas.filter((semana) => semana >= periodo.desde && semana <= periodo.hasta));
}

/**
 * Agrega la serie semanal en un período: por plato, unidades = Σ unidades y
 * margen_unitario = Σ margen / Σ unidades. Entran solo los platos con unidades > 0.
 */
export function agregarPeriodo(serie: FilaSerie[], semanas: Set<string>): EntradaMenu[] {
  const porPlato = new Map<string, { unidades: number; margen: number }>();
  for (const fila of serie) {
    if (!semanas.has(fila.semana_inicio)) continue;
    const acumulado = porPlato.get(fila.plato) ?? { unidades: 0, margen: 0 };
    acumulado.unidades += fila.unidades;
    acumulado.margen += fila.margen;
    porPlato.set(fila.plato, acumulado);
  }
  return [...porPlato.entries()]
    .filter(([, acumulado]) => acumulado.unidades > 0)
    .map(([plato, acumulado]) => ({
      plato,
      unidades: acumulado.unidades,
      margenUnitario: acumulado.margen / acumulado.unidades,
    }))
    .sort((a, b) => a.plato.localeCompare(b.plato));
}
