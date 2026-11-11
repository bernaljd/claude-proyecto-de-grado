// Detalle de demanda de un plato (RF-04, RF-05): últimas 12 semanas reales más
// la semana pronosticada, reparto por día y el desplegable técnico con lo que
// dice cada modelo.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { Aviso, Encabezado, ErrorArchivo, Esqueleto, Fuente, MarcaOrigen } from '../componentes/comunes';
import { GraficaSemanal, LeyendaSemanal } from '../componentes/graficas';
import type { PuntoSemana } from '../componentes/graficas';
import { fechaConDia, fechaCorta, numero, unidadesPronosticadas } from '../lib/formato';
import { columnaDelMetodo, nombreOperativo, nombreTecnico } from '../lib/modelos';
import { repartoDiario, textoReparto } from '../lib/repartoDiario';

const SEMANAS_GRAFICA = 12;

export default function DemandaPlato() {
  const { plato = '' } = useParams();
  const nombre = decodeURIComponent(plato);
  const { cargando, serie, pronostico, columnasPred, semanaIncompleta, ultimaFecha } = useDatos();

  const filaPronostico = useMemo(
    () => pronostico?.find((fila) => fila.plato === nombre),
    [pronostico, nombre],
  );

  const puntos = useMemo<PuntoSemana[]>(() => {
    if (!serie) return [];
    const propias = serie
      .filter((fila) => fila.plato === nombre)
      .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio))
      .slice(-SEMANAS_GRAFICA);
    const base: PuntoSemana[] = propias.map((fila, indice, lista) => ({
      semana: fila.semana_inicio,
      unidades: fila.unidades,
      tipo: semanaIncompleta && indice === lista.length - 1 ? 'incompleta' : 'observado',
    }));
    if (filaPronostico && filaPronostico.unidades_pronosticadas !== null) {
      base.push({
        semana: filaPronostico.semana_pronostico,
        unidades: filaPronostico.unidades_pronosticadas,
        tipo: 'pronostico',
      });
    }
    return base;
  }, [serie, nombre, filaPronostico, semanaIncompleta]);

  if (cargando) return <Esqueleto cantidad={2} alto={220} />;

  if (!filaPronostico) {
    return (
      <>
        <ErrorArchivo archivos={['02_serie_semanal.csv', '06_pronostico.csv']} />
        <div className="tarjeta">
          <h1>Plato no encontrado</h1>
          <p className="suave">«{nombre}» no está en los datos.</p>
          <Link className="boton boton-secundario" to="/demanda">
            <ArrowLeft aria-hidden size={16} /> Volver a la demanda
          </Link>
        </div>
      </>
    );
  }

  const reparto = repartoDiario(filaPronostico);
  const pronosticoBajo =
    filaPronostico.unidades_pronosticadas !== null && filaPronostico.unidades_pronosticadas < 1;

  return (
    <>
      <p>
        <Link to="/demanda">
          <ArrowLeft aria-hidden size={14} style={{ verticalAlign: '-2px' }} /> Volver a la demanda
        </Link>
      </p>
      <Encabezado titulo={nombre}>
        {filaPronostico.categoria} · Historia reciente del plato y lo que se espera para la semana del{' '}
        {fechaCorta(filaPronostico.semana_pronostico)}.
      </Encabezado>
      <ErrorArchivo archivos={['02_serie_semanal.csv', '06_pronostico.csv']} />

      {filaPronostico.estado_plato === 'historial_insuficiente' && (
        <Aviso>
          Este plato lleva pocas semanas en el menú: su pronóstico se estima con la media de sus últimas 4
          semanas, no con un modelo.
        </Aviso>
      )}
      {filaPronostico.estado_plato === 'retirado' && (
        <Aviso>
          Este plato está retirado del menú (sin ventas en las últimas 26 semanas), por eso no tiene
          pronóstico.
        </Aviso>
      )}

      <section className="tarjeta">
        <h2>
          Últimas {SEMANAS_GRAFICA} semanas reales y la semana pronosticada{' '}
        </h2>
        {semanaIncompleta && (
          <p className="nota">Semana incompleta (datos hasta el {fechaConDia(ultimaFecha)}).</p>
        )}
        <GraficaSemanal datos={puntos} />
        <LeyendaSemanal
          hayIncompleta={semanaIncompleta}
          hayPronostico={filaPronostico.unidades_pronosticadas !== null}
        />
        <p className="suave">
          Pronóstico: <strong>{unidadesPronosticadas(filaPronostico.unidades_pronosticadas)} unidades</strong>{' '}
          <MarcaOrigen origen="PRED" /> con {nombreOperativo(filaPronostico.metodo)} · Última semana
          observada: {numero(filaPronostico.unidades_ultima_semana)} unidades <MarcaOrigen origen="OBS" />
        </p>
        <Fuente archivos={['02_serie_semanal.csv', '06_pronostico.csv']} origenes={['OBS', 'PRED']} />
      </section>

      {filaPronostico.unidades_redondeadas !== null && (
        <section className="tarjeta">
          <h2>Reparto por día (lunes a sábado)</h2>
          <div className="cuadricula-dias">
            {reparto.map((dia) => (
              <div key={dia.dia} className="dia-reparto">
                <div className="nota">{dia.corto}</div>
                <div className="valor">{numero(dia.unidades)}</div>
              </div>
            ))}
          </div>
          <p className="nota">
            Los días suman {numero(filaPronostico.unidades_redondeadas)} unidades (el pronóstico semanal
            redondeado), repartidas {textoReparto(filaPronostico)}.
            {pronosticoBajo &&
              ' Como se espera menos de 1 unidad, el reparto por día es solo indicativo.'}
          </p>
          <Fuente archivos={['06_pronostico.csv']} origenes={['PRED', 'CALC']} />
        </section>
      )}

      {filaPronostico.estado_plato === 'modelable' && columnasPred.length > 0 && (
        <section className="tarjeta">
          <h2>¿Qué dice cada modelo?</h2>
          <p className="suave">
            El sistema prueba {numero(columnasPred.length)} métodos de pronóstico y usa el de menor error. Sus
            cifras para este plato están en el detalle técnico.
          </p>
          <details className="desplegable">
            <summary>Ver detalle técnico</summary>
            <div className="cuerpo">
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th className="numero">Pronóstico (unidades)</th>
                      <th>¿Es el usado?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnasPred.map((columna) => {
                      const usado = columnaDelMetodo(filaPronostico.metodo, columnasPred) === columna;
                      return (
                        <tr key={columna}>
                          <td>{nombreTecnico(columna)}</td>
                          <td className="numero">
                            {unidadesPronosticadas(filaPronostico[columna] as number | null)}
                          </td>
                          <td>{usado ? 'Sí: tuvo el menor error en validación' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
          <Fuente archivos={['06_pronostico.csv']} origenes={['PRED']} />
        </section>
      )}
    </>
  );
}
