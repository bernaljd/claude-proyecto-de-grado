// Datos y fuentes (6.8): de dónde sale cada cifra. Una tarjeta por CSV del
// manifiesto con descarga y una tabla paginada, y la cadena M1 → M6 → dashboard.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Table } from 'lucide-react';
import Papa from 'papaparse';
import { useDatos } from '../DatosContext';
import { Encabezado, ErrorArchivo, Esqueleto } from '../componentes/comunes';
import { fechaHora, numero } from '../lib/formato';

const FILAS_POR_PAGINA = 50;

// Qué contiene cada CSV y qué significan sus columnas (de la especificación del pipeline)
const DESCRIPCIONES: Record<string, { texto: string; vistas: { ruta: string; nombre: string }[]; destacado?: string; columnas: Record<string, string> }> = {
  '01_ventas_limpias.csv': {
    texto: 'Una fila por línea de pedido válida: las ventas reales después de la limpieza (OBS).',
    vistas: [
      { ruta: '/', nombre: 'Inicio' },
      { ruta: '/cargar', nombre: 'Cargar datos' },
    ],
    columnas: {
      id_pedido: 'número del pedido',
      fecha: 'fecha del pedido (ISO)',
      dia_semana: 'día de la semana',
      hora: 'hora del pedido',
      plato: 'nombre del plato',
      categoria: 'categoría del menú',
      cantidad: 'unidades pedidas',
      precio_unitario: 'precio por unidad (£)',
      ventas_brutas: 'venta de la línea (£)',
      costo: 'costo estimado (£)',
      margen: 'ganancia estimada (£)',
    },
  },
  '02_serie_semanal.csv': {
    texto: 'Historia de ventas: una fila por plato y semana (la semana empieza el lunes) (OBS).',
    vistas: [
      { ruta: '/', nombre: 'Inicio' },
      { ruta: '/demanda', nombre: 'Demanda' },
      { ruta: '/menu', nombre: 'Ingeniería de menú' },
    ],
    columnas: {
      semana_inicio: 'lunes de la semana',
      plato: 'nombre del plato',
      categoria: 'categoría del menú',
      unidades: 'unidades vendidas en la semana',
      ventas: 'ventas de la semana (£)',
      costo: 'costo de la semana (£)',
      margen: 'margen de la semana (£, ventas − costo)',
      precio_unitario: 'precio de la semana (£; vacío en semanas inactivas)',
      activo: '1 desde la primera venta del plato',
    },
  },
  '03_particion_semanas.csv': {
    texto: 'Qué semanas se usaron para entrenar, validar y probar los modelos.',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    columnas: {
      semana_inicio: 'lunes de la semana',
      conjunto: 'entrenamiento, validacion o prueba',
    },
  },
  '03_platos_modelables.csv': {
    texto: 'El estado de cada plato: modelable, con historial insuficiente o retirado.',
    vistas: [{ ruta: '/demanda', nombre: 'Demanda' }],
    columnas: {
      plato: 'nombre del plato',
      primera_venta: 'semana de su primera venta',
      ultima_venta: 'semana de su última venta',
      semanas_historia: 'semanas desde la primera venta',
      estado_plato: 'modelable, historial_insuficiente o retirado',
    },
  },
  '04_entrenamiento.csv': {
    texto: 'La búsqueda de hiperparámetros en validación: una fila por combinación probada (CALC).',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    columnas: {
      modelo: 'modelo de la combinación (las filas LSTM_escalado y nivel no son modelos)',
      combinacion: 'número de la combinación',
      hiperparametros: 'hiperparámetros probados',
      semilla: 'semilla aleatoria',
      mae_validacion: 'error absoluto medio en validación',
      rmse_validacion: 'raíz del error cuadrático medio',
      smape_validacion: 'error porcentual simétrico (%)',
      accuracy_validacion: 'acierto en «semana con venta» (0 a 1)',
      precision_validacion: 'precisión de «semana con venta»',
      recall_validacion: 'cobertura de «semana con venta»',
      f1_validacion: 'equilibrio entre precisión y cobertura',
      mejor_del_modelo: 'sí en la mejor combinación de cada modelo',
      vigente: 'sí en el modelo vigente de M4',
    },
  },
  '04_matriz_confusion.csv': {
    texto: 'Aciertos y errores de «semana con venta» en validación, por modelo.',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    columnas: {
      modelo: 'modelo evaluado',
      vp: 'dijo venta y hubo venta',
      fp: 'dijo venta y no hubo',
      fn: 'no dijo venta y sí hubo',
      vn: 'no dijo venta y no hubo',
    },
  },
  '05_predicciones.csv': {
    texto: 'Las únicas predicciones fila por fila: lo pronosticado y lo real en las 26 semanas de prueba (OBS y PRED).',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    destacado: 'De aquí salen las predicciones comparables con la realidad.',
    columnas: {
      fila_id: 'número de la fila',
      plato: 'nombre del plato',
      semana_objetivo: 'semana pronosticada',
      conjunto: 'siempre prueba',
      y_real: 'unidades reales (OBS)',
    },
  },
  '05_metricas.csv': {
    texto: 'El error de cada modelo en prueba, más la referencia «Siempre 0» (CALC).',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    columnas: {
      modelo: 'modelo evaluado (la fila Siempre 0 es una referencia, no un modelo)',
      conjunto: 'siempre prueba',
      n: 'filas evaluadas',
      mae: 'error absoluto medio (unidades)',
      rmse: 'raíz del error cuadrático medio',
      smape: 'error porcentual simétrico (%)',
      accuracy: 'acierto en «semana con venta» (0 a 1)',
      accuracy_sobre_cero: 'puntos de acierto sobre la referencia Siempre 0',
      precision: 'precisión de «semana con venta»',
      recall: 'cobertura de «semana con venta»',
      f1: 'equilibrio entre precisión y cobertura',
      wape: 'error absoluto sobre las unidades reales (%)',
      mase: 'error frente a repetir la semana anterior',
      mae_con_venta: 'error medio solo en semanas con venta',
      unidades_reales: 'unidades reales del período de prueba',
      unidades_pronosticadas: 'unidades que pronosticó el modelo',
      sesgo: 'pronosticado frente a real (%)',
      supera_mm4: 'en cuántas de 3 métricas le gana a la media móvil (0 a 3)',
      exito: 'sí si le gana en al menos 2 de 3',
      vigente: 'sí en el modelo vigente',
    },
  },
  '05_matriz_confusion.csv': {
    texto: 'Aciertos y errores de «semana con venta» en prueba, por modelo.',
    vistas: [{ ruta: '/confiabilidad', nombre: 'Confiabilidad' }],
    columnas: {
      modelo: 'modelo evaluado',
      vp: 'dijo venta y hubo venta',
      fp: 'dijo venta y no hubo',
      fn: 'no dijo venta y sí hubo',
      vn: 'no dijo venta y no hubo',
    },
  },
  '06_pronostico.csv': {
    texto: 'El pronóstico de la semana siguiente: una fila por plato, con su reparto por día (PRED y CALC).',
    vistas: [
      { ruta: '/', nombre: 'Inicio' },
      { ruta: '/demanda', nombre: 'Demanda' },
    ],
    destacado: 'De aquí salen las predicciones que ve el restaurante.',
    columnas: {
      plato: 'nombre del plato',
      categoria: 'categoría del menú',
      estado_plato: 'modelable, historial_insuficiente o retirado',
      semana_pronostico: 'lunes de la semana pronosticada',
      unidades_ultima_semana: 'unidades de la última semana observada (OBS)',
      unidades_pronosticadas: 'unidades esperadas (decimal; vacío en retirados)',
      unidades_redondeadas: 'el pronóstico redondeado (la suma de los días)',
      metodo: 'modelo que hizo el pronóstico, media_movil o ninguno',
      lun: 'unidades del lunes',
      mar: 'unidades del martes',
      mie: 'unidades del miércoles',
      jue: 'unidades del jueves',
      vie: 'unidades del viernes',
      sab: 'unidades del sábado',
      reparto_dia_segun: 'de dónde salió la participación diaria (plato, categoria o menu)',
    },
  },
  '06_ingenieria_menu.csv': {
    texto: 'La matriz de ingeniería de menú: una fila por plato y escenario (histórico y proyectado) (CALC).',
    vistas: [
      { ruta: '/menu', nombre: 'Ingeniería de menú' },
      { ruta: '/alertas', nombre: 'Alertas' },
    ],
    columnas: {
      escenario: 'historico (últimas 12 semanas) o proyectado (semana pronosticada)',
      plato: 'nombre del plato',
      unidades: 'unidades del escenario',
      margen_unitario: 'margen por unidad (£, margen / unidades)',
      popularidad_pct: 'porcentaje de las unidades del escenario',
      umbral_margen: 'margen ponderado del menú (£)',
      umbral_popularidad: '70 % × 100 / N, con N platos del escenario',
      clasificacion: 'Estrella, Caballo de arado, Puzzle o Perro',
      cambia_de_categoria: 'sí si la clasificación proyectada difiere de la histórica',
      accion_sugerida: 'acción sugerida (informativa)',
    },
  },
};

