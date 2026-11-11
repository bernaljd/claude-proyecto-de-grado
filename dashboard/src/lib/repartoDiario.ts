// Reparto por día del pronóstico: solo LEE las columnas lun..sab de
// 06_pronostico.csv; no recalcula nada.
import type { FilaPronostico } from './tipos';

export const DIAS_REPARTO = [
  { columna: 'lun', nombre: 'Lunes', corto: 'Lun' },
  { columna: 'mar', nombre: 'Martes', corto: 'Mar' },
  { columna: 'mie', nombre: 'Miércoles', corto: 'Mié' },
  { columna: 'jue', nombre: 'Jueves', corto: 'Jue' },
  { columna: 'vie', nombre: 'Viernes', corto: 'Vie' },
  { columna: 'sab', nombre: 'Sábado', corto: 'Sáb' },
] as const;

export interface DiaReparto {
  dia: string;
  corto: string;
  unidades: number | null;
}

export function repartoDiario(fila: FilaPronostico): DiaReparto[] {
  return DIAS_REPARTO.map(({ columna, nombre, corto }) => ({
    dia: nombre,
    corto,
    unidades: (fila[columna] as number | null) ?? null,
  }));
}

/** La suma de los días; debe ser igual a unidades_redondeadas (hay una prueba que lo exige). */
export function sumaDelReparto(fila: FilaPronostico): number | null {
  const valores = repartoDiario(fila).map((dia) => dia.unidades);
  if (valores.some((valor) => valor === null)) return null;
  return (valores as number[]).reduce((suma, valor) => suma + valor, 0);
}

/** De dónde salió la participación diaria, en lenguaje claro. */
export function textoReparto(fila: FilaPronostico): string {
  switch (fila.reparto_dia_segun) {
    case 'plato':
      return 'según los días en que se suele pedir este plato';
    case 'categoria':
      return 'según los días en que se pide su categoría (el plato vendió poco para usar su propio patrón)';
    case 'menu':
      return 'según los días en que se pide el menú completo';
    default:
      return '';
  }
}
