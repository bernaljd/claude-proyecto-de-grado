// Confiabilidad (RF-11): la única vista, junto con «Datos y fuentes», donde
// aparecen los términos técnicos (MAE, RMSE, SMAPE y los nombres de los modelos).
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDatos } from '../DatosContext';
import { Encabezado, ErrorArchivo, Esqueleto, Fuente } from '../componentes/comunes';
import { fechaCorta, fechaHora, numero, porcentaje } from '../lib/formato';
import { nombreTecnico } from '../lib/modelos';
import type { FilaEntrenamiento, FilaMetrica } from '../lib/tipos';

// Colores fijos por serie (la identidad también va en la leyenda y los nombres)
const COLORES_MODELO = ['#7c3aed', '#ea580c', '#0284c7', '#0d9488', '#db2777', '#ca8a04'];

const EXPLICACIONES: Record<string, string> = {
  mae: 'En promedio, la proyección se aleja esta cantidad de unidades por plato y semana.',
  rmse: 'Como el MAE, pero castiga más los errores grandes.',
  smape: 'El error como porcentaje de lo vendido y lo pronosticado (0 % es perfecto).',
  accuracy: 'De cada 100 semanas, en cuántas acierta si el plato vende o no vende.',
  f1: 'Equilibrio entre no inventar ventas y no perderlas (0 a 1).',
  sesgo: 'Positivo: pronostica de más; negativo: pronostica de menos.',
};

