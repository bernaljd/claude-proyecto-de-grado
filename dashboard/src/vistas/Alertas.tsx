// Alertas (RF-08): platos cuya clasificación proyectada difiere de la
// histórica, ordenados por popularidad proyectada.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { Aviso, ChipClasificacion, Encabezado, ErrorArchivo, Esqueleto, Fuente } from '../componentes/comunes';
import { numero, unidadesPronosticadas } from '../lib/formato';

export default function Alertas() {
  const { cargando, menu } = useDatos();

  const alertas = useMemo(() => {
    if (!menu) return undefined;
    const historico = new Map(
      menu.filter((fila) => fila.escenario === 'historico').map((fila) => [fila.plato, fila]),
    );
    return menu
      .filter((fila) => fila.escenario === 'proyectado' && fila.cambia_de_categoria === 'sí')
      .sort((a, b) => b.popularidad_pct - a.popularidad_pct)
      .map((fila) => ({ proyectado: fila, historico: historico.get(fila.plato) }));
  }, [menu]);

  const totalProyectados = useMemo(
    () => menu?.filter((fila) => fila.escenario === 'proyectado').length ?? 0,
    [menu],
  );

  if (cargando) return <Esqueleto cantidad={2} alto={140} />;

  const muchas = alertas !== undefined && totalProyectados > 0 && alertas.length > totalProyectados / 2;

  return (
    <>
      <Encabezado titulo="Alertas">
        Platos que cambiarían de categoría en la matriz del menú la próxima semana, según el pronóstico de
        demanda.
      </Encabezado>
      <ErrorArchivo archivos={['06_ingenieria_menu.csv']} />

      {muchas && (
        <Aviso>
          Más de la mitad de los platos cambiaría de categoría. Con una demanda tan baja, la proyección es
          poco estable: tome estas alertas como una guía, no como un hecho.
        </Aviso>
      )}

      {alertas && alertas.length === 0 && (
        <section className="tarjeta">
          <p style={{ margin: 0 }}>No hay alertas: ningún plato cambia de categoría.</p>
        </section>
      )}

      {alertas && alertas.length > 0 && (
        <section className="tarjeta">
          <p className="suave">{numero(alertas.length)} platos con cambio de categoría proyectado.</p>
          <div className="tabla-envoltura">
            <table className="tabla tabla-tarjetas">
              <thead>
                <tr>
                  <th>Plato</th>
                  <th>Cambio proyectado</th>
                  <th>Demanda esperada</th>
                  <th>Acción sugerida</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map(({ proyectado, historico }) => (
                  <tr key={proyectado.plato}>
                    <td data-etiqueta="">
                      <Link to={`/menu/${encodeURIComponent(proyectado.plato)}`}>
                        <strong>{proyectado.plato}</strong>
                      </Link>
                    </td>
                    <td data-etiqueta="Cambio">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {historico ? <ChipClasificacion clasificacion={historico.clasificacion} /> : '—'}
                        <ArrowRight aria-hidden size={14} />
                        <ChipClasificacion clasificacion={proyectado.clasificacion} />
                      </span>
                    </td>
                    <td className="numero" data-etiqueta="Demanda esperada">
                      {unidadesPronosticadas(proyectado.unidades)} unidades
                    </td>
                    <td data-etiqueta="Acción">{proyectado.accion_sugerida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Fuente archivos={['06_ingenieria_menu.csv']} origenes={['PRED', 'CALC']} />
        </section>
      )}
    </>
  );
}
