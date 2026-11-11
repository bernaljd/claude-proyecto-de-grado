// Inicio (RF-03): las cuatro tarjetas, la gráfica de las últimas 26 semanas con
// el pronóstico de la semana siguiente, y los avisos de semana incompleta y de
// demanda baja.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../DatosContext';
import { Aviso, ChipClasificacion, Encabezado, ErrorArchivo, Esqueleto, Fuente, MarcaOrigen } from '../componentes/comunes';
import { GraficaSemanal, LeyendaSemanal } from '../componentes/graficas';
import type { PuntoSemana } from '../componentes/graficas';
import { fechaConDia, fechaCorta, moneda, numero, porcentaje, unidadesPronosticadas } from '../lib/formato';
import { nombreOperativo } from '../lib/modelos';
import type { Clasificacion } from '../lib/tipos';

// Debajo de este total semanal pronosticado, el dashboard avisa que la demanda es muy baja
const UMBRAL_DEMANDA_BAJA = 20;
const SEMANAS_GRAFICA = 26;

export default function Inicio() {
  const { cargando, serie, pronostico, menu, ultimaFecha, semanaIncompleta } = useDatos();

  const resumen = useMemo(() => {
    if (!serie) return undefined;
    const porSemana = new Map<string, { unidades: number; ventas: number }>();
    for (const fila of serie) {
      const acumulado = porSemana.get(fila.semana_inicio) ?? { unidades: 0, ventas: 0 };
      acumulado.unidades += fila.unidades;
      acumulado.ventas += fila.ventas;
      porSemana.set(fila.semana_inicio, acumulado);
    }
    const semanas = [...porSemana.keys()].sort();
    const totales = semanas.map((semana) => ({ semana, ...porSemana.get(semana)! }));
    const ultima = totales[totales.length - 1];
    const anterior = totales[totales.length - 2];
    // Variación (5.2): última semana frente a la anterior; si la última está
    // incompleta, frente a la media de las 4 semanas completas anteriores.
    const completasAnteriores = totales.slice(-5, -1);
    const referencia = semanaIncompleta
      ? completasAnteriores.reduce((suma, punto) => suma + punto.unidades, 0) / Math.max(completasAnteriores.length, 1)
      : anterior?.unidades;
    const variacion =
      referencia && referencia > 0 && ultima ? (100 * (ultima.unidades - referencia)) / referencia : null;
    return { totales, ultima, variacion };
  }, [serie, semanaIncompleta]);

  const demanda = useMemo(() => {
    if (!pronostico) return undefined;
    const conPronostico = pronostico.filter((fila) => fila.unidades_pronosticadas !== null);
    const total = conPronostico.reduce((suma, fila) => suma + (fila.unidades_pronosticadas ?? 0), 0);
    const metodoModelo = pronostico.find((fila) => fila.estado_plato === 'modelable')?.metodo;
    const semana = pronostico[0]?.semana_pronostico;
    return { total, metodoModelo, semana, platos: conPronostico.length };
  }, [pronostico]);

  const alertas = useMemo(
    () => menu?.filter((fila) => fila.escenario === 'proyectado' && fila.cambia_de_categoria === 'sí').length,
    [menu],
  );

  const porClasificacion = useMemo(() => {
    const conteo = new Map<Clasificacion, number>();
    for (const fila of menu ?? []) {
      if (fila.escenario !== 'historico') continue;
      conteo.set(fila.clasificacion, (conteo.get(fila.clasificacion) ?? 0) + 1);
    }
    return conteo;
  }, [menu]);

  const puntosGrafica = useMemo<PuntoSemana[]>(() => {
    if (!resumen) return [];
    const base: PuntoSemana[] = resumen.totales.slice(-SEMANAS_GRAFICA).map((punto, indice, lista) => ({
      semana: punto.semana,
      unidades: punto.unidades,
      tipo: semanaIncompleta && indice === lista.length - 1 ? 'incompleta' : 'observado',
    }));
    if (demanda?.semana) {
      base.push({ semana: demanda.semana, unidades: demanda.total, tipo: 'pronostico' });
    }
    return base;
  }, [resumen, demanda, semanaIncompleta]);

  if (cargando) return <Esqueleto cantidad={3} alto={140} />;

  return (
    <>
      <Encabezado titulo="Inicio">
        Resumen de la semana del restaurante: lo que se vendió, lo que se espera vender la próxima semana y
        lo que pide atención en el menú.
      </Encabezado>
      <ErrorArchivo archivos={['01_ventas_limpias.csv', '02_serie_semanal.csv', '06_pronostico.csv', '06_ingenieria_menu.csv']} />

      {semanaIncompleta && (
        <Aviso>
          Semana incompleta (datos hasta el {fechaConDia(ultimaFecha)}): las cifras de la última semana no
          cubren todos los días, por eso no se leen como una caída real de ventas.
        </Aviso>
      )}
      {demanda && demanda.total < UMBRAL_DEMANDA_BAJA && (
        <Aviso>
          La demanda esperada es baja: {unidadesPronosticadas(demanda.total)} unidades en toda la semana.
          Con tan pocas ventas, los pronósticos por plato son solo una guía (varios quedan por debajo de 1
          unidad).
        </Aviso>
      )}

      <div className="rejilla-tarjetas">
        {resumen?.ultima && (
          <section className="tarjeta">
            <div className="titulo-tarjeta">
              Ventas de la última semana <MarcaOrigen origen="OBS" />
            </div>
            <div className="cifra">{moneda(resumen.ultima.ventas)}</div>
            <p className="suave">
              {numero(resumen.ultima.unidades)} unidades en la semana del {fechaCorta(resumen.ultima.semana)}.{' '}
              {resumen.variacion !== null &&
                (semanaIncompleta
                  ? `Va ${porcentaje(Math.abs(resumen.variacion), 0)} ${
                      resumen.variacion >= 0 ? 'por encima' : 'por debajo'
                    } de la media de las 4 semanas completas anteriores, pero la semana aún no termina.`
                  : `${resumen.variacion >= 0 ? 'Subió' : 'Bajó'} ${porcentaje(Math.abs(resumen.variacion), 0)} frente a la semana anterior.`)}
            </p>
          </section>
        )}

        {demanda && (
          <section className="tarjeta">
            <div className="titulo-tarjeta">
              Demanda esperada la semana siguiente <MarcaOrigen origen="PRED" />
            </div>
            <div className="cifra">{unidadesPronosticadas(demanda.total)} unidades</div>
            <p className="suave">
              Semana del {fechaCorta(demanda.semana)}, sumando {numero(demanda.platos)} platos con pronóstico.
              Pronóstico del modelo {nombreOperativo(demanda.metodoModelo)} (el de menor error; el detalle
              está en <Link to="/confiabilidad">Confiabilidad</Link>).
            </p>
          </section>
        )}

        {alertas !== undefined && (
          <section className="tarjeta">
            <div className="titulo-tarjeta">
              Alertas activas <MarcaOrigen origen="CALC" />
            </div>
            <div className="cifra">{numero(alertas)}</div>
            <p className="suave">
              Platos que cambiarían de categoría en el menú la próxima semana.{' '}
              <Link to="/alertas">Ver las alertas</Link>
            </p>
          </section>
        )}

        {porClasificacion.size > 0 && (
          <section className="tarjeta">
            <div className="titulo-tarjeta">
              Platos por categoría de la matriz <MarcaOrigen origen="CALC" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['Estrella', 'Caballo de arado', 'Puzzle', 'Perro'] as Clasificacion[]).map((clasificacion) => (
                <div key={clasificacion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ChipClasificacion clasificacion={clasificacion} />
                  <strong>{numero(porClasificacion.get(clasificacion) ?? 0)}</strong>
                </div>
              ))}
            </div>
            <p className="suave" style={{ marginBottom: 0 }}>
              Con las últimas 12 semanas. <Link to="/menu">Ver la matriz</Link>
            </p>
          </section>
        )}
      </div>

      {puntosGrafica.length > 0 && (
        <section className="tarjeta">
          <h2>Unidades vendidas por semana (últimas {SEMANAS_GRAFICA}) y la semana pronosticada</h2>
          <GraficaSemanal datos={puntosGrafica} />
          <LeyendaSemanal hayIncompleta={semanaIncompleta} hayPronostico={Boolean(demanda?.semana)} />
          <div className="desplegable" style={{ border: 'none', marginTop: 10 }}>
            <h3>Cómo leer esto</h3>
            <p className="nota" style={{ margin: 0 }}>
              Cada barra morada es una semana real de ventas (OBS). La barra rayada del final es lo que el
              sistema espera vender la semana siguiente (PRED). Si la última barra gris se ve baja, suele ser
              porque la semana aún no termina, no porque las ventas cayeran.
            </p>
          </div>
          <Fuente archivos={['02_serie_semanal.csv', '06_pronostico.csv']} origenes={['OBS', 'PRED']} />
        </section>
      )}
    </>
  );
}
