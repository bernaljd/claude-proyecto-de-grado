// RNF-02: los términos técnicos (MAE, RMSE, SMAPE, nombres de modelos,
// hiperparámetros) solo pueden aparecer en «Confiabilidad» y «Datos y fuentes».
// Este test renderiza todas las demás vistas con los CSV reales y busca esas
// palabras en el texto; en la vista de demanda se permiten únicamente dentro
// del desplegable «Ver detalle técnico».
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, waitFor } from '@testing-library/react';
import Papa from 'papaparse';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DatosProvider } from './DatosContext';
import { limpiarCache } from './lib/cargarCsv';
import type { FilaPronostico } from './lib/tipos';

const carpetaDatos = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

const PALABRAS_PROHIBIDAS = ['MAE', 'RMSE', 'SMAPE', 'LSTM', 'ARIMA', 'SARIMA', 'GradientBoosting', 'MM4', 'hiperparámetro'];

beforeAll(() => {
  // Recharts necesita ResizeObserver, que jsdom no trae
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // fetch sirve los CSV reales de public/data/
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const nombre = String(url).split('/').pop()!;
      try {
        const texto = readFileSync(join(carpetaDatos, nombre), 'utf8');
        return new Response(texto, { status: 200 });
      } catch {
        return new Response('', { status: 404 });
      }
    }),
  );
});

afterEach(() => {
  cleanup();
  limpiarCache();
});

const pronostico = Papa.parse<FilaPronostico>(readFileSync(join(carpetaDatos, '06_pronostico.csv'), 'utf8'), {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
}).data;
const platoModelable = pronostico.find((fila) => fila.estado_plato === 'modelable')!.plato;

async function renderizar(ruta: string): Promise<HTMLElement> {
  const { container } = render(
    <MemoryRouter initialEntries={[ruta]}>
      <DatosProvider>
        <App />
      </DatosProvider>
    </MemoryRouter>,
  );
  await waitFor(
    () => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(container.textContent?.length ?? 0).toBeGreaterThan(200);
    },
    { timeout: 10000 },
  );
  return container;
}

function palabrasEncontradas(texto: string): string[] {
  return PALABRAS_PROHIBIDAS.filter((palabra) => texto.includes(palabra));
}

describe('RNF-02: sin términos técnicos fuera de Confiabilidad y Datos', () => {
  const rutas = ['/', '/demanda', '/menu', '/alertas', '/cargar', `/menu/${encodeURIComponent(platoModelable)}`];

  for (const ruta of rutas) {
    it(`la vista ${ruta} no muestra términos técnicos`, async () => {
      const container = await renderizar(ruta);
      expect(palabrasEncontradas(container.textContent ?? '')).toEqual([]);
    });
  }

  it(`en /demanda/:plato solo se permiten dentro de «Ver detalle técnico»`, async () => {
    const container = await renderizar(`/demanda/${encodeURIComponent(platoModelable)}`);
    for (const desplegable of container.querySelectorAll('details')) {
      const resumen = desplegable.querySelector('summary')?.textContent ?? '';
      expect(resumen).toContain('Ver detalle técnico');
      desplegable.remove();
    }
    expect(palabrasEncontradas(container.textContent ?? '')).toEqual([]);
  });

  it('las vistas técnicas (/confiabilidad y /datos) sí renderizan con sus términos', async () => {
    const confiabilidad = await renderizar('/confiabilidad');
    expect(confiabilidad.textContent).toContain('MAE');
    cleanup();
    limpiarCache();
    const datos = await renderizar('/datos');
    expect(datos.textContent).toContain('M1');
  });
});
