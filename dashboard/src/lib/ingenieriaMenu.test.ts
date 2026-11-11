// (1) La regla de clasificación de Kasavana y Smith.
// (2) La prueba obligatoria de paridad: con el período por defecto (12 semanas),
//     el cálculo del navegador reproduce 06_ingenieria_menu.csv plato por plato
//     (clasificación igual y números con diferencia < 0,001).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { agregarPeriodo, calcularMatriz, clasificar, SEMANAS_POR_DEFECTO, semanasDelPeriodo } from './ingenieriaMenu';
import type { FilaMenu, FilaPronostico, FilaSerie } from './tipos';

const carpetaDatos = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data');

function leerCsv<T>(nombre: string): T[] {
  const texto = readFileSync(join(carpetaDatos, nombre), 'utf8');
  return Papa.parse<T>(texto, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

describe('regla de clasificación (sección Kasavana y Smith)', () => {
  it('clasifica por margen alto (≥ umbral de margen) y popularidad alta (≥ umbral de popularidad)', () => {
    expect(clasificar(5, 10, 4, 2)).toBe('Estrella'); // las dos altas
    expect(clasificar(3, 10, 4, 2)).toBe('Caballo de arado'); // solo popularidad
    expect(clasificar(5, 1, 4, 2)).toBe('Puzzle'); // solo margen
    expect(clasificar(3, 1, 4, 2)).toBe('Perro'); // ninguna
    // El umbral exacto cuenta como alto (≥, no >)
    expect(clasificar(4, 2, 4, 2)).toBe('Estrella');
  });

  it('calcula los umbrales con la fórmula del pipeline', () => {
    const matriz = calcularMatriz([
      { plato: 'A', unidades: 30, margenUnitario: 2 },
      { plato: 'B', unidades: 10, margenUnitario: 6 },
      { plato: 'C', unidades: 0, margenUnitario: 9 }, // sin unidades: no entra
    ]);
    expect(matriz).toHaveLength(2);
    // umbral de margen = (2×30 + 6×10) / 40 = 3; umbral de popularidad = 70 × (1/2) = 35 %
    expect(matriz[0].umbralMargen).toBeCloseTo(3, 10);
    expect(matriz[0].umbralPopularidad).toBeCloseTo(35, 10);
    expect(matriz.find((fila) => fila.plato === 'A')?.clasificacion).toBe('Caballo de arado');
    expect(matriz.find((fila) => fila.plato === 'B')?.clasificacion).toBe('Puzzle');
  });
});

describe('paridad con 06_ingenieria_menu.csv (período por defecto)', () => {
  const serie = leerCsv<FilaSerie>('02_serie_semanal.csv');
  const menu = leerCsv<FilaMenu>('06_ingenieria_menu.csv');
  const pronostico = leerCsv<FilaPronostico>('06_pronostico.csv');
  const semanas = semanasDelPeriodo([...new Set(serie.map((fila) => fila.semana_inicio))], {
    tipo: 'semanas',
    semanas: SEMANAS_POR_DEFECTO,
  });

  it('reproduce el escenario histórico plato por plato', () => {
    const recalculada = calcularMatriz(agregarPeriodo(serie, semanas));
    const historico = menu.filter((fila) => fila.escenario === 'historico');
    expect(recalculada.length).toBe(historico.length);
    for (const filaCsv of historico) {
      const propia = recalculada.find((fila) => fila.plato === filaCsv.plato);
      expect(propia, `falta ${filaCsv.plato}`).toBeDefined();
      expect(propia!.clasificacion, filaCsv.plato).toBe(filaCsv.clasificacion);
      expect(Math.abs(propia!.unidades - filaCsv.unidades), `unidades de ${filaCsv.plato}`).toBeLessThan(0.001);
      expect(Math.abs(propia!.margenUnitario - filaCsv.margen_unitario), `margen de ${filaCsv.plato}`).toBeLessThan(0.001);
      expect(Math.abs(propia!.popularidadPct - filaCsv.popularidad_pct), `popularidad de ${filaCsv.plato}`).toBeLessThan(0.001);
      expect(Math.abs(propia!.umbralMargen - filaCsv.umbral_margen)).toBeLessThan(0.001);
      expect(Math.abs(propia!.umbralPopularidad - filaCsv.umbral_popularidad)).toBeLessThan(0.001);
    }
  });

  it('reproduce el escenario proyectado con las unidades pronosticadas y el margen histórico', () => {
    const margenPeriodo = new Map(agregarPeriodo(serie, semanas).map((fila) => [fila.plato, fila.margenUnitario]));
    const margenCsv = new Map<string, number>();
    for (const fila of menu) {
      if (!margenCsv.has(fila.plato)) margenCsv.set(fila.plato, fila.margen_unitario);
    }
    const entradas = pronostico
      .filter((fila) => (fila.unidades_pronosticadas ?? 0) > 0)
      .map((fila) => ({
        plato: fila.plato,
        unidades: fila.unidades_pronosticadas as number,
        margenUnitario: margenPeriodo.get(fila.plato) ?? margenCsv.get(fila.plato) ?? NaN,
      }))
      .filter((fila) => Number.isFinite(fila.margenUnitario));
    const recalculada = calcularMatriz(entradas);
    const proyectado = menu.filter((fila) => fila.escenario === 'proyectado');
    expect(recalculada.length).toBe(proyectado.length);
    for (const filaCsv of proyectado) {
      const propia = recalculada.find((fila) => fila.plato === filaCsv.plato);
      expect(propia, `falta ${filaCsv.plato}`).toBeDefined();
      expect(propia!.clasificacion, filaCsv.plato).toBe(filaCsv.clasificacion);
      expect(Math.abs(propia!.margenUnitario - filaCsv.margen_unitario), `margen de ${filaCsv.plato}`).toBeLessThan(0.001);
      expect(Math.abs(propia!.popularidadPct - filaCsv.popularidad_pct), `popularidad de ${filaCsv.plato}`).toBeLessThan(0.001);
    }
  });
});
