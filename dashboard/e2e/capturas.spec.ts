// RNF-03 y RNF-04: abre cada ruta a 360, 768 y 1280 px de ancho, FALLA si hay
// desplazamiento horizontal de la página, guarda capturas en dashboard/capturas/
// para la tesis y mide que cada vista cargue en menos de 3 segundos.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const carpeta = dirname(fileURLToPath(import.meta.url));

const ANCHOS = [360, 768, 1280];
const TIEMPO_MAXIMO_MS = 3000;

// Un plato modelable real, para las rutas de detalle
const csv = readFileSync(join(carpeta, '..', 'public', 'data', '06_pronostico.csv'), 'utf8');
const lineaModelable = csv.split('\n').find((linea) => linea.includes(',modelable,'))!;
const plato = lineaModelable.split(',')[0];

const RUTAS: [string, string][] = [
  ['/', 'inicio'],
  ['/demanda', 'demanda'],
  [`/demanda/${encodeURIComponent(plato)}`, 'demanda_plato'],
  ['/menu', 'menu'],
  [`/menu/${encodeURIComponent(plato)}`, 'menu_plato'],
  ['/alertas', 'alertas'],
  ['/confiabilidad', 'confiabilidad'],
  ['/datos', 'datos'],
  ['/cargar', 'cargar'],
];

for (const ancho of ANCHOS) {
  for (const [ruta, nombre] of RUTAS) {
    test(`${nombre} a ${ancho}px: sin desplazamiento horizontal y carga en menos de 3 s`, async ({ browser }) => {
      const contexto = await browser.newContext({
        viewport: { width: ancho, height: 860 },
        deviceScaleFactor: 2,
      });
      const pagina = await contexto.newPage();
      const inicio = Date.now();
      await pagina.goto(ruta, { waitUntil: 'networkidle' });
      // La vista está lista cuando ya no hay esqueletos de carga
      await expect(pagina.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: TIEMPO_MAXIMO_MS });
      const duracion = Date.now() - inicio;
      expect(duracion, `la vista ${ruta} tardó ${duracion} ms`).toBeLessThan(TIEMPO_MAXIMO_MS);

      // RNF-03: la página no se desplaza horizontalmente
      const desbordamiento = await pagina.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        visible: document.documentElement.clientWidth,
      }));
      expect(
        desbordamiento.scroll,
        `scrollWidth ${desbordamiento.scroll} > clientWidth ${desbordamiento.visible} en ${ruta}`,
      ).toBeLessThanOrEqual(desbordamiento.visible + 1);

      await pagina.screenshot({ path: `capturas/${ancho}_${nombre}.png`, fullPage: true });
      await contexto.close();
    });
  }
}
