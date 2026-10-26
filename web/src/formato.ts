import type { CategoriaMenu } from "./types";

export const COLORES: Record<CategoriaMenu, string> = {
  Estrella: "#1E3A8A", "Caballo de arado": "#EA580C", Puzzle: "#93C5FD", Perro: "#6B7280",
};
export const libras = (x: number) => `£${x.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (x: number, d = 0) => x.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x: number, d = 1) => `${num(x * 100, d)} %`;
export const fecha = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
