// Arma los objetos que usan las vistas a partir de los CSV de web/public/data/.
import type {
  Alerta, CategoriaMenu, Confiabilidad, Datos, Estado, FilaMenu, FilaRanking, IngenieriaMenu, ModeloMeta, Plato, Umbrales,
} from "../types";
import { claveValor, type Fila, filas, type Fuente } from "./csv";
import { cargarModelo, type ModeloXgb } from "./xgboost";

const ABREV = ["lun", "mar", "mie", "jue", "vie", "sab"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const num = (v: unknown) => Number(v);

export async function leerDatos(f: Fuente): Promise<Datos> {
  const [kv, serieT, platosT, histT, proyT, umbT, alT, acT, rankT, confT, confM] = await Promise.all([
    "resumen.csv", "serie_semanal.csv", "platos.csv", "menu_historica.csv", "menu_proyectada.csv", "menu_umbrales.csv",
    "menu_alertas.csv", "menu_acciones.csv", "ranking.csv", "confiabilidad.csv", "confiabilidad_metricas.csv",
  ].map((n) => f.texto(n)));

  // Serie semanal: de tabla larga (una fila por plato y semana) a un arreglo por plato
  const s = filas<{ plato: string; categoria: string; estado: Estado; semana: string; unidades: number; ingreso: number; costo: number }>(serieT);
  const semanas = [...new Set(s.map((r) => r.semana))].sort();
  const idx = new Map(semanas.map((w, i) => [w, i]));
  const series: Datos["serie"]["platos"] = {};
  for (const r of s) {
    const p = (series[r.plato] ??= {
      categoria: r.categoria, estado: r.estado,
      u: semanas.map(() => 0), i: semanas.map(() => 0), c: semanas.map(() => 0),
    });
    const k = idx.get(r.semana)!;
    p.u[k] = r.unidades; p.i[k] = r.ingreso; p.c[k] = r.costo;
  }

  const r = claveValor(kv);
  const porCategoria: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) if (k.startsWith("n_") && k !== "n_alertas") porCategoria[k.slice(2)] = num(v);

  const platos: Plato[] = filas<Fila>(platosT).map((x) => {
    const nombre = String(x.plato), sp = series[nombre];
    const proy = x.proyeccion === null ? null : num(x.proyeccion);
    return {
      plato: nombre, categoria: String(x.categoria), estado: x.estado as Estado,
      ultimas_12: semanas.slice(-12).map((w, j) => ({ semana: w, unidades: sp.u[semanas.length - 12 + j] ?? 0 })),
      proyeccion: proy, proyeccion_exacta: x.proyeccion_exacta === null ? null : num(x.proyeccion_exacta),
      participacion_dia: ABREV.map((a) => num(x[`part_${a}`])),
      reparto_diario: proy === null ? null : ABREV.map((a) => num(x[`reparto_${a}`])),
      precio: num(x.precio), costo: num(x.costo), margen: num(x.margen),
    };
  });

  const menu = (t: string) => filas<Fila>(t).map((x) => ({
    plato: String(x.plato), categoria: String(x.categoria), unidades: num(x.unidades), precio: num(x.precio),
    costo: num(x.costo), margen: num(x.margen), popularidad: num(x.popularidad),
    categoria_menu: x.categoria_menu as CategoriaMenu, accion: String(x.accion),
  })) as FilaMenu[];
  const umb = filas<Fila>(umbT);
  const u = (v: string): Umbrales & { desde: string; hasta: string } => {
    const x = umb.find((q) => q.version === v)!;
    return { margen_ponderado: num(x.margen_ponderado), umbral_popularidad: num(x.umbral_popularidad),
      n_platos: num(x.n_platos), desde: String(x.desde), hasta: String(x.hasta) };
  };
  const uh = u("historica"), up = u("proyectada");
  const ingenieria: IngenieriaMenu = {
    periodo: { desde: uh.desde, hasta: uh.hasta },
    historica: { umbrales: uh, platos: menu(histT) }, proyectada: { umbrales: up, platos: menu(proyT) },
    alertas: filas<Fila>(alT) as unknown as Alerta[],
    acciones: Object.fromEntries(filas<Fila>(acT).map((x) => [x.categoria_menu, String(x.accion)])) as Record<CategoriaMenu, string>,
  };

  const c = claveValor(confT);
  const m = filas<{ nivel: string; metrica: string; valor: number }>(confM);
  const met = (nivel: string) => ({
    MAE: m.find((x) => x.nivel === nivel && x.metrica === "MAE")!.valor,
    RMSE: m.find((x) => x.nivel === nivel && x.metrica === "RMSE")!.valor,
    SMAPE: m.find((x) => x.nivel === nivel && x.metrica === "SMAPE")!.valor,
  });
  const conf: Confiabilidad = {
    modelo_vigente: String(c.modelo_vigente), metricas_prueba: { por_plato: met("por_plato"), total_semanal: met("total_semanal") },
    rango_datos: { desde: String(c.rango_desde), hasta: String(c.rango_hasta) }, fecha_calculo: String(c.fecha_calculo),
    nota_recarga: c.nota_recarga ? String(c.nota_recarga) : null,
    frases: { MAE: String(c.frase_MAE), RMSE: String(c.frase_RMSE), SMAPE: String(c.frase_SMAPE), total: String(c.frase_total) },
  };

  return {
    origen: "original", platos: { dias: DIAS, platos }, serie: { semanas, platos: series }, menu: ingenieria,
    ranking: { ranking: filas<Fila>(rankT) as unknown as FilaRanking[] }, confiabilidad: conf,
    resumen: {
      rango: { desde: String(r.desde), hasta: String(r.hasta) }, ultima_semana: String(r.ultima_semana),
      semana_proyectada: String(r.semana_proyectada), unidades_ultima_semana: num(r.unidades_ultima_semana),
      unidades_semana_anterior: num(r.unidades_semana_anterior), total_proyectado: num(r.total_proyectado),
      n_alertas: num(r.n_alertas), platos_por_categoria: porCategoria, fecha_calculo: String(r.fecha_calculo),
    },
  };
}

export interface ModeloCompleto { meta: ModeloMeta; xgb?: ModeloXgb }

/** Metadatos del modelo y, si el vigente se evalúa en el navegador, la tabla de nodos de los árboles. */
export async function leerModelo(f: Fuente, conArboles = true): Promise<ModeloCompleto> {
  const k = claveValor(await f.texto("modelo_meta.csv"));
  const columnas = filas<{ columna: string }>(await f.texto("modelo_columnas.csv")).map((x) => x.columna);
  const meta: ModeloMeta = {
    vigente: k.vigente as ModeloMeta["vigente"], modelo_vigente: String(k.modelo_vigente), columnas,
    platos: filas<{ plato: string }>(await f.texto("modelo_platos.csv")).map((x) => x.plato),
    categorias: filas<{ categoria: string }>(await f.texto("modelo_categorias.csv")).map((x) => x.categoria),
    objetivo: k.objetivo as ModeloMeta["objetivo"], base_score: num(k.base_score), n_arboles: num(k.n_arboles),
    ventana: num(k.ventana), semana_proyectada: String(k.semana_proyectada),
  };
  if (!conArboles || meta.vigente !== "xgboost") return { meta };
  return { meta, xgb: cargarModelo(await f.texto("modelo_xgb_arboles.csv"), columnas) };
}
