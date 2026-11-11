// Ingeniería de menú (RF-06, RF-07): matriz de dispersión con umbrales,
// cuadrantes rotulados, selector Histórica/Proyectada, filtros de período y
// categoría del menú, contadores y tabla. Por defecto la matriz se dibuja
// directamente desde 06_ingenieria_menu.csv; al cambiar el período se recalcula
// en el navegador con la misma fórmula del pipeline (sección «¿Cómo se calcula?»).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useDatos } from '../DatosContext';
import {
  Aviso,
  ChipClasificacion,
  COLOR_CLASIFICACION,
  Encabezado,
  ErrorArchivo,
  Esqueleto,
  Fuente,
} from '../componentes/comunes';
import { moneda, numero, porcentaje, unidadesPronosticadas } from '../lib/formato';
import {
  agregarPeriodo,
  calcularMatriz,
  SEMANAS_POR_DEFECTO,
  semanasDelPeriodo,
} from '../lib/ingenieriaMenu';
import type { FilaMatriz, Periodo } from '../lib/ingenieriaMenu';
import type { Clasificacion } from '../lib/tipos';

const UMBRAL_DEMANDA_BAJA = 20;
const CLASIFICACIONES: Clasificacion[] = ['Estrella', 'Caballo de arado', 'Puzzle', 'Perro'];
const PLURAL: Record<Clasificacion, string> = {
  Estrella: 'Estrellas',
  'Caballo de arado': 'Caballos de arado',
  Puzzle: 'Puzzles',
  Perro: 'Perros',
};

