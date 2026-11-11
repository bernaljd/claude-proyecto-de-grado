// Nombres de los métodos de pronóstico en lenguaje de administrador.
// Los nombres técnicos (los de los CSV) solo pueden aparecer en las vistas
// «Confiabilidad» y «Datos y fuentes», y dentro del desplegable «Ver detalle
// técnico» de la vista de demanda (requisito RNF-02).

const NOMBRES_OPERATIVOS: Record<string, string> = {
  MM4: 'media móvil de 4 semanas',
  GradientBoosting: 'árboles de decisión',
  LSTM: 'red neuronal de series de tiempo',
  ARIMA: 'modelo estadístico de series de tiempo',
  SARIMA: 'modelo estadístico estacional',
  media_movil: 'media de sus últimas 4 semanas',
  ninguno: 'sin pronóstico',
};

/** Nombre del método en lenguaje de administrador (sin términos técnicos). */
export function nombreOperativo(metodo: string | null | undefined): string {
  if (!metodo) return 'sin pronóstico';
  return NOMBRES_OPERATIVOS[metodo] ?? 'modelo de pronóstico';
}

/** Nombre técnico legible de una columna pred_* («pred_gradient_boosting» → «GradientBoosting»). */
export function nombreTecnico(columnaPred: string): string {
  const CONOCIDOS: Record<string, string> = {
    pred_mm4: 'MM4',
    pred_gradient_boosting: 'GradientBoosting',
    pred_lstm: 'LSTM',
    pred_arima: 'ARIMA',
    pred_sarima: 'SARIMA',
  };
  return CONOCIDOS[columnaPred] ?? columnaPred.replace(/^pred_/, '');
}

/** El método de un plato («LSTM») corresponde a una columna pred_* («pred_lstm»). */
export function columnaDelMetodo(metodo: string, columnasPred: string[]): string | null {
  const buscado = metodo.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    columnasPred.find((columna) => columna.replace(/^pred_/, '').replace(/[^a-z0-9]/g, '') === buscado) ?? null
  );
}