const CADENA = [
  { modulo: 'M1', salida: '01_ventas_limpias.csv' },
  { modulo: 'M2', salida: '02_serie_semanal.csv' },
  { modulo: 'M3', salida: '03_particion_semanas.csv, 03_platos_modelables.csv' },
  { modulo: 'M4', salida: '04_entrenamiento.csv, 04_matriz_confusion.csv' },
  { modulo: 'M5', salida: '05_predicciones.csv, 05_metricas.csv, 05_matriz_confusion.csv' },
  { modulo: 'M6', salida: '06_pronostico.csv, 06_ingenieria_menu.csv' },
];

function TablaArchivo({ nombre }: { nombre: string }) {
  const [filas, setFilas] = useState<Record<string, unknown>[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<{ columna: string; ascendente: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const respuesta = await fetch(`/data/${nombre}`);
      if (!respuesta.ok) throw new Error();
      const texto = await respuesta.text();
      const resultado = Papa.parse<Record<string, unknown>>(texto, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
      setFilas(resultado.data);
    } catch {
      setError(`No se pudo leer \`${nombre}\`.`);
    }
  }

  const visibles = useMemo(() => {
    if (!filas) return [];
    let lista = filas;
    if (busqueda.trim() !== '') {
      const texto = busqueda.trim().toLowerCase();
      lista = lista.filter((fila) =>
        Object.values(fila).some((valor) => String(valor ?? '').toLowerCase().includes(texto)),
      );
    }
    if (orden) {
      const { columna, ascendente } = orden;
      lista = [...lista].sort((a, b) => {
        const x = a[columna];
        const y = b[columna];
        const comparacion =
          typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
        return ascendente ? comparacion : -comparacion;
      });
    }
    return lista;
  }, [filas, busqueda, orden]);

  if (error) return <p className="nota">{error}</p>;
  if (!filas) {
    return (
      <button type="button" className="boton boton-secundario" onClick={() => void cargar()}>
        <Table aria-hidden size={16} /> Ver datos
      </button>
    );
  }

  const columnas = Object.keys(filas[0] ?? {});
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const significados = DESCRIPCIONES[nombre]?.columnas ?? {};

  return (
    <div>
      <div className="fila-controles">
        <label>
          Buscar en el archivo
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
              setPagina(0);
            }}
          />
        </label>
        <span className="nota">{numero(visibles.length)} filas</span>
      </div>
      <div className="tabla-envoltura" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="tabla">
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th key={columna} title={significados[columna] ?? columna}>
                  <button
                    type="button"
                    onClick={() =>
                      setOrden((actual) =>
                        actual?.columna === columna
                          ? { columna, ascendente: !actual.ascendente }
                          : { columna, ascendente: true },
                      )
                    }
                  >
                    {columna}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles
              .slice(paginaActual * FILAS_POR_PAGINA, (paginaActual + 1) * FILAS_POR_PAGINA)
              .map((fila, indice) => (
                <tr key={indice}>
                  {columnas.map((columna) => (
                    <td key={columna} className={typeof fila[columna] === 'number' ? 'numero' : undefined}>
                      {fila[columna] === null || fila[columna] === undefined || fila[columna] === ''
                        ? '—'
                        : String(fila[columna])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <button
          type="button"
          className="boton boton-secundario"
          disabled={paginaActual === 0}
          onClick={() => setPagina(paginaActual - 1)}
        >
          Anterior
        </button>
        <span className="nota">
          Página {numero(paginaActual + 1)} de {numero(totalPaginas)}
        </span>
        <button
          type="button"
          className="boton boton-secundario"
          disabled={paginaActual >= totalPaginas - 1}
          onClick={() => setPagina(paginaActual + 1)}
        >
          Siguiente
        </button>
      </div>
      <p className="nota">Pase el cursor por el encabezado de una columna para ver qué significa.</p>
    </div>
  );
}

export default function Datos() {
  const { cargando, manifiesto } = useDatos();

  if (cargando) return <Esqueleto cantidad={3} alto={120} />;

  return (
    <>
      <Encabezado titulo="Datos y fuentes">
        Aquí se ve de dónde sale cada predicción y cada cifra del dashboard: qué módulo del pipeline genera
        cada archivo, cuándo se calculó y su contenido completo.
      </Encabezado>
      <ErrorArchivo archivos={['manifiesto.json']} />

      <section className="tarjeta">
        <h2>La cadena de cálculo</h2>
        <p className="suave">
          Los datos pasan por seis módulos de Python en el computador; el dashboard solo lee sus archivos.
        </p>
        <div className="cadena-modulos">
          {CADENA.map((paso) => (
            <span key={paso.modulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="modulo" title={`Genera: ${paso.salida}`}>
                {paso.modulo}
              </span>
              <ArrowRight aria-hidden size={14} />
            </span>
          ))}
          <span className="modulo" style={{ background: 'var(--morado-900)' }}>
            dashboard
          </span>
        </div>
        <ul className="nota" style={{ marginBottom: 0 }}>
          {CADENA.map((paso) => (
            <li key={paso.modulo}>
              <strong>{paso.modulo}</strong> produce {paso.salida}
            </li>
          ))}
        </ul>
      </section>

      {manifiesto?.archivos.map((archivo) => {
        const descripcion = DESCRIPCIONES[archivo.nombre];
        return (
          <section key={archivo.nombre} className="tarjeta">
            <h2>
              <code>{archivo.nombre}</code>
            </h2>
            {descripcion?.destacado && (
              <p>
                <span className="etiqueta-estado" style={{ background: 'var(--morado-200)' }}>
                  {descripcion.destacado}
                </span>
              </p>
            )}
            <p className="suave">
              {descripcion?.texto ?? ''} Lo genera el módulo <strong>{archivo.modulo}</strong> ·{' '}
              {numero(archivo.filas)} filas · {numero(archivo.bytes / 1024, 1)} kB · copiado el{' '}
              {fechaHora(archivo.copiado_en)}.
              {descripcion && descripcion.vistas.length > 0 && (
                <>
                  {' '}
                  Lo leen:{' '}
                  {descripcion.vistas.map((vista, indice) => (
                    <span key={vista.ruta}>
                      {indice > 0 && ', '}
                      <Link to={vista.ruta}>{vista.nombre}</Link>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <a className="boton boton-secundario" href={`/data/${archivo.nombre}`} download>
                <Download aria-hidden size={16} /> Descargar CSV
              </a>
            </div>
            <TablaArchivo nombre={archivo.nombre} />
          </section>
        );
      })}
    </>
  );
}
