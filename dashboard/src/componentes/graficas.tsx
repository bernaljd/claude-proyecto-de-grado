// Gráficas compartidas (Recharts): barras semanales con la semana pronosticada
// rayada, y el tooltip con formato en español.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fechaCorta, numero } from '../lib/formato';

export interface PuntoSemana {
  semana: string;
  unidades: number;
  tipo: 'observado' | 'incompleta' | 'pronostico';
}

/** Patrón rayado para las barras de pronóstico (otro tono y textura, no solo color). */
export function PatronPronostico({ id = 'rayas-pred' }: { id?: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--morado-200)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--morado-700)" strokeWidth="2.5" />
      </pattern>
    </defs>
  );
}

function TooltipSemana({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PuntoSemana }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0].payload;
  const titulo =
    punto.tipo === 'pronostico'
      ? 'Pronóstico (PRED)'
      : punto.tipo === 'incompleta'
        ? 'Semana incompleta (OBS)'
        : 'Observado (OBS)';
  return (
    <div
      style={{
        background: 'var(--blanco)',
        border: '1px solid var(--morado-200)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: 'var(--sombra)',
        fontSize: '0.85rem',
      }}
    >
      <strong>Semana del {fechaCorta(punto.semana)}</strong>
      <div>
        {numero(punto.unidades, punto.tipo === 'pronostico' ? 1 : 0)} unidades · {titulo}
      </div>
    </div>
  );
}

/**
 * Barras de unidades por semana. Las semanas observadas van en morado, la
 * incompleta en gris y la pronosticada rayada (siempre explicadas en la leyenda).
 */
export function GraficaSemanal({ datos, alto = 260 }: { datos: PuntoSemana[]; alto?: number }) {
  return (
    <div style={{ width: '100%', height: alto }}>
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <PatronPronostico />
          <CartesianGrid vertical={false} stroke="var(--morado-50)" />
          <XAxis
            dataKey="semana"
            tickFormatter={(valor: string) => fechaCorta(valor).slice(0, 6)}
            tick={{ fontSize: 11, fill: 'var(--texto-suave)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--morado-200)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--texto-suave)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<TooltipSemana />} cursor={{ fill: 'var(--morado-50)' }} />
          <Bar dataKey="unidades" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {datos.map((punto) => (
              <Cell
                key={punto.semana}
                fill={
                  punto.tipo === 'pronostico'
                    ? 'url(#rayas-pred)'
                    : punto.tipo === 'incompleta'
                      ? 'var(--texto-suave)'
                      : 'var(--morado-500)'
                }
                stroke={punto.tipo === 'pronostico' ? 'var(--morado-700)' : 'none'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Leyenda fija de la gráfica semanal (identidad nunca solo por color). */
export function LeyendaSemanal({ hayIncompleta, hayPronostico }: { hayIncompleta: boolean; hayPronostico: boolean }) {
  return (
    <div className="leyenda-grafica">
      <span>
        <span className="muestra-color" style={{ background: 'var(--morado-500)' }} /> Semanas observadas (OBS)
      </span>
      {hayIncompleta && (
        <span>
          <span className="muestra-color" style={{ background: 'var(--texto-suave)' }} /> Semana incompleta
        </span>
      )}
      {hayPronostico && (
        <span>
          <span
            className="muestra-color"
            style={{
              background:
                'repeating-linear-gradient(45deg, var(--morado-700) 0 2px, var(--morado-200) 2px 6px)',
            }}
          />{' '}
          Semana pronosticada (PRED, barra rayada)
        </span>
      )}
    </div>
  );
}
