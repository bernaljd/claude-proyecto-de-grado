// Lectura de los CSV de public/data/ con PapaParse: valida columnas, cachea en
// memoria y convierte las celdas vacías en null (un vacío no es un 0).
import Papa from 'papaparse';

const cache = new Map<string, Promise<Record<string, unknown>[]>>();

export class ErrorDeDatos extends Error {
  archivo: string;
  constructor(archivo: string, mensaje: string) {
    super(mensaje);
    this.archivo = archivo;
  }
}

function limpiarFila(fila: Record<string, unknown>): Record<string, unknown> {
  const limpia: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(fila)) {
    limpia[clave] = valor === '' || valor === undefined ? null : valor;
  }
  return limpia;
}

async function leer(nombre: string): Promise<Record<string, unknown>[]> {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}data/${nombre}`);
  } catch {
    throw new ErrorDeDatos(nombre, `No se pudo descargar \`${nombre}\`. Revise la conexión y recargue la página.`);
  }
  if (!respuesta.ok) {
    throw new ErrorDeDatos(nombre, `Falta \`${nombre}\`. Corra \`npm run actualizar\` y recargue la página.`);
  }
  const texto = await respuesta.text();
  // Un servidor de un solo origen (Vercel) responde el index.html cuando el archivo no existe
  if (texto.trimStart().startsWith('<')) {
    throw new ErrorDeDatos(nombre, `Falta \`${nombre}\`. Corra \`npm run actualizar\` y recargue la página.`);
  }
  const resultado = Papa.parse<Record<string, unknown>>(texto, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  if (resultado.data.length === 0) {
    throw new ErrorDeDatos(nombre, `\`${nombre}\` está vacío. Corra \`npm run actualizar\`.`);
  }
  return resultado.data.map(limpiarFila);
}

/**
 * Lee un CSV de public/data/. `columnasEsperadas` son las columnas que deben
 * existir; si falta alguna se lanza un error que nombra el archivo y la columna.
 */
export async function cargarCsv<T>(nombre: string, columnasEsperadas: string[]): Promise<T[]> {
  if (!cache.has(nombre)) {
    cache.set(nombre, leer(nombre));
  }
  const filas = await cache.get(nombre)!;
  const presentes = new Set(Object.keys(filas[0] ?? {}));
  const faltantes = columnasEsperadas.filter((columna) => !presentes.has(columna));
  if (faltantes.length > 0) {
    throw new ErrorDeDatos(
      nombre,
      `\`${nombre}\` no tiene las columnas esperadas (falta ${faltantes.map((c) => `\`${c}\``).join(', ')}). ` +
        'Corra `npm run actualizar` para regenerarlo.',
    );
  }
  return filas as T[];
}

/** Columnas pred_* presentes en las filas (una por modelo, detectadas dinámicamente). */
export function columnasPrediccion(filas: Record<string, unknown>[]): string[] {
  if (filas.length === 0) return [];
  return Object.keys(filas[0]).filter((columna) => columna.startsWith('pred_'));
}

/** Solo para pruebas: limpia la caché entre casos. */
export function limpiarCache(): void {
  cache.clear();
}
