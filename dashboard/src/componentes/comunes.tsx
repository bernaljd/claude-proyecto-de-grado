// Piezas compartidas: bloque «Fuente», marcas OBS/PRED/CALC, chips de
// clasificación, avisos y esqueletos de carga.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDatos } from '../DatosContext';
import { fechaHora } from '../lib/formato';
import type { Clasificacion, Origen } from '../lib/tipos';

/** Marca del origen de un número: observado, pronosticado o calculado. Siempre con la letra escrita. */
export function MarcaOrigen({ origen }: { origen: Origen }) {
  const titulo = {
    OBS: 'Observado: ventas reales registradas',
    PRED: 'Pronóstico: lo estimó un modelo',
    CALC: 'Calculado: sale de una fórmula que se muestra',
  }[origen];
  return (
    <span className={`marca-origen ${origen.toLowerCase()}`} title={titulo}>
      {origen}
    </span>
  );
}

/**
 * Bloque «Fuente»: el CSV de origen, el módulo que lo genera, la fecha de
 * cálculo y el enlace para ver el archivo completo en «Datos y fuentes».
 */
export function Fuente({ archivos, origenes, nota }: { archivos: string[]; origenes: Origen[]; nota?: string }) {
  const { manifiesto } = useDatos();
  return (
    <div className="fuente">
      <strong>Fuente:</strong>
      {archivos.map((archivo) => {
        const info = manifiesto?.archivos.find((entrada) => entrada.nombre === archivo);
        return (
          <span key={archivo}>
            <code>{archivo}</code>
            {info ? ` (módulo ${info.modulo}, calculado el ${fechaHora(info.copiado_en)})` : ''}
          </span>
        );
      })}
      {origenes.map((origen) => (
        <MarcaOrigen key={origen} origen={origen} />
      ))}
      {nota && <span>{nota}</span>}
      <Link to="/datos">Ver este CSV</Link>
    </div>
  );
}

const CLASE_CLASIFICACION: Record<Clasificacion, string> = {
  Estrella: 'estrella',
  'Caballo de arado': 'caballo',
  Puzzle: 'puzzle',
  Perro: 'perro',
};

/** Chip de la clasificación del menú: el color siempre va acompañado del nombre. */
export function ChipClasificacion({ clasificacion }: { clasificacion: Clasificacion }) {
  return <span className={`chip-categoria ${CLASE_CLASIFICACION[clasificacion]}`}>{clasificacion}</span>;
}

export const COLOR_CLASIFICACION: Record<Clasificacion, string> = {
  Estrella: 'var(--cat-estrella)',
  'Caballo de arado': 'var(--cat-caballo)',
  Puzzle: 'var(--cat-puzzle)',
  Perro: 'var(--cat-perro)',
};

/** Aviso amarillo (nunca es el único indicador: lleva ícono y texto). */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="aviso" role="status">
      <AlertTriangle aria-hidden size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </p>
  );
}

/** Mensaje cuando falta un archivo o una columna: la vista lo dice y las demás siguen. */
export function ErrorArchivo({ archivos }: { archivos: string[] }) {
  const { errores } = useDatos();
  const presentes = archivos.filter((archivo) => errores[archivo]);
  if (presentes.length === 0) return null;
  return (
    <div className="aviso-error" role="alert">
      <strong>No se pudieron leer los datos de esta vista.</strong>
      <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
        {presentes.map((archivo) => (
          <li key={archivo}>{errores[archivo]}</li>
        ))}
      </ul>
    </div>
  );
}

/** Esqueletos mientras cargan los CSV. */
export function Esqueleto({ alto = 120, cantidad = 1 }: { alto?: number; cantidad?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando los datos">
      {Array.from({ length: cantidad }, (_, indice) => (
        <div key={indice} className="esqueleto" style={{ minHeight: alto }} />
      ))}
    </div>
  );
}

/** Título de la vista con su frase de explicación. */
export function Encabezado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <header className="encabezado-vista">
      <h1>{titulo}</h1>
      <p className="descripcion-vista">{children}</p>
    </header>
  );
}
