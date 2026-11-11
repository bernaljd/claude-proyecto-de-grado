// Formato en español (Colombia): decimales con coma, miles con punto,
// fechas «29 dic 2025» y moneda «£4,02».

const formatosNumero = new Map<string, Intl.NumberFormat>();

function formato(decimales: number): Intl.NumberFormat {
  const clave = String(decimales);
  if (!formatosNumero.has(clave)) {
    formatosNumero.set(
      clave,
      new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      }),
    );
  }
  return formatosNumero.get(clave)!;
}

/** Número con los decimales pedidos; un valor vacío se muestra como «—», jamás como 0. */
export function numero(valor: number | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return formato(decimales).format(valor);
}

/** Moneda del restaurante (libras): «£4,02». */
export function moneda(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return `£${numero(valor, decimales)}`;
}

/** Porcentaje: «12,5 %». */
export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return `${numero(valor, decimales)} %`;
}

/**
 * Unidades pronosticadas: con 1 decimal («0,3 unidades»), porque redondear a 0
 * sería engañoso. Las unidades observadas (enteras) van sin decimales.
 */
export function unidadesPronosticadas(valor: number | null | undefined): string {
  return numero(valor, 1);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** Fecha ISO «2025-12-29» como «29 dic 2025». */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return '—';
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

/** Día de la semana (0 = lunes ... 6 = domingo) de una fecha ISO, sin zonas horarias. */
export function diaDeLaSemana(iso: string): number {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  const indice = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0 = domingo
  return (indice + 6) % 7;
}

/** «mié 31 dic» para la nota de semana incompleta. */
export function fechaConDia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return '—';
  return `${DIAS_SEMANA[diaDeLaSemana(iso)]} ${dia} ${MESES[mes - 1]}`;
}

/** Fecha y hora ISO como «29 dic 2025, 14:05». */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = fechaCorta(iso);
  const hora = iso.length > 10 ? iso.slice(11, 16) : '';
  return hora ? `${fecha}, ${hora}` : fecha;
}
