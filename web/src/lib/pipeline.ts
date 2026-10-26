// Flujos F4-F8 en el navegador: predicción, reparto diario e ingeniería de menú sobre la serie.
import type { Datos, FilaRanking, Plato, SerieSemanal } from "../types";
import { agregarPeriodo, calcularAlertas, clasificar } from "./ingenieriaMenu";
import { construirSerie, type Venta, participaciones } from "./preparacion";
import { DIAS, mayorResiduo, pesosPlato } from "./repartoDiario";
import type { ModeloCompleto } from "./datosCsv";
import { predecir } from "./xgboost";

export const SEMANAS_PERIODO = 12;
const DIA_MS = 86_400_000;

/** Redondeo half-up (igual que redondear() en src/exportar.py). */
export const redondear = (x: number) => Math.floor(Math.max(x, 0) + 0.5);

export function semanaIso(t: number): number {
  const d = new Date(t);
  const dow = (d.getUTCDay() + 6) % 7;
  const jueves = new Date(t - dow * DIA_MS + 3 * DIA_MS);
  const inicio = Date.UTC(jueves.getUTCFullYear(), 0, 1);
  return Math.floor((jueves.getTime() - inicio) / (7 * DIA_MS)) + 1;
}

/** Entradas de la semana siguiente: las últimas V semanas (x_k, p_k, ss_k, sc_k); k = V es la última semana. */
export function filaVentana(u: number[], precio: number[], semanas: string[], ventana: number): Record<string, number> {
  const f: Record<string, number> = {};
  const n = u.length;
  for (let k = 1; k <= ventana; k++) {
    const j = n - ventana + k - 1;
    const w = semanaIso(Date.parse(semanas[j]));
    f[`x_${k}`] = u[j]; f[`p_${k}`] = precio[j];
    f[`ss_${k}`] = Math.sin((2 * Math.PI * w) / 52); f[`sc_${k}`] = Math.cos((2 * Math.PI * w) / 52);
  }
  return f;
}

export const media4 = (u: number[]) => u.slice(-4).reduce((a, b) => a + b, 0) / 4;

export function ffillPrecio(s: SerieSemanal["platos"][string]): number[] {
  const p = s.u.map((u, k) => (u > 0 ? s.i[k] / u : NaN));
  for (let k = 1; k < p.length; k++) if (Number.isNaN(p[k])) p[k] = p[k - 1];
  for (let k = p.length - 2; k >= 0; k--) if (Number.isNaN(p[k])) p[k] = p[k + 1];
  return p;
}

export function proyectar(serie: SerieSemanal, modelo: ModeloCompleto) {
  const sig = new Date(Date.parse(serie.semanas[serie.semanas.length - 1]) + 7 * DIA_MS).toISOString().slice(0, 10);
  const proy: Record<string, number> = {}, exactas: Record<string, number> = {};
  for (const [p, s] of Object.entries(serie.platos)) {
    if (s.estado === "retirado") continue;
    let x: number;
    if (s.estado === "historial_insuficiente") {
      const primera = s.u.findIndex((v) => v > 0);
      const disp = s.u.slice(primera).slice(-4);
      x = disp.reduce((a, b) => a + b, 0) / disp.length;
    } else if (modelo.meta.vigente === "xgboost" && modelo.xgb && modelo.meta.platos.includes(p)) {
      const f = filaVentana(s.u, ffillPrecio(s), serie.semanas, modelo.meta.ventana);
      const fila = modelo.meta.columnas.map((c) =>
        c.startsWith("plato_") ? Number(c === `plato_${p}`)
          : c.startsWith("cat_") ? Number(c === `cat_${s.categoria}`) : f[c]);
      x = Math.max(predecir(modelo.xgb, modelo.meta, fila), 0);
    } else x = media4(s.u);
    exactas[p] = x; proy[p] = redondear(x);
  }
  return { proy, exactas, sig };
}

