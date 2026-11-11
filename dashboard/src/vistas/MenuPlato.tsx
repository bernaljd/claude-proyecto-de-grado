// Detalle del plato en el menú (RF-09): precio, costo y margen unitarios,
// umbrales aplicados, clasificación histórica y proyectada, y acción sugerida.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { ChipClasificacion, Encabezado, ErrorArchivo, Esqueleto, Fuente, MarcaOrigen } from '../componentes/comunes';
import { GraficaSemanal, LeyendaSemanal } from '../componentes/graficas';
import type { PuntoSemana } from '../componentes/graficas';
import { moneda, numero, porcentaje } from '../lib/formato';

const SEMANAS_GRAFICA = 26;

export default function MenuPlato() {
  const { plato = '' } = useParams();
  const nombre = decodeURIComponent(plato);
  const { cargando, menu, serie, semanaIncompleta } = useDatos();

  const historico = useMemo(
    () => menu?.find((fila) => fila.escenario === 'historico' && fila.plato === nombre),
    [menu, nombre],
  );
  const proyectado = useMemo(
    () => menu?.find((fila) => fila.escenario === 'proyectado' && fila.plato === nombre),
    [menu, nombre],
  );

  const propias = useMemo(
    () =>
      (serie ?? [])
        .filter((fila) => fila.plato === nombre)
        .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio)),
    [serie, nombre],
  );

  const precioActual = useMemo(() => {
    for (let indice = propias.length - 1; indice >= 0; indice -= 1) {
      const precio = propias[indice].precio_unitario;
      if (precio !== null) return precio;
    }
    return null;
  }, [propias]);

  const puntos = useMemo<PuntoSemana[]>(
    () =>
      propias.slice(-SEMANAS_GRAFICA).map((fila, indice, lista) => ({
        semana: fila.semana_inicio,
        unidades: fila.unidades,
        tipo: semanaIncompleta && indice === lista.length - 1 ? 'incompleta' : 'observado',
      })),
    [propias, semanaIncompleta],
  );

  if (cargando) return <Esqueleto cantidad={2} alto={200} />;

  const referencia = historico ?? proyectado;
  if (!referencia) {
    return (
      <>
        <ErrorArchivo archivos={['06_ingenieria_menu.csv', '02_serie_semanal.csv']} />
        <div className="tarjeta">
          <h1>{nombre}</h1>
          <p className="suave">
            Este plato no entra en la matriz (no tuvo ventas en las últimas 12 semanas ni pronóstico mayor
            que 0).
          </p>
          <Link className="boton boton-secundario" to="/menu">
            <ArrowLeft aria-hidden size={16} /> Volver a la matriz
          </Link>
        </div>
      </>
    );
  }

  const margenUnitario = referencia.margen_unitario;
  const costoUnitario = precioActual !== null ? precioActual - margenUnitario : null;

  return (
    <>
      <p>
        <Link to="/menu">
          <ArrowLeft aria-hidden size={14} style={{ verticalAlign: '-2px' }} /> Volver a la matriz
        </Link>
      </p>
      <Encabezado titulo={nombre}>
        Cómo le va a este plato en el menú: lo que deja por unidad, cuánto se pide y qué acción sugiere la
        matriz.
      </Encabezado>
      <ErrorArchivo archivos={['06_ingenieria_menu.csv', '02_serie_semanal.csv']} />

      <div className="rejilla-tarjetas">
        <section className="tarjeta">
          <div className="titulo-tarjeta">
            Precio, costo y margen por unidad <MarcaOrigen origen="OBS" /> <MarcaOrigen origen="CALC" />
          </div>
          <div className="cifra">{moneda(precioActual)}</div>
          <p className="suave" style={{ marginBottom: 0 }}>
            Precio actual (último precio registrado). Costo: {moneda(costoUnitario)} · Margen:{' '}
            {moneda(margenUnitario)} por unidad.
          </p>
        </section>
        <section className="tarjeta">
          <div className="titulo-tarjeta">
            Popularidad y umbrales aplicados <MarcaOrigen origen="CALC" />
          </div>
          <div className="cifra">{porcentaje(referencia.popularidad_pct)}</div>
          <p className="suave" style={{ marginBottom: 0 }}>
            de las unidades del escenario. Umbral de popularidad: {porcentaje(referencia.umbral_popularidad)} ·
            Umbral de margen: {moneda(referencia.umbral_margen)}.
          </p>
        </section>
        <section className="tarjeta">
          <div className="titulo-tarjeta">Clasificación</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span className="nota">Histórica (últimas 12 semanas): </span>
              {historico ? <ChipClasificacion clasificacion={historico.clasificacion} /> : '—'}
            </div>
            <div>
              <span className="nota">Proyectada (semana siguiente): </span>
              {proyectado ? <ChipClasificacion clasificacion={proyectado.clasificacion} /> : '—'}
              {proyectado?.cambia_de_categoria === 'sí' && (
                <span className="etiqueta-estado" style={{ marginLeft: 6 }}>
                  Cambia de categoría
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="tarjeta">
        <h2>Acción sugerida</h2>
        <p>{(proyectado ?? historico)?.accion_sugerida}</p>
        <p className="nota">La acción es informativa: el sistema no cambia precios ni el menú.</p>
        <Fuente archivos={['06_ingenieria_menu.csv']} origenes={['CALC']} />
      </section>

      {puntos.length > 0 && (
        <section className="tarjeta">
          <h2>Ventas semanales del plato (últimas {numero(Math.min(SEMANAS_GRAFICA, puntos.length))} semanas)</h2>
          <GraficaSemanal datos={puntos} alto={200} />
          <LeyendaSemanal hayIncompleta={semanaIncompleta} hayPronostico={false} />
          <p className="suave" style={{ marginBottom: 0 }}>
            <Link to={`/demanda/${encodeURIComponent(nombre)}`}>Ver el pronóstico de demanda de este plato</Link>
          </p>
          <Fuente archivos={['02_serie_semanal.csv']} origenes={['OBS']} />
        </section>
      )}
    </>
  );
}