// Cada clasificación tiene su color Y su forma (la identidad nunca es solo el color)
function Forma({ cx, cy, clasificacion }: { cx?: number; cy?: number; clasificacion: Clasificacion }) {
  if (cx === undefined || cy === undefined) return null;
  const color = COLOR_CLASIFICACION[clasificacion];
  switch (clasificacion) {
    case 'Estrella':
      return (
        <path
          d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`}
          fill={color}
          stroke="var(--morado-200)"
          strokeWidth={2}
        />
      );
    case 'Caballo de arado':
      return <circle cx={cx} cy={cy} r={6} fill={color} stroke="var(--blanco)" strokeWidth={1.5} />;
    case 'Puzzle':
      return (
        <rect x={cx - 5.5} y={cy - 5.5} width={11} height={11} rx={2} fill={color} stroke="var(--blanco)" strokeWidth={1.5} />
      );
    default:
      return (
        <path
          d={`M ${cx} ${cy - 7} L ${cx + 6.5} ${cy + 5.5} L ${cx - 6.5} ${cy + 5.5} Z`}
          fill={color}
          stroke="var(--blanco)"
          strokeWidth={1.5}
        />
      );
  }
}

interface PuntoMatriz extends FilaMatriz {
  decimales: boolean;
}

function TooltipMatriz({ active, payload }: { active?: boolean; payload?: { payload: PuntoMatriz }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0].payload;
  return (
    <div
      style={{
        background: 'var(--blanco)',
        border: '1px solid var(--morado-200)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: 'var(--sombra)',
        fontSize: '0.85rem',
        maxWidth: 240,
      }}
    >
      <strong>{punto.plato}</strong>
      <div>{punto.decimales ? unidadesPronosticadas(punto.unidades) : numero(punto.unidades)} unidades</div>
      <div>Margen por unidad: {moneda(punto.margenUnitario)}</div>
      <div>Popularidad: {porcentaje(punto.popularidadPct)}</div>
      <div style={{ marginTop: 4 }}>
        <ChipClasificacion clasificacion={punto.clasificacion} />
      </div>
    </div>
  );
}

type OpcionPeriodo = '4' | '8' | '12' | '26' | 'rango';

export default function Menu() {
  const { cargando, menu, serie, pronostico } = useDatos();
  const navegar = useNavigate();
  const [escenario, setEscenario] = useState<'historico' | 'proyectado'>('historico');
  const [opcionPeriodo, setOpcionPeriodo] = useState<OpcionPeriodo>('12');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [orden, setOrden] = useState<{ columna: keyof FilaMatriz | 'clasificacion'; ascendente: boolean }>({
    columna: 'popularidadPct',
    ascendente: false,
  });

  const categorias = useMemo(
    () => [...new Set((pronostico ?? []).map((fila) => fila.categoria))].sort(),
    [pronostico],
  );
  const categoriaDe = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const fila of pronostico ?? []) mapa.set(fila.plato, fila.categoria);
    return mapa;
  }, [pronostico]);

  const esPorDefecto = opcionPeriodo === String(SEMANAS_POR_DEFECTO);
  const rangoValido = opcionPeriodo !== 'rango' || (desde !== '' && hasta !== '' && desde <= hasta);

  // La matriz del escenario elegido: del CSV con el período por defecto, o
  // recalculada en el navegador con la fórmula del pipeline (5.3).
  const matriz = useMemo<PuntoMatriz[]>(() => {
    if (!menu) return [];
    if (esPorDefecto) {
      return menu
        .filter((fila) => fila.escenario === escenario)
        .map((fila) => ({
          plato: fila.plato,
          unidades: fila.unidades,
          margenUnitario: fila.margen_unitario,
          popularidadPct: fila.popularidad_pct,
          umbralMargen: fila.umbral_margen,
          umbralPopularidad: fila.umbral_popularidad,
          clasificacion: fila.clasificacion,
          decimales: fila.escenario === 'proyectado',
        }));
    }
    if (!serie || !rangoValido) return [];
    const semanas = semanasDelPeriodo(
      [...new Set(serie.map((fila) => fila.semana_inicio))],
      opcionPeriodo === 'rango'
        ? ({ tipo: 'rango', desde, hasta } as Periodo)
        : ({ tipo: 'semanas', semanas: Number(opcionPeriodo) } as Periodo),
    );
    const agregado = agregarPeriodo(serie, semanas);
    if (escenario === 'historico') {
      return calcularMatriz(agregado).map((fila) => ({ ...fila, decimales: false }));
    }
    // Proyectado: conserva las unidades pronosticadas y toma el margen unitario
    // del período elegido; si el plato no vendió en el período, usa su margen
    // de 06_ingenieria_menu.csv.
    const margenPeriodo = new Map(agregado.map((fila) => [fila.plato, fila.margenUnitario]));
    const margenCsv = new Map<string, number>();
    for (const fila of menu) {
      if (!margenCsv.has(fila.plato)) margenCsv.set(fila.plato, fila.margen_unitario);
    }
    const entradas = (pronostico ?? [])
      .filter((fila) => (fila.unidades_pronosticadas ?? 0) > 0)
      .map((fila) => ({
        plato: fila.plato,
        unidades: fila.unidades_pronosticadas as number,
        margenUnitario: margenPeriodo.get(fila.plato) ?? margenCsv.get(fila.plato) ?? NaN,
      }))
      .filter((fila) => Number.isFinite(fila.margenUnitario));
    return calcularMatriz(entradas).map((fila) => ({ ...fila, decimales: true }));
  }, [menu, serie, pronostico, escenario, esPorDefecto, opcionPeriodo, desde, hasta, rangoValido]);

  // Al filtrar por categoría los umbrales se calculan sobre todo el menú y
  // solo se ocultan los platos de otras categorías.
  const visibles = useMemo(
    () => (categoria === 'todas' ? matriz : matriz.filter((fila) => categoriaDe.get(fila.plato) === categoria)),
    [matriz, categoria, categoriaDe],
  );

  const umbralMargen = matriz[0]?.umbralMargen;
  const umbralPopularidad = matriz[0]?.umbralPopularidad;
  const totalProyectado = useMemo(
    () =>
      (pronostico ?? []).reduce((suma, fila) => suma + (fila.unidades_pronosticadas ?? 0), 0),
    [pronostico],
  );

  const conteos = useMemo(() => {
    const mapa = new Map<Clasificacion, number>();
    for (const fila of visibles) mapa.set(fila.clasificacion, (mapa.get(fila.clasificacion) ?? 0) + 1);
    return mapa;
  }, [visibles]);

  const filasTabla = useMemo(() => {
    const comparar = (a: PuntoMatriz, b: PuntoMatriz): number => {
      const columna = orden.columna;
      if (columna === 'plato') return a.plato.localeCompare(b.plato);
      if (columna === 'clasificacion') return a.clasificacion.localeCompare(b.clasificacion);
      return (a[columna] as number) - (b[columna] as number);
    };
    return [...visibles].sort((a, b) => (orden.ascendente ? comparar(a, b) : comparar(b, a)));
  }, [visibles, orden]);

  const chipsActivos: { texto: string; quitar: () => void }[] = [];
  if (!esPorDefecto) {
    chipsActivos.push({
      texto:
        opcionPeriodo === 'rango'
          ? `Período: ${desde || '…'} a ${hasta || '…'}`
          : `Período: últimas ${opcionPeriodo} semanas`,
      quitar: () => setOpcionPeriodo('12'),
    });
  }
  if (categoria !== 'todas') {
    chipsActivos.push({ texto: `Categoría: ${categoria}`, quitar: () => setCategoria('todas') });
  }

  if (cargando) return <Esqueleto cantidad={2} alto={260} />;

  return (
    <>
      <Encabezado titulo="Ingeniería de menú">
        Cada plato se ubica según cuánto se pide (popularidad) y cuánto deja por unidad (margen). Los
        umbrales dividen el menú en cuatro categorías con una acción sugerida para cada una.
      </Encabezado>
      <ErrorArchivo archivos={['06_ingenieria_menu.csv', '02_serie_semanal.csv', '06_pronostico.csv']} />

      <Aviso>
        El costo de cada plato es una estimación cercana al 35 % del precio; por eso, en este restaurante un
        margen alto equivale a un precio alto.
      </Aviso>
      {escenario === 'proyectado' && totalProyectado < UMBRAL_DEMANDA_BAJA && (
        <Aviso>Con la demanda tan baja, la clasificación proyectada es orientativa.</Aviso>
      )}

      <section className="tarjeta">
        <div className="fila-controles" role="group" aria-label="Escenario de la matriz">
          <button
            type="button"
            className="chip"
            aria-pressed={escenario === 'historico'}
            onClick={() => setEscenario('historico')}
          >
            Histórica (OBS+CALC)
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={escenario === 'proyectado'}
            onClick={() => setEscenario('proyectado')}
          >
            Proyectada (PRED+CALC)
          </button>
        </div>
        <div className="fila-controles">
          <label>
            Período histórico
            <select
              value={opcionPeriodo}
              onChange={(evento) => setOpcionPeriodo(evento.target.value as OpcionPeriodo)}
            >
              <option value="4">Últimas 4 semanas</option>
              <option value="8">Últimas 8 semanas</option>
              <option value="12">Últimas 12 semanas (por defecto)</option>
              <option value="26">Últimas 26 semanas</option>
              <option value="rango">Rango de fechas</option>
            </select>
          </label>
          {opcionPeriodo === 'rango' && (
            <>
              <label>
                Desde (lunes)
                <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} />
              </label>
            </>
          )}
          <label>
            Categoría del menú
            <select value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
              <option value="todas">Todas</option>
              {categorias.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        {chipsActivos.length > 0 && (
          <div className="fila-controles">
            {chipsActivos.map((chip) => (
              <button key={chip.texto} type="button" className="chip activo" onClick={chip.quitar}>
                {chip.texto} <X aria-hidden size={14} />
              </button>
            ))}
            <button
              type="button"
              className="chip"
              onClick={() => {
                setOpcionPeriodo('12');
                setCategoria('todas');
                setDesde('');
                setHasta('');
              }}
            >
              Borrar filtros
            </button>
          </div>
        )}
        {!rangoValido && <p className="nota">Elija un rango válido: la fecha «desde» debe ser anterior a «hasta».</p>}
        {categoria !== 'todas' && (
          <p className="nota">
            Los umbrales se calculan con todo el menú; el filtro solo oculta los platos de otras categorías.
          </p>
        )}

        {visibles.length === 0 ? (
          <p className="suave">No hay platos con ventas en el período elegido.</p>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ width: '100%', height: 380 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 18, right: 18, bottom: 14, left: 0 }}>
                  <CartesianGrid stroke="var(--morado-50)" />
                  <XAxis
                    type="number"
                    dataKey="popularidadPct"
                    name="Popularidad"
                    unit=" %"
                    tick={{ fontSize: 11, fill: 'var(--texto-suave)' }}
                    label={{
                      value: 'Popularidad (% de las unidades)',
                      position: 'insideBottom',
                      offset: -8,
                      fontSize: 12,
                      fill: 'var(--texto-suave)',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="margenUnitario"
                    name="Margen"
                    tick={{ fontSize: 11, fill: 'var(--texto-suave)' }}
                    label={{
                      value: 'Margen por unidad (£)',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 12,
                      fill: 'var(--texto-suave)',
                    }}
                  />
                  {umbralPopularidad !== undefined && (
                    <ReferenceLine
                      x={umbralPopularidad}
                      stroke="var(--morado-700)"
                      strokeDasharray="6 4"
                      label={{
                        value: `Umbral de popularidad: ${porcentaje(umbralPopularidad)}`,
                        position: 'top',
                        fontSize: 11,
                        fill: 'var(--morado-700)',
                      }}
                    />
                  )}
                  {umbralMargen !== undefined && (
                    <ReferenceLine
                      y={umbralMargen}
                      stroke="var(--morado-700)"
                      strokeDasharray="6 4"
                      label={{
                        value: `Umbral de margen: ${moneda(umbralMargen)}`,
                        position: 'insideRight',
                        fontSize: 11,
                        fill: 'var(--morado-700)',
                      }}
                    />
                  )}
                  <Tooltip content={<TooltipMatriz />} cursor={{ strokeDasharray: '4 4' }} />
                  {CLASIFICACIONES.map((clasificacion) => (
                    <Scatter
                      key={clasificacion}
                      name={PLURAL[clasificacion]}
                      data={visibles.filter((fila) => fila.clasificacion === clasificacion)}
                      fill={COLOR_CLASIFICACION[clasificacion]}
                      shape={(props: { cx?: number; cy?: number }) => (
                        <Forma cx={props.cx} cy={props.cy} clasificacion={clasificacion} />
                      )}
                      onClick={(punto: { plato?: string }) => {
                        if (punto?.plato) navegar(`/menu/${encodeURIComponent(punto.plato)}`);
                      }}
                      cursor="pointer"
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* Cuadrantes rotulados (los umbrales dividen la matriz) */}
            <div className="nota" style={{ position: 'absolute', top: 22, right: 24, pointerEvents: 'none' }}>
              Estrellas
            </div>
            <div className="nota" style={{ position: 'absolute', top: 22, left: 70, pointerEvents: 'none' }}>
              Puzzles
            </div>
            <div className="nota" style={{ position: 'absolute', bottom: 48, right: 24, pointerEvents: 'none' }}>
              Caballos de arado
            </div>
            <div className="nota" style={{ position: 'absolute', bottom: 48, left: 70, pointerEvents: 'none' }}>
              Perros
            </div>
          </div>
        )}

        <div className="leyenda-grafica" aria-label="Categorías de la matriz">
          {CLASIFICACIONES.map((clasificacion) => (
            <span key={clasificacion} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" aria-hidden>
                <Forma cx={8} cy={8} clasificacion={clasificacion} />
              </svg>
              {PLURAL[clasificacion]}: {numero(conteos.get(clasificacion) ?? 0)}
            </span>
          ))}
        </div>

        <details className="desplegable">
          <summary>¿Cómo se calcula?</summary>
          <div className="cuerpo nota">
            <p>
              Por plato y período: unidades = Σ unidades; margen por unidad = Σ margen ÷ Σ unidades. Entran
              solo los platos con unidades &gt; 0.
            </p>
            <p>
              Umbral de margen = Σ (margen por unidad × unidades) ÷ Σ unidades (el margen ponderado del
              menú). Umbral de popularidad = 70 % × (1 ÷ N), con N platos del período. Popularidad de un
              plato = 100 × sus unidades ÷ Σ unidades.
            </p>
            <p style={{ marginBottom: 0 }}>
              Margen alto: margen por unidad ≥ umbral de margen. Popularidad alta: popularidad ≥ umbral de
              popularidad. Estrella = las dos altas; Caballo de arado = solo popularidad; Puzzle = solo
              margen; Perro = ninguna. En la matriz proyectada las unidades son las pronosticadas (PRED) y el
              margen por unidad es el del período histórico elegido.
            </p>
          </div>
        </details>

        <Fuente
          archivos={
            esPorDefecto
              ? ['06_ingenieria_menu.csv']
              : escenario === 'historico'
                ? ['02_serie_semanal.csv']
                : ['02_serie_semanal.csv', '06_pronostico.csv']
          }
          origenes={escenario === 'historico' ? ['OBS', 'CALC'] : ['PRED', 'CALC']}
          nota={esPorDefecto ? undefined : 'Recalculada en el navegador con la fórmula del pipeline.'}
        />
      </section>

      <section className="tarjeta">
        <h2>Platos del escenario {escenario === 'historico' ? 'histórico' : 'proyectado'}</h2>
        <div className="tabla-envoltura">
          <table className="tabla tabla-tarjetas">
            <thead>
              <tr>
                {(
                  [
                    ['plato', 'Plato'],
                    ['unidades', 'Unidades'],
                    ['margenUnitario', 'Margen por unidad'],
                    ['popularidadPct', 'Popularidad'],
                    ['clasificacion', 'Clasificación'],
                  ] as [keyof FilaMatriz | 'clasificacion', string][]
                ).map(([columna, texto]) => (
                  <th
                    key={columna}
                    aria-sort={
                      orden.columna === columna ? (orden.ascendente ? 'ascending' : 'descending') : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOrden((actual) =>
                          actual.columna === columna
                            ? { columna, ascendente: !actual.ascendente }
                            : { columna, ascendente: columna === 'plato' },
                        )
                      }
                    >
                      {texto}
                      {orden.columna === columna &&
                        (orden.ascendente ? <ArrowUp aria-hidden size={14} /> : <ArrowDown aria-hidden size={14} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((fila) => (
                <tr
                  key={fila.plato}
                  className="enlazable"
                  tabIndex={0}
                  onClick={() => navegar(`/menu/${encodeURIComponent(fila.plato)}`)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') navegar(`/menu/${encodeURIComponent(fila.plato)}`);
                  }}
                >
                  <td data-etiqueta="">
                    <strong>{fila.plato}</strong>
                    <div className="nota">{categoriaDe.get(fila.plato) ?? ''}</div>
                  </td>
                  <td className="numero" data-etiqueta="Unidades">
                    {fila.decimales ? unidadesPronosticadas(fila.unidades) : numero(fila.unidades)}
                  </td>
                  <td className="numero" data-etiqueta="Margen por unidad">
                    {moneda(fila.margenUnitario)}
                  </td>
                  <td className="numero" data-etiqueta="Popularidad">
                    {porcentaje(fila.popularidadPct)}
                  </td>
                  <td data-etiqueta="Clasificación">
                    <ChipClasificacion clasificacion={fila.clasificacion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
