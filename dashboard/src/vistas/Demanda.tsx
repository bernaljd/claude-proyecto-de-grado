// Demanda por plato (RF-10): lista ordenable con filtros por categoría del menú
// y búsqueda por nombre. En celular las filas se vuelven tarjetas.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { Encabezado, ErrorArchivo, Esqueleto, Fuente } from '../componentes/comunes';
import { fechaCorta, numero, unidadesPronosticadas } from '../lib/formato';
import type { FilaPronostico } from '../lib/tipos';

type Columna = 'plato' | 'pronostico' | 'ultima';

export default function Demanda() {
  const { cargando, pronostico } = useDatos();
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [orden, setOrden] = useState<{ columna: Columna; ascendente: boolean }>({
    columna: 'pronostico',
    ascendente: false,
  });

  const categorias = useMemo(
    () => [...new Set((pronostico ?? []).map((fila) => fila.categoria))].sort(),
    [pronostico],
  );

  const filas = useMemo(() => {
    let lista = pronostico ?? [];
    if (categoria !== 'todas') lista = lista.filter((fila) => fila.categoria === categoria);
    if (busqueda.trim() !== '') {
      const texto = busqueda.trim().toLowerCase();
      lista = lista.filter((fila) => fila.plato.toLowerCase().includes(texto));
    }
    const comparar = (a: FilaPronostico, b: FilaPronostico): number => {
      switch (orden.columna) {
        case 'plato':
          return a.plato.localeCompare(b.plato);
        case 'ultima':
          return a.unidades_ultima_semana - b.unidades_ultima_semana;
        default:
          return (a.unidades_pronosticadas ?? -1) - (b.unidades_pronosticadas ?? -1);
      }
    };
    return [...lista].sort((a, b) => (orden.ascendente ? comparar(a, b) : comparar(b, a)));
  }, [pronostico, categoria, busqueda, orden]);

  const semana = pronostico?.[0]?.semana_pronostico;

  function Encabezal({ columna, children }: { columna: Columna; children: string }) {
    const activa = orden.columna === columna;
    return (
      <th aria-sort={activa ? (orden.ascendente ? 'ascending' : 'descending') : undefined}>
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
          {children}
          {activa && (orden.ascendente ? <ArrowUp aria-hidden size={14} /> : <ArrowDown aria-hidden size={14} />)}
        </button>
      </th>
    );
  }

  if (cargando) return <Esqueleto cantidad={2} alto={200} />;

  return (
    <>
      <Encabezado titulo="Demanda por plato">
        Cuántas unidades de cada plato se esperan vender en la semana del {fechaCorta(semana)}. Elija un
        plato para ver su historia y su reparto por día.
      </Encabezado>
      <ErrorArchivo archivos={['06_pronostico.csv']} />

      {pronostico && (
        <section className="tarjeta">
          <div className="fila-controles">
            <label>
              Buscar un plato
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Nombre del plato"
              />
            </label>
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
            <span className="nota">{numero(filas.length)} platos</span>
          </div>

          <div className="tabla-envoltura">
            <table className="tabla tabla-tarjetas">
              <thead>
                <tr>
                  <Encabezal columna="plato">Plato</Encabezal>
                  <Encabezal columna="pronostico">Pronóstico (unidades)</Encabezal>
                  <Encabezal columna="ultima">Última semana</Encabezal>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.plato}>
                    <td data-etiqueta="">
                      <Link to={`/demanda/${encodeURIComponent(fila.plato)}`}>
                        <strong>{fila.plato}</strong>
                      </Link>
                      <div className="nota">{fila.categoria}</div>
                    </td>
                    <td className="numero" data-etiqueta="Pronóstico">
                      {fila.estado_plato === 'retirado' ? '—' : unidadesPronosticadas(fila.unidades_pronosticadas)}
                    </td>
                    <td className="numero" data-etiqueta="Última semana">
                      {numero(fila.unidades_ultima_semana)}
                    </td>
                    <td data-etiqueta="Nota">
                      {fila.estado_plato === 'historial_insuficiente' && (
                        <span
                          className="etiqueta-estado"
                          title="Se estima con la media de sus últimas 4 semanas"
                        >
                          Poco historial
                        </span>
                      )}
                      {fila.estado_plato === 'retirado' && (
                        <span className="etiqueta-estado" title="Sin ventas en las últimas 26 semanas: sin pronóstico">
                          Retirado del menú
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota">
            «Poco historial»: el plato lleva pocas semanas en el menú y se estima con la media de sus últimas
            4 semanas. «Retirado del menú»: sin ventas recientes, no se pronostica.
          </p>
          <Fuente archivos={['06_pronostico.csv']} origenes={['OBS', 'PRED']} />
        </section>
      )}
    </>
  );
}
