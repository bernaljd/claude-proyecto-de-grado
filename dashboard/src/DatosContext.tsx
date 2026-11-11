// Carga todos los CSV una sola vez al abrir y los expone a las vistas.
// Cada archivo que falle queda registrado en `errores`: la vista afectada
// muestra el mensaje y las demás siguen funcionando.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cargarCsv, columnasPrediccion, ErrorDeDatos } from './lib/cargarCsv';
import { diaDeLaSemana } from './lib/formato';
import type {
  FilaEntrenamiento,
  FilaMatrizConfusion,
  FilaMenu,
  FilaMetrica,
  FilaParticion,
  FilaPlatoModelable,
  FilaPrediccion,
  FilaPronostico,
  FilaSerie,
  FilaVenta,
  Manifiesto,
} from './lib/tipos';

export interface Datos {
  cargando: boolean;
  errores: Record<string, string>; // nombre de archivo -> mensaje
  ventas?: FilaVenta[];
  serie?: FilaSerie[];
  particion?: FilaParticion[];
  platosModelables?: FilaPlatoModelable[];
  entrenamiento?: FilaEntrenamiento[];
  matrizConfusionValidacion?: FilaMatrizConfusion[];
  predicciones?: FilaPrediccion[];
  metricas?: FilaMetrica[];
  matrizConfusionPrueba?: FilaMatrizConfusion[];
  pronostico?: FilaPronostico[];
  menu?: FilaMenu[];
  manifiesto?: Manifiesto;
  /** Última fecha con datos (de 01_ventas_limpias.csv). */
  ultimaFecha?: string;
  /** La última semana está incompleta si la última fecha con datos no es sábado. */
  semanaIncompleta: boolean;
  /** Columnas pred_* de 06_pronostico.csv (una por modelo, dinámicas). */
  columnasPred: string[];
  /** Columnas pred_* de 05_predicciones.csv. */
  columnasPredPrueba: string[];
}

const contexto = createContext<Datos>({ cargando: true, errores: {}, semanaIncompleta: false, columnasPred: [], columnasPredPrueba: [] });

const COLUMNAS: Record<string, string[]> = {
  '01_ventas_limpias.csv': ['id_pedido', 'fecha', 'dia_semana', 'hora', 'plato', 'categoria', 'cantidad', 'precio_unitario', 'ventas_brutas', 'costo', 'margen'],
  '02_serie_semanal.csv': ['semana_inicio', 'plato', 'categoria', 'unidades', 'ventas', 'costo', 'margen', 'precio_unitario', 'activo'],
  '03_particion_semanas.csv': ['semana_inicio', 'conjunto'],
  '03_platos_modelables.csv': ['plato', 'primera_venta', 'ultima_venta', 'semanas_historia', 'estado_plato'],
  '04_entrenamiento.csv': ['modelo', 'combinacion', 'hiperparametros', 'semilla', 'mae_validacion', 'rmse_validacion', 'smape_validacion', 'mejor_del_modelo', 'vigente'],
  '04_matriz_confusion.csv': ['modelo', 'vp', 'fp', 'fn', 'vn'],
  '05_predicciones.csv': ['fila_id', 'plato', 'semana_objetivo', 'conjunto', 'y_real'],
  '05_metricas.csv': ['modelo', 'conjunto', 'n', 'mae', 'rmse', 'smape', 'accuracy', 'accuracy_sobre_cero', 'precision', 'recall', 'f1', 'wape', 'mase', 'mae_con_venta', 'unidades_reales', 'unidades_pronosticadas', 'sesgo', 'supera_mm4', 'exito', 'vigente'],
  '05_matriz_confusion.csv': ['modelo', 'vp', 'fp', 'fn', 'vn'],
  '06_pronostico.csv': ['plato', 'categoria', 'estado_plato', 'semana_pronostico', 'unidades_ultima_semana', 'unidades_pronosticadas', 'unidades_redondeadas', 'metodo', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'reparto_dia_segun'],
  '06_ingenieria_menu.csv': ['escenario', 'plato', 'unidades', 'margen_unitario', 'popularidad_pct', 'umbral_margen', 'umbral_popularidad', 'clasificacion', 'cambia_de_categoria', 'accion_sugerida'],
};

export function DatosProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos>({ cargando: true, errores: {}, semanaIncompleta: false, columnasPred: [], columnasPredPrueba: [] });

  useEffect(() => {
    let activo = true;

    async function conError<T>(nombre: string, errores: Record<string, string>): Promise<T[] | undefined> {
      try {
        return await cargarCsv<T>(nombre, COLUMNAS[nombre]);
      } catch (error) {
        errores[nombre] = error instanceof ErrorDeDatos ? error.message : `No se pudo leer \`${nombre}\`.`;
        return undefined;
      }
    }

    async function cargarTodo() {
      const errores: Record<string, string> = {};
      const [ventas, serie, particion, platosModelables, entrenamiento, matrizConfusionValidacion, predicciones, metricas, matrizConfusionPrueba, pronostico, menu] = await Promise.all([
        conError<FilaVenta>('01_ventas_limpias.csv', errores),
        conError<FilaSerie>('02_serie_semanal.csv', errores),
        conError<FilaParticion>('03_particion_semanas.csv', errores),
        conError<FilaPlatoModelable>('03_platos_modelables.csv', errores),
        conError<FilaEntrenamiento>('04_entrenamiento.csv', errores),
        conError<FilaMatrizConfusion>('04_matriz_confusion.csv', errores),
        conError<FilaPrediccion>('05_predicciones.csv', errores),
        conError<FilaMetrica>('05_metricas.csv', errores),
        conError<FilaMatrizConfusion>('05_matriz_confusion.csv', errores),
        conError<FilaPronostico>('06_pronostico.csv', errores),
        conError<FilaMenu>('06_ingenieria_menu.csv', errores),
      ]);

      let manifiesto: Manifiesto | undefined;
      try {
        const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        const respuesta = await fetch(`${base}data/manifiesto.json`);
        if (respuesta.ok) manifiesto = (await respuesta.json()) as Manifiesto;
        else errores['manifiesto.json'] = 'Falta `manifiesto.json`. Corra `npm run actualizar`.';
      } catch {
        errores['manifiesto.json'] = 'No se pudo leer `manifiesto.json`.';
      }

      const ultimaFecha = ventas?.reduce<string | undefined>(
        (maxima, fila) => (!maxima || fila.fecha > maxima ? fila.fecha : maxima),
        undefined,
      );
      // La semana va de lunes a sábado (no se vende domingos): si la última
      // fecha con datos no es sábado, la última semana está incompleta.
      const semanaIncompleta = ultimaFecha !== undefined && diaDeLaSemana(ultimaFecha) !== 5;

      if (!activo) return;
      setDatos({
        cargando: false,
        errores,
        ventas,
        serie,
        particion,
        platosModelables,
        entrenamiento,
        matrizConfusionValidacion,
        predicciones,
        metricas,
        matrizConfusionPrueba,
        pronostico,
        menu,
        manifiesto,
        ultimaFecha,
        semanaIncompleta,
        columnasPred: columnasPrediccion((pronostico as Record<string, unknown>[] | undefined) ?? []),
        columnasPredPrueba: columnasPrediccion((predicciones as Record<string, unknown>[] | undefined) ?? []),
      });
    }

    void cargarTodo();
    return () => {
      activo = false;
    };
  }, []);

  const valor = useMemo(() => datos, [datos]);
  return <contexto.Provider value={valor}>{children}</contexto.Provider>;
}

export function useDatos(): Datos {
  return useContext(contexto);
}
