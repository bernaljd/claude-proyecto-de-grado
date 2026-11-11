// Cargar datos (RF-01, RF-02 adaptados): el pipeline corre en el computador y el
// dashboard es de solo lectura. Aquí se explica cómo actualizar y se puede
// validar un CSV de ventas en el navegador, sin guardar nada ni predecir.
import { useMemo, useRef, useState } from 'react';
import { FileCheck2, Upload } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { Aviso, Encabezado, Esqueleto, Fuente } from '../componentes/comunes';
import { COLUMNAS_ENTRADA, DESCRIPCION_COLUMNAS } from '../lib/columnasEntrada';
import { fechaCorta, fechaHora, numero } from '../lib/formato';
import { validarVentas } from '../lib/validarVentas';
import type { ResumenValidacion } from '../lib/validarVentas';

export default function Cargar() {
  const { cargando, manifiesto, ventas, ultimaFecha } = useDatos();
  const [resumen, setResumen] = useState<ResumenValidacion | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [errorLectura, setErrorLectura] = useState('');
  const entradaArchivo = useRef<HTMLInputElement>(null);

  const primeraFecha = useMemo(
    () =>
      ventas?.reduce<string | undefined>(
        (minima, fila) => (!minima || fila.fecha < minima ? fila.fecha : minima),
        undefined,
      ),
    [ventas],
  );

  async function procesar(archivo: File | undefined) {
    setErrorLectura('');
    setResumen(null);
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    try {
      const texto = await archivo.text();
      setResumen(validarVentas(texto));
    } catch {
      setErrorLectura('No se pudo leer el archivo. Verifique que sea un CSV.');
    }
  }

  if (cargando) return <Esqueleto cantidad={2} alto={160} />;

  return (
    <>
      <Encabezado titulo="Cargar datos">
        El dashboard solo lee resultados: los datos se actualizan corriendo el pipeline en el computador.
        Aquí puede revisar un CSV de ventas antes de hacerlo.
      </Encabezado>

      <section className="tarjeta">
        <h2>Cómo actualizar los datos (3 pasos)</h2>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8 }}>
          <li>
            Guarde el CSV de ventas del restaurante donde está <code>ventas_originales.csv</code> (la entrada
            del módulo M1, en <code>dataset/raw/</code>), reemplazándolo.
          </li>
          <li>
            En la carpeta <code>dashboard</code> del proyecto, corra <code>npm run actualizar</code>. El
            comando ejecuta los seis módulos del pipeline (el entrenamiento tarda unos 15 minutos) y copia
            los resultados al dashboard.
          </li>
          <li>Recargue esta página: todas las vistas mostrarán los datos nuevos.</li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2>Última actualización</h2>
        <p className="suave" style={{ marginBottom: 0 }}>
          Los datos del dashboard se calcularon el <strong>{fechaHora(manifiesto?.generado_en)}</strong>
          {primeraFecha && ultimaFecha && (
            <>
              {' '}
              y cubren las ventas del {fechaCorta(primeraFecha)} al {fechaCorta(ultimaFecha)}
            </>
          )}
          .
        </p>
        <Fuente archivos={['01_ventas_limpias.csv']} origenes={['OBS']} />
      </section>

      <section className="tarjeta">
        <h2>Revisar un CSV de ventas</h2>
        <p className="suave">
          Arrastre aquí el archivo para comprobar, antes de correr el pipeline, que tiene las{' '}
          {numero(COLUMNAS_ENTRADA.length)} columnas del restaurante y cuántos registros se excluirían.
        </p>
        <Aviso>
          El archivo no sale de su navegador y no cambia los resultados; para actualizarlos corra el comando.
        </Aviso>
        <div
          className={`zona-arrastre ${arrastrando ? 'encima' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Elegir o arrastrar un archivo CSV de ventas"
          onClick={() => entradaArchivo.current?.click()}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') entradaArchivo.current?.click();
          }}
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(evento) => {
            evento.preventDefault();
            setArrastrando(false);
            void procesar(evento.dataTransfer.files?.[0]);
          }}
        >
          <Upload aria-hidden size={28} style={{ color: 'var(--morado-700)' }} />
          <p style={{ margin: '8px 0 0' }}>
            Arrastre el CSV de ventas aquí, o <strong>elija un archivo</strong>
          </p>
          <label className="visually-hidden" htmlFor="archivo-ventas">
            Archivo CSV de ventas
          </label>
          <input
            id="archivo-ventas"
            ref={entradaArchivo}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(evento) => void procesar(evento.target.files?.[0] ?? undefined)}
          />
        </div>

        {errorLectura && <p className="aviso-error">{errorLectura}</p>}

        {resumen && (
          <div style={{ marginTop: 16 }}>
            <h3>
              <FileCheck2 aria-hidden size={16} style={{ verticalAlign: '-2px' }} /> Resultado de{' '}
              <code>{nombreArchivo}</code>
            </h3>
            {resumen.columnasFaltantes.length > 0 ? (
              <div className="aviso-error" role="alert">
                <strong>Al archivo le faltan columnas que el sistema necesita:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {resumen.columnasFaltantes.map((columna) => (
                    <li key={columna}>{columna}</li>
                  ))}
                </ul>
                <p style={{ marginBottom: 0 }}>
                  Exporte las ventas con las mismas columnas del archivo original del restaurante.
                </p>
              </div>
            ) : (
              <>
                <ul className="suave" style={{ marginTop: 6 }}>
                  <li>
                    Registros leídos: <strong>{numero(resumen.registrosLeidos)}</strong>; quedarían{' '}
                    <strong>{numero(resumen.registrosValidos)}</strong> ventas válidas.
                  </li>
                  {resumen.excluidos.map((grupo) => (
                    <li key={grupo.motivo}>
                      Se excluirían {numero(grupo.filas)} por: {grupo.motivo.toLowerCase()}.
                    </li>
                  ))}
                  <li>
                    Fechas: del {fechaCorta(resumen.fechaMinima)} al {fechaCorta(resumen.fechaMaxima)} ·{' '}
                    {numero(resumen.numeroPlatos)} platos distintos.
                  </li>
                </ul>
                <p className="nota">
                  Si todo se ve bien, siga los 3 pasos de arriba para actualizar los resultados.
                </p>
              </>
            )}
          </div>
        )}

        <details className="desplegable">
          <summary>Ver las {numero(COLUMNAS_ENTRADA.length)} columnas que exige el sistema</summary>
          <div className="cuerpo">
            <ul className="nota" style={{ margin: 0, paddingLeft: 18 }}>
              {COLUMNAS_ENTRADA.map((columna) => (
                <li key={columna}>
                  <code>{columna}</code>: {DESCRIPCION_COLUMNAS[columna]}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </section>
    </>
  );
}