export default function Confiabilidad() {
  const {
    cargando,
    entrenamiento,
    metricas,
    matrizConfusionPrueba,
    predicciones,
    particion,
    manifiesto,
    columnasPredPrueba,
  } = useDatos();
  const [modelosVisibles, setModelosVisibles] = useState<Set<string> | null>(null);
  const [platoElegido, setPlatoElegido] = useState('todos');

  // Ganadores de cada modelo en validación; el elegido es el de menor MAE
  const ganadores = useMemo(
    () => (entrenamiento ?? []).filter((fila) => fila.mejor_del_modelo === 'sí'),
    [entrenamiento],
  );
  const elegido = useMemo(() => {
    if (ganadores.length === 0) return undefined;
    return ganadores.reduce((mejor, fila) =>
      (fila.mae_validacion ?? Infinity) < (mejor.mae_validacion ?? Infinity) ? fila : mejor,
    );
  }, [ganadores]);

  const filasMetricas = metricas ?? [];
  const siempreCero = filasMetricas.find((fila) => fila.modelo === 'Siempre 0');
  const filaElegida = filasMetricas.find(
    (fila) => elegido && fila.modelo === elegido.modelo.replace('_promedio', ''),
  );

  const platos = useMemo(
    () => [...new Set((predicciones ?? []).map((fila) => fila.plato))].sort(),
    [predicciones],
  );

  // Demanda total semanal (o la del plato elegido) real y por modelo, en prueba
  const puntosPrueba = useMemo(() => {
    if (!predicciones) return [];
    const porSemana = new Map<string, Record<string, number>>();
    for (const fila of predicciones) {
      if (platoElegido !== 'todos' && fila.plato !== platoElegido) continue;
      const clave = fila.semana_objetivo;
      const acumulado = porSemana.get(clave) ?? {};
      acumulado['Real'] = (acumulado['Real'] ?? 0) + fila.y_real;
      for (const columna of columnasPredPrueba) {
        const valor = fila[columna];
        if (typeof valor === 'number') {
          acumulado[nombreTecnico(columna)] = (acumulado[nombreTecnico(columna)] ?? 0) + valor;
        }
      }
      porSemana.set(clave, acumulado);
    }
    return [...porSemana.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, valores]) => ({ semana, ...valores }));
  }, [predicciones, columnasPredPrueba, platoElegido]);

  const nombresModelos = columnasPredPrueba.map(nombreTecnico);
  const visibles = modelosVisibles ?? new Set(nombresModelos);

  const rangos = useMemo(() => {
    if (!particion) return [];
    const porConjunto = new Map<string, string[]>();
    for (const fila of particion) {
      const lista = porConjunto.get(fila.conjunto) ?? [];
      lista.push(fila.semana_inicio);
      porConjunto.set(fila.conjunto, lista);
    }
    return ['entrenamiento', 'validacion', 'prueba']
      .filter((conjunto) => porConjunto.has(conjunto))
      .map((conjunto) => {
        const semanas = porConjunto.get(conjunto)!.sort();
        return { conjunto, desde: semanas[0], hasta: semanas[semanas.length - 1], total: semanas.length };
      });
  }, [particion]);

  if (cargando) return <Esqueleto cantidad={3} alto={180} />;

  const columnasTabla: { clave: keyof FilaMetrica; titulo: string; decimales: number; menorEsMejor: boolean }[] = [
    { clave: 'mae', titulo: 'MAE', decimales: 3, menorEsMejor: true },
    { clave: 'rmse', titulo: 'RMSE', decimales: 3, menorEsMejor: true },
    { clave: 'smape', titulo: 'SMAPE (%)', decimales: 1, menorEsMejor: true },
    { clave: 'accuracy', titulo: 'Accuracy', decimales: 3, menorEsMejor: false },
    { clave: 'f1', titulo: 'F1', decimales: 3, menorEsMejor: false },
    { clave: 'sesgo', titulo: 'Sesgo (%)', decimales: 1, menorEsMejor: true },
  ];

  function esMejor(fila: FilaMetrica, columna: (typeof columnasTabla)[number]): boolean {
    if (fila.modelo === 'Siempre 0') return false;
    const competidores = filasMetricas.filter((otra) => otra.modelo !== 'Siempre 0');
    const valores = competidores.map((otra) =>
      columna.clave === 'sesgo' ? Math.abs(otra[columna.clave] as number) : (otra[columna.clave] as number),
    );
    const propio = columna.clave === 'sesgo' ? Math.abs(fila[columna.clave] as number) : (fila[columna.clave] as number);
    const mejor = columna.menorEsMejor || columna.clave === 'sesgo' ? Math.min(...valores) : Math.max(...valores);
    return propio === mejor;
  }

  return (
    <>
      <Encabezado titulo="Confiabilidad">
        Qué tan confiables son los pronósticos: qué modelo se eligió, cuánto se equivoca y cómo se comparó
        con lo que de verdad pasó. Esta es la vista técnica del sistema.
      </Encabezado>
      <ErrorArchivo
        archivos={[
          '04_entrenamiento.csv',
          '05_metricas.csv',
          '05_predicciones.csv',
          '05_matriz_confusion.csv',
          '03_particion_semanas.csv',
        ]}
      />

      {elegido && (
        <section className="tarjeta">
          <h2>Modelo elegido: {nombreTecnico(`pred_${elegido.modelo.replace('_promedio', '').toLowerCase()}`)}</h2>
          <p className="suave">
            Se eligió por tener el menor MAE en validación ({numero(elegido.mae_validacion, 3)} unidades)
            entre las mejores combinaciones de los {numero(ganadores.length)} modelos probados.
            {filaElegida &&
              ` En prueba: ${EXPLICACIONES.mae.replace('esta cantidad de', numero(filaElegida.mae, 2))}`}
          </p>
          <p className="nota">
            Combinación {numero(elegido.combinacion)} · Hiperparámetros: <code>{elegido.hiperparametros}</code>
          </p>
          <Fuente archivos={['04_entrenamiento.csv']} origenes={['CALC']} />
        </section>
      )}

      {filasMetricas.length > 0 && (
        <section className="tarjeta">
          <h2>Comparación de todos los modelos en prueba</h2>
          <p className="suave">
            La fila «Siempre 0» es una referencia (pronosticar 0 todas las semanas), no un modelo. El mejor
            valor de cada columna va resaltado en morado.
          </p>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Modelo</th>
                  {columnasTabla.map((columna) => (
                    <th key={columna.clave} className="numero" title={EXPLICACIONES[columna.clave]}>
                      {columna.titulo}
                    </th>
                  ))}
                  <th className="numero" title="Unidades pronosticadas frente a reales en las semanas de prueba">
                    Unidades (pron. / reales)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filasMetricas.map((fila) => (
                  <tr key={fila.modelo} style={fila.modelo === 'Siempre 0' ? { background: 'var(--morado-50)' } : undefined}>
                    <td>
                      <strong>{fila.modelo}</strong>
                      {fila.modelo === 'Siempre 0' && <div className="nota">referencia</div>}
                      {fila.vigente === 'sí' && <div className="nota">vigente</div>}
                    </td>
                    {columnasTabla.map((columna) => (
                      <td
                        key={columna.clave}
                        className={`numero ${esMejor(fila, columna) ? 'mejor' : ''}`}
                      >
                        {numero(fila[columna.clave] as number, columna.decimales)}
                      </td>
                    ))}
                    <td className="numero">
                      {numero(fila.unidades_pronosticadas, 0)} / {numero(fila.unidades_reales, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="nota">
            {columnasTabla.map((columna) => (
              <li key={columna.clave}>
                <strong>{columna.titulo}:</strong> {EXPLICACIONES[columna.clave]}
              </li>
            ))}
          </ul>
          {siempreCero && (
            <p className="suave">
              La demanda de cada plato es baja e intermitente: en la mayoría de las semanas un plato no vende
              nada. Por eso decir siempre «no habrá ventas» ya acierta en cerca del{' '}
              {porcentaje(siempreCero.accuracy * 100, 0)} de las semanas de prueba. Los modelos mejoran sobre
              esa referencia en algunas métricas, pero la mejora es modesta. Más datos mejorarían el
              pronóstico.
            </p>
          )}
          <Fuente archivos={['05_metricas.csv']} origenes={['CALC']} />
        </section>
      )}

      {ganadores.length > 0 && (
        <section className="tarjeta">
          <h2>Validación frente a prueba</h2>
          <p className="suave">
            El error de la mejor combinación de cada modelo en validación (con el que se eligió) y en prueba
            (26 semanas que los modelos nunca vieron), para ver si se mantiene.
          </p>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th className="numero">MAE valid.</th>
                  <th className="numero">MAE prueba</th>
                  <th className="numero">RMSE valid.</th>
                  <th className="numero">RMSE prueba</th>
                  <th className="numero">SMAPE valid. (%)</th>
                  <th className="numero">SMAPE prueba (%)</th>
                </tr>
              </thead>
              <tbody>
                {ganadores.map((fila: FilaEntrenamiento) => {
                  const nombre = fila.modelo.replace('_promedio', '');
                  const enPrueba = filasMetricas.find((otra) => otra.modelo === nombre);
                  return (
                    <tr key={fila.modelo}>
                      <td>
                        <strong>{nombre}</strong>
                      </td>
                      <td className="numero">{numero(fila.mae_validacion, 3)}</td>
                      <td className="numero">{numero(enPrueba?.mae ?? null, 3)}</td>
                      <td className="numero">{numero(fila.rmse_validacion, 3)}</td>
                      <td className="numero">{numero(enPrueba?.rmse ?? null, 3)}</td>
                      <td className="numero">{numero(fila.smape_validacion, 1)}</td>
                      <td className="numero">{numero(enPrueba?.smape ?? null, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Fuente archivos={['04_entrenamiento.csv', '05_metricas.csv']} origenes={['CALC']} />
        </section>
      )}

      {puntosPrueba.length > 0 && (
        <section className="tarjeta">
          <h2>Real contra pronosticado en las semanas de prueba</h2>
          <div className="fila-controles">
            <label>
              Ver
              <select value={platoElegido} onChange={(evento) => setPlatoElegido(evento.target.value)}>
                <option value="todos">Demanda total (todos los platos)</option>
                {platos.map((plato) => (
                  <option key={plato} value={plato}>
                    {plato}
                  </option>
                ))}
              </select>
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <legend className="nota">Modelos a mostrar</legend>
              {nombresModelos.map((nombre) => (
                <label key={nombre} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={visibles.has(nombre)}
                    onChange={() => {
                      const siguiente = new Set(visibles);
                      if (siguiente.has(nombre)) siguiente.delete(nombre);
                      else siguiente.add(nombre);
                      setModelosVisibles(siguiente);
                    }}
                  />
                  {nombre}
                </label>
              ))}
            </fieldset>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={puntosPrueba} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--morado-50)" />
                <XAxis
                  dataKey="semana"
                  tickFormatter={(valor: string) => fechaCorta(valor).slice(0, 6)}
                  tick={{ fontSize: 11, fill: 'var(--texto-suave)' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--texto-suave)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(valor) => `Semana del ${fechaCorta(String(valor))}`}
                  formatter={(valor: number, nombre: string) => [numero(valor, 1), nombre]}
                />
                <Line
                  dataKey="Real"
                  stroke="var(--texto)"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  isAnimationActive={false}
                />
                {nombresModelos
                  .filter((nombre) => visibles.has(nombre))
                  .map((nombre) => (
                    <Line
                      key={nombre}
                      dataKey={nombre}
                      stroke={COLORES_MODELO[nombresModelos.indexOf(nombre) % COLORES_MODELO.length]}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="leyenda-grafica">
            <span>
              <span className="muestra-color" style={{ background: 'var(--texto)' }} /> Real (OBS)
            </span>
            {nombresModelos
              .filter((nombre) => visibles.has(nombre))
              .map((nombre) => (
                <span key={nombre}>
                  <span
                    className="muestra-color"
                    style={{ background: COLORES_MODELO[nombresModelos.indexOf(nombre) % COLORES_MODELO.length] }}
                  />{' '}
                  {nombre} (PRED)
                </span>
              ))}
          </div>
          <Fuente archivos={['05_predicciones.csv']} origenes={['OBS', 'PRED']} />
        </section>
      )}

      {matrizConfusionPrueba && matrizConfusionPrueba.length > 0 && (
        <section className="tarjeta">
          <h2>¿Acierta cuándo hay venta? (matrices de confusión)</h2>
          <p className="suave">
            Cada semana de prueba, por plato, el modelo dice si habrá venta o no. VP: dijo venta y hubo. FP:
            dijo venta y no hubo. FN: no dijo venta y sí hubo. VN: no dijo venta y no hubo.
          </p>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th className="numero">VP</th>
                  <th className="numero">FP</th>
                  <th className="numero">FN</th>
                  <th className="numero">VN</th>
                </tr>
              </thead>
              <tbody>
                {matrizConfusionPrueba.map((fila) => (
                  <tr key={fila.modelo}>
                    <td>
                      <strong>{fila.modelo}</strong>
                    </td>
                    <td className="numero">{numero(fila.vp)}</td>
                    <td className="numero">{numero(fila.fp)}</td>
                    <td className="numero">{numero(fila.fn)}</td>
                    <td className="numero">{numero(fila.vn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Fuente archivos={['05_matriz_confusion.csv']} origenes={['CALC']} />
        </section>
      )}

      {rangos.length > 0 && (
        <section className="tarjeta">
          <h2>Con qué datos se midió</h2>
          <ul className="suave">
            {rangos.map((rango) => (
              <li key={rango.conjunto}>
                <strong>{rango.conjunto === 'validacion' ? 'validación' : rango.conjunto}</strong>:{' '}
                {numero(rango.total)} semanas, del {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)}.
              </li>
            ))}
          </ul>
          <p className="nota">
            Cálculo del {fechaHora(manifiesto?.generado_en)} (fecha de la última corrida del pipeline).
          </p>
          <Fuente archivos={['03_particion_semanas.csv']} origenes={['CALC']} />
        </section>
      )}
    </>
  );
}
