// Validación en el navegador de un CSV de ventas (vista «Cargar datos»).
// Solo revisa: no guarda nada, no predice nada y el archivo no sale del navegador.
import Papa from 'papaparse';
import { COLUMNAS_ENTRADA, DESCRIPCION_COLUMNAS } from './columnasEntrada';

export interface ResumenValidacion {
  columnasFaltantes: string[]; // con su descripción operativa
  registrosLeidos: number;
  registrosValidos: number;
  excluidos: { motivo: string; filas: number }[];
  fechaMinima: string | null;
  fechaMaxima: string | null;
  numeroPlatos: number;
}

function fechaValida(texto: unknown): string | null {
  // El formato del restaurante es día/mes/año
  if (typeof texto !== 'string') return null;
  const partes = texto.trim().split('/');
  if (partes.length !== 3) return null;
  const [dia, mes, anio] = partes.map(Number);
  if (!dia || !mes || !anio || mes > 12 || dia > 31) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function validarVentas(texto: string): ResumenValidacion {
  const resultado = Papa.parse<Record<string, unknown>>(texto, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const columnasPresentes = new Set(resultado.meta.fields ?? []);
  const columnasFaltantes = COLUMNAS_ENTRADA.filter((columna) => !columnasPresentes.has(columna)).map(
    (columna) => `${columna} (${DESCRIPCION_COLUMNAS[columna]})`,
  );

  let cancelados = 0;
  let cantidadInvalida = 0;
  let precioInvalido = 0;
  let fechaInvalida = 0;
  let validos = 0;
  let fechaMinima: string | null = null;
  let fechaMaxima: string | null = null;
  const platos = new Set<string>();

  if (columnasFaltantes.length === 0) {
    for (const fila of resultado.data) {
      if (String(fila['Cancelled']).trim().toLowerCase() === 'yes') {
        cancelados += 1;
        continue;
      }
      const cantidad = Number(fila['Quantity']);
      if (!(cantidad > 0)) {
        cantidadInvalida += 1;
        continue;
      }
      const precio = Number(fila['Price Per Item']);
      if (!(precio >= 0)) {
        precioInvalido += 1;
        continue;
      }
      const fecha = fechaValida(fila['Date']);
      if (!fecha) {
        fechaInvalida += 1;
        continue;
      }
      validos += 1;
      if (!fechaMinima || fecha < fechaMinima) fechaMinima = fecha;
      if (!fechaMaxima || fecha > fechaMaxima) fechaMaxima = fecha;
      const plato = fila['Line item name'];
      if (typeof plato === 'string' && plato.trim() !== '') platos.add(plato.trim());
    }
  }

  const excluidos = [
    { motivo: 'Pedidos cancelados', filas: cancelados },
    { motivo: 'Cantidad en cero o negativa', filas: cantidadInvalida },
    { motivo: 'Precio negativo', filas: precioInvalido },
    { motivo: 'Fecha que no se puede leer', filas: fechaInvalida },
  ].filter((grupo) => grupo.filas > 0);

  return {
    columnasFaltantes,
    registrosLeidos: resultado.data.length,
    registrosValidos: validos,
    excluidos,
    fechaMinima,
    fechaMaxima,
    numeroPlatos: platos.size,
  };
}