export function calcularRanking(serie: SerieSemanal): FilaRanking[] {
  const nombres = Object.keys(serie.platos), n = serie.semanas.length;
  const top5: Record<string, number> = {};
  for (let k = 0; k < n; k++) {
    const col = nombres.map((p) => serie.platos[p].u[k]);
    for (const [j, p] of nombres.entries()) {
      const rango = 1 + col.filter((v) => v > col[j]).length; // método "min"
      if (rango <= 5 && col[j] > 0) top5[p] = (top5[p] ?? 0) + 1;
    }
  }
  const mediana = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length === 0 ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const filas = nombres.map((p) => {
    const u = serie.platos[p].u, con = u.filter((v) => v > 0);
    return { plato: p, unidades: u.reduce((a, b) => a + b, 0), semanas_top5: top5[p] ?? 0,
      pct_semanas_con_venta: (100 * con.length) / n, mediana_unidades_con_venta: mediana(con), puesto_total: 0 };
  }).sort((a, b) => b.unidades - a.unidades);
  filas.forEach((f, i) => (f.puesto_total = i + 1));
  return filas;
}

/** Resultado completo a partir de las ventas válidas. */
export function calcularTodo(ventas: Venta[], modelo: ModeloCompleto, base: Datos): Datos {
  const serie = construirSerie(ventas);
  const { proy, exactas, sig } = proyectar(serie, modelo);
  const n = serie.semanas.length;
  const desde = Math.max(0, n - SEMANAS_PERIODO), hasta = n - 1;
  const histEntrada = agregarPeriodo(serie, desde, hasta);
  const hist = clasificar(histEntrada);
  const mh = new Map(histEntrada.map((e) => [e.plato, e]));

  const ultimo = (p: string) => {
    const s = serie.platos[p];
    for (let k = n - 1; k >= 0; k--) if (s.u[k] > 0) return { precio: s.i[k] / s.u[k], costo: s.c[k] / s.u[k] };
    return { precio: 0, costo: 0 };
  };
  const proyEntrada = Object.keys(proy).map((p) => {
    const e = mh.get(p) ?? { ...ultimo(p), categoria: serie.platos[p].categoria };
    return { plato: p, categoria: serie.platos[p].categoria, unidades: proy[p], precio: e.precio, costo: e.costo };
  });
  const pro = clasificar(proyEntrada);
  const alertas = calcularAlertas(hist.platos, pro.platos);

  const { porPlato, porCat } = participaciones(ventas, serie.semanas);
  const platos: Plato[] = Object.entries(serie.platos).map(([p, s]) => {
    const w = pesosPlato(p, s.categoria, porPlato, porCat);
    const e = mh.get(p) ?? ultimo(p);
    return {
      plato: p, categoria: s.categoria, estado: s.estado,
      ultimas_12: serie.semanas.slice(-12).map((sem, k) => ({ semana: sem, unidades: s.u[n - 12 + k] ?? 0 })),
      proyeccion: p in proy ? proy[p] : null, proyeccion_exacta: p in exactas ? exactas[p] : null,
      participacion_dia: w, reparto_diario: p in proy ? mayorResiduo(proy[p], w) : null,
      precio: e.precio, costo: e.costo, margen: e.precio - e.costo,
    };
  });

  const tot = (k: number) => Object.values(serie.platos).reduce((a, s) => a + s.u[k], 0);
  const porCategoria: Record<string, number> = {};
  for (const f of hist.platos) porCategoria[f.categoria_menu] = (porCategoria[f.categoria_menu] ?? 0) + 1;
  const ahora = new Date().toLocaleString("es-CO");
  return {
    ...base, origen: "archivo", actualizado: ahora,
    resumen: {
      rango: { desde: serie.semanas[0], hasta: serie.semanas[n - 1] }, ultima_semana: serie.semanas[n - 1],
      semana_proyectada: sig, unidades_ultima_semana: tot(n - 1), unidades_semana_anterior: n > 1 ? tot(n - 2) : 0,
      total_proyectado: Object.values(proy).reduce((a, b) => a + b, 0), n_alertas: alertas.length,
      platos_por_categoria: porCategoria, fecha_calculo: ahora,
    },
    platos: { dias: DIAS, platos }, serie,
    menu: {
      periodo: { desde: serie.semanas[desde], hasta: serie.semanas[hasta] },
      historica: hist, proyectada: pro, alertas, acciones: base.menu.acciones,
    },
    ranking: { ranking: calcularRanking(serie) },
  };
}
