// Parseo y validación de los CSV con archivos de ejemplo mínimos, y detección
// dinámica de las columnas pred_* (con 3 y con 5 modelos).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarCsv, columnasPrediccion, ErrorDeDatos, limpiarCache } from './cargarCsv';

function respuestaCsv(texto: string): Response {
  return new Response(texto, { status: 200, headers: { 'Content-Type': 'text/csv' } });
}

afterEach(() => {
  limpiarCache();
  vi.unstubAllGlobals();
});

describe('cargarCsv', () => {
  it('lee un CSV mínimo con tipos y convierte los vacíos en null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuestaCsv('plato,unidades,precio\nAbacha,3,\nSuya,0,4.5\n')),
    );
    const filas = await cargarCsv<{ plato: string; unidades: number; precio: number | null }>('x.csv', [
      'plato',
      'unidades',
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0].plato).toBe('Abacha');
    expect(filas[0].unidades).toBe(3);
    expect(filas[0].precio).toBeNull(); // vacío = no disponible, nunca 0
    expect(filas[1].precio).toBe(4.5);
  });

  it('nombra el archivo que falta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(cargarCsv('06_pronostico.csv', ['plato'])).rejects.toThrow(/Falta `06_pronostico.csv`/);
  });

  it('nombra la columna que falta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaCsv('plato,unidades\nAbacha,3\n')));
    await expect(cargarCsv('serie.csv', ['plato', 'margen'])).rejects.toThrow(/falta `margen`/);
  });

  it('avisa cuando el archivo está vacío', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaCsv('plato,unidades\n')));
    await expect(cargarCsv('vacio.csv', ['plato'])).rejects.toThrow(ErrorDeDatos);
  });

  it('detecta las columnas pred_* dinámicamente, con 3 y con 5 modelos', () => {
    const con3 = [{ plato: 'A', y_real: 1, pred_mm4: 0.5, pred_lstm: 0.2, pred_arima: 0.1 }];
    const con5 = [
      { plato: 'A', pred_mm4: 1, pred_gradient_boosting: 2, pred_lstm: 3, pred_arima: 4, pred_sarima: 5 },
    ];
    expect(columnasPrediccion(con3)).toEqual(['pred_mm4', 'pred_lstm', 'pred_arima']);
    expect(columnasPrediccion(con5)).toHaveLength(5);
    expect(columnasPrediccion([])).toEqual([]);
  });
});
