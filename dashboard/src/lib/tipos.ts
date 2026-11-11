// Tipos de cada CSV que deja el pipeline (contrato de la sección «Datos y fuentes»).
// Una celda vacía llega como null: es un valor no disponible, nunca un 0.

export interface FilaVenta {
  id_pedido: string;
  fecha: string; // ISO aaaa-mm-dd
  dia_semana: string;
  hora: string;
  plato: string;
  categoria: string;
  cantidad: number;
  precio_unitario: number;
  ventas_brutas: number;
  costo: number;
  margen: number;
}

export interface FilaSerie {
  semana_inicio: string; // lunes, ISO
  plato: string;
  categoria: string;
  unidades: number;
  ventas: number;
  costo: number;
  margen: number;
  precio_unitario: number | null; // vacío en semanas inactivas
  activo: number; // 0/1
}

export interface FilaParticion {
  semana_inicio: string;
  conjunto: 'entrenamiento' | 'validacion' | 'prueba';
}

export interface FilaPlatoModelable {
  plato: string;
  primera_venta: string | null;
  ultima_venta: string | null;
  semanas_historia: number;
  estado_plato: EstadoPlato;
}

export type EstadoPlato = 'modelable' | 'historial_insuficiente' | 'retirado';

// 06_pronostico.csv: además de estas columnas fijas trae una columna pred_* por
// modelo; se detectan dinámicamente y quedan en el resto de la fila.
export interface FilaPronostico {
  plato: string;
  categoria: string;
  estado_plato: EstadoPlato;
  semana_pronostico: string;
  unidades_ultima_semana: number;
  unidades_pronosticadas: number | null; // vacío en retirados
  unidades_redondeadas: number | null;
  metodo: string; // nombre del modelo, 'media_movil' o 'ninguno'
  lun: number | null;
  mar: number | null;
  mie: number | null;
  jue: number | null;
  vie: number | null;
  sab: number | null;
  reparto_dia_segun: 'plato' | 'categoria' | 'menu' | '' | null;
  [predColumna: string]: unknown; // pred_mm4, pred_lstm, ... (dinámicas)
}

export type Clasificacion = 'Estrella' | 'Caballo de arado' | 'Puzzle' | 'Perro';

export interface FilaMenu {
  escenario: 'historico' | 'proyectado';
  plato: string;
  unidades: number;
  margen_unitario: number;
  popularidad_pct: number;
  umbral_margen: number;
  umbral_popularidad: number;
  clasificacion: Clasificacion;
  cambia_de_categoria: 'sí' | 'no' | '' | null;
  accion_sugerida: string;
}

// 05_predicciones.csv: y_real más una columna pred_* por modelo (dinámicas)
export interface FilaPrediccion {
  fila_id: number;
  plato: string;
  semana_objetivo: string;
  conjunto: string;
  y_real: number;
  [predColumna: string]: unknown;
}

export interface FilaMetrica {
  modelo: string;
  conjunto: string;
  n: number;
  mae: number;
  rmse: number;
  smape: number;
  accuracy: number;
  accuracy_sobre_cero: number;
  precision: number;
  recall: number;
  f1: number;
  wape: number;
  mase: number;
  mae_con_venta: number;
  unidades_reales: number;
  unidades_pronosticadas: number;
  sesgo: number;
  supera_mm4: number | null;
  exito: 'sí' | 'no' | null;
  vigente: 'sí' | 'no';
}

export interface FilaMatrizConfusion {
  modelo: string;
  vp: number;
  fp: number;
  fn: number;
  vn: number;
}

export interface FilaEntrenamiento {
  modelo: string;
  combinacion: number | null;
  hiperparametros: string;
  semilla: number | null;
  mae_validacion: number | null;
  rmse_validacion: number | null;
  smape_validacion: number | null;
  accuracy_validacion: number | null;
  precision_validacion: number | null;
  recall_validacion: number | null;
  f1_validacion: number | null;
  mejor_del_modelo: 'sí' | 'no';
  vigente: 'sí' | 'no';
}

export interface ArchivoManifiesto {
  nombre: string;
  modulo: string; // M1 a M6
  filas: number;
  bytes: number;
  copiado_en: string; // ISO con hora
}

export interface Manifiesto {
  generado_en: string;
  archivos: ArchivoManifiesto[];
}

// Origen de cada número que muestra el dashboard
export type Origen = 'OBS' | 'PRED' | 'CALC';
