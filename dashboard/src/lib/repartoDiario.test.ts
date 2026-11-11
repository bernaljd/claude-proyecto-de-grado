// Los días del reparto (lun..sab) suman exactamente unidades_redondeadas.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { repartoDiario, sumaDelReparto } from './repartoDiario';
import type { FilaPronostico } from './tipos';

const ruta = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', '06_pronostico.csv');
const pronostico = Papa.parse<FilaPronostico>(readFileSync(ruta, 'utf8'), {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
}).data;

describe('reparto por día (06_pronostico.csv real)', () => {
  it('en cada plato con pronóstico, los días suman unidades_redondeadas', () => {
    const conPronostico = pronostico.filter((fila) => fila.unidades_redondeadas !== null);
    expect(conPronostico.length).toBeGreaterThan(0);
    for (const fila of conPronostico) {
      expect(sumaDelReparto(fila), fila.plato).toBe(fila.unidades_redondeadas);
    }
  });

  it('los retirados no tienen reparto (vacíos, no ceros)', () => {
    for (const fila of pronostico.filter((f) => f.estado_plato === 'retirado')) {
      expect(fila.unidades_pronosticadas).toBeNull();
      expect(repartoDiario(fila).every((dia) => dia.unidades === null)).toBe(true);
    }
  });

  it('devuelve los seis días de lunes a sábado en orden', () => {
    const dias = repartoDiario(pronostico[0]).map((dia) => dia.dia);
    expect(dias).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
  });
});
