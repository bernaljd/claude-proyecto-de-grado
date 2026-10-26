// Esquema de los JSON exportados por src/exportar.py
export type Estado = "modelable" | "historial_insuficiente" | "retirado";
export type CategoriaMenu = "Estrella" | "Caballo de arado" | "Puzzle" | "Perro";

export interface Resumen {
  rango: { desde: string; hasta: string };
  ultima_semana: string;
  semana_proyectada: string;
  unidades_ultima_semana: number;
  unidades_semana_anterior: number;
  total_proyectado: number;
  n_alertas: number;
  platos_por_categoria: Partial<Record<CategoriaMenu, number>>;
  fecha_calculo: string;
}

export interface Plato {
  plato: string;
  categoria: string;
  estado: Estado;
  ultimas_12: { semana: string; unidades: number }[];
  proyeccion: number | null;
  proyeccion_exacta: number | null;
  participacion_dia: number[];
  reparto_diario: number[] | null;
  precio: number;
  costo: number;
  margen: number;
}
export interface PlatosJson { dias: string[]; platos: Plato[] }

export interface SeriePlato { categoria: string; estado: Estado; u: number[]; i: number[]; c: number[] }
export interface SerieSemanal { semanas: string[]; platos: Record<string, SeriePlato> }

export interface FilaMenu {
  plato: string; categoria: string; unidades: number; precio: number; costo: number;
  margen: number; popularidad: number; categoria_menu: CategoriaMenu; accion: string;
}
export interface Umbrales { margen_ponderado: number; umbral_popularidad: number; n_platos: number }
export interface Alerta { plato: string; historica: CategoriaMenu; proyectada: CategoriaMenu; accion: string }
export interface IngenieriaMenu {
  periodo: { desde: string; hasta: string };
  historica: { umbrales: Umbrales; platos: FilaMenu[] };
  proyectada: { umbrales: Umbrales; platos: FilaMenu[] };
  alertas: Alerta[];
  acciones: Record<CategoriaMenu, string>;
}

export interface FilaRanking {
  plato: string; unidades: number; semanas_top5: number; pct_semanas_con_venta: number;
  mediana_unidades_con_venta: number; puesto_total: number;
}
export interface Ranking { ranking: FilaRanking[] }

export interface Metricas { MAE: number; RMSE: number; SMAPE: number }
export interface Confiabilidad {
  modelo_vigente: string;
  hiperparametros: Record<string, unknown>;
  metricas_prueba: { por_plato: Metricas; total_semanal: Metricas };
  rango_datos: { desde: string; hasta: string };
  fecha_calculo: string;
  frases: { MAE: string; RMSE: string; SMAPE: string; total: string };
}

export interface ModeloMeta {
  vigente: "base" | "xgboost";
  columnas: string[]; platos: string[]; categorias: string[];
  objetivo: "reg:squarederror" | "reg:tweedie";
  base_score: number; n_arboles: number; semana_proyectada: string;
}

/** Todo lo que consumen las vistas (por defecto, los JSON; tras una carga, el cálculo del navegador). */
export interface Datos {
  resumen: Resumen; platos: PlatosJson; serie: SerieSemanal; menu: IngenieriaMenu;
  ranking: Ranking; confiabilidad: Confiabilidad; actualizado?: string; origen: "original" | "archivo";
  resumenCarga?: string[];
}
