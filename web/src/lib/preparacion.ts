// Ingesta y preparación en el navegador. Misma lógica que src/ingesta.py y src/preparacion.py.
import Papa from "papaparse";
import type { Estado, SerieSemanal } from "../types";

export interface Venta {
  semana: string; dow: number; plato: string; categoria: string; q: number; ingreso: number; costo: number;
}
export interface Lectura {
  ventas: Venta[]; leidos: number; excluidos: { motivo: string; n: number }[]; errores: string[];
}

export const ULTIMA_SEMANA_ENTRENAMIENTO = "2024-12-30";
export const SEMANAS_RETIRO = 26;
export const SEMANAS_MIN_HISTORIAL = 26;

const CAMPOS: Record<string, string> = {
  Date: "fecha de la venta",
  "Line item name": "nombre del plato",
  Category: "categoría",
  Quantity: "cantidad",
  "Price Per Item": "precio unitario",
  "Est. Cost": "costo estimado",
};

const DIA_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Fecha dd/mm/yyyy → milisegundos UTC (o null si no es válida). */
export function parseFecha(s: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s ?? "").trim());
  if (!m) return null;
  const t = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(t);
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? t : null;
}

/** Lunes de la semana (0 = lunes ... 6 = domingo). */
export function semanaDe(t: number): { semana: string; dow: number } {
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return { semana: iso(t - dow * DIA_MS), dow };
}

export function leerCsv(texto: string): Lectura {
  const r = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const cols = r.meta.fields ?? [];
  const faltan = Object.keys(CAMPOS).filter((c) => !cols.includes(c));
  if (faltan.length) {
    return {
      ventas: [], leidos: 0, excluidos: [],
      errores: faltan.map((c) => `Falta la columna «${c}» (${CAMPOS[c]}). Revise el archivo e inténtelo de nuevo.`),
    };
  }
  const motivos = new Map<string, number>();
  const excluir = (m: string) => motivos.set(m, (motivos.get(m) ?? 0) + 1);
  const ventas: Venta[] = [];
  for (const f of r.data) {
    if ((f["Cancelled"] ?? "").trim().toLowerCase() === "yes") { excluir("Venta cancelada"); continue; }
    const t = parseFecha(f["Date"]);
    if (t === null) { excluir("Fecha inválida"); continue; }
    const q = Number(f["Quantity"]), p = Number(f["Price Per Item"]), c = Number(f["Est. Cost"]);
    if (![q, p, c].every(Number.isFinite) || (f["Quantity"] ?? "").trim() === "") { excluir("Cantidad, precio o costo no numérico"); continue; }
    const plato = (f["Line item name"] ?? "").trim();
    if (!plato) { excluir("Plato sin nombre"); continue; }
    const { semana, dow } = semanaDe(t);
    ventas.push({ semana, dow, plato, categoria: f["Category"], q, ingreso: p * q, costo: c });
  }
  const errores = ventas.length === 0 ? ["El archivo no tiene ventas válidas para analizar."] : [];
  return {
    ventas, leidos: r.data.length, errores,
    excluidos: [...motivos].map(([motivo, n]) => ({ motivo, n })),
  };
}

/** Categoría con más registros por plato (empate: orden alfabético). */
export function categoriaPorPlato(ventas: Venta[]): Record<string, string> {
  const cuenta = new Map<string, Map<string, number>>();
  for (const v of ventas) {
    const m = cuenta.get(v.plato) ?? new Map<string, number>();
    m.set(v.categoria, (m.get(v.categoria) ?? 0) + 1);
    cuenta.set(v.plato, m);
  }
  const out: Record<string, string> = {};
  for (const [p, m] of cuenta)
    out[p] = [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
  return out;
}

export function estadoPlato(u: number[], semanas: string[]): Estado {
  const ult = u.slice(-SEMANAS_RETIRO);
  if (!ult.some((x) => x > 0)) return "retirado";
  const primera = semanas[u.findIndex((x) => x > 0)];
  const n = primera > ULTIMA_SEMANA_ENTRENAMIENTO
    ? 0
    : Math.round((Date.parse(ULTIMA_SEMANA_ENTRENAMIENTO) - Date.parse(primera)) / (7 * DIA_MS)) + 1;
  return n >= SEMANAS_MIN_HISTORIAL ? "modelable" : "historial_insuficiente";
}

/** Serie semanal por plato (con ceros) y estados. */
export function construirSerie(ventas: Venta[]): SerieSemanal {
  const orden = ventas.map((v) => v.semana).sort();
  const desde = Date.parse(orden[0]), hasta = Date.parse(orden[orden.length - 1]);
  const semanas: string[] = [];
  for (let t = desde; t <= hasta; t += 7 * DIA_MS) semanas.push(iso(t));
  const idx = new Map(semanas.map((s, i) => [s, i]));
  const cat = categoriaPorPlato(ventas);
  const platos: SerieSemanal["platos"] = {};
  for (const p of Object.keys(cat).sort())
    platos[p] = { categoria: cat[p], estado: "modelable", u: semanas.map(() => 0), i: semanas.map(() => 0), c: semanas.map(() => 0) };
  for (const v of ventas) {
    const s = platos[v.plato], k = idx.get(v.semana)!;
    s.u[k] += v.q; s.i[k] += v.ingreso; s.c[k] += v.costo;
  }
  for (const s of Object.values(platos)) s.estado = estadoPlato(s.u, semanas);
  return { semanas, platos };
}

/** Participación por día (lun-sáb) en las últimas 26 semanas, por plato y por categoría. */
export function participaciones(ventas: Venta[], semanas: string[]) {
  const corte = semanas[Math.max(0, semanas.length - 26)];
  const porPlato: Record<string, number[]> = {}, porCat: Record<string, number[]> = {};
  for (const v of ventas) {
    if (v.semana < corte || v.dow > 5) continue;
    (porPlato[v.plato] ??= [0, 0, 0, 0, 0, 0])[v.dow] += v.q;
  }
  const cat = categoriaPorPlato(ventas);
  for (const v of ventas) {
    if (v.semana < corte || v.dow > 5) continue;
    (porCat[cat[v.plato]] ??= [0, 0, 0, 0, 0, 0])[v.dow] += v.q;
  }
  return { porPlato, porCat };
}
