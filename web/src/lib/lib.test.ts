import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Datos, ModeloMeta } from "../types";
import { clasificar } from "./ingenieriaMenu";
import { calcularTodo } from "./pipeline";
import { construirSerie, leerCsv } from "./preparacion";
import { mayorResiduo } from "./repartoDiario";
import { cargarModelo, predecir } from "./xgboost";

const J = (r: string) => JSON.parse(readFileSync(new URL(r, import.meta.url), "utf-8"));
const datos = (n: string) => J(`../../public/data/${n}.json`);
const meta: ModeloMeta = datos("modelo_meta");
const csv = readFileSync(new URL("../../../data/raw/Anonymized_Restaurant_Sales_Data.csv", import.meta.url), "utf-8");
const fx = J("./__fixtures__/serie_paridad.json");

describe("XGBoost en el navegador", () => {
  it("coincide con Python (diferencia < 1e-4 en 200 filas)", () => {
    const f = J("./__fixtures__/paridad.json");
    const m = cargarModelo(datos("modelo_xgb"));
    expect(f.filas.length).toBe(200);
    f.filas.forEach((fila: number[], i: number) => {
      expect(Math.abs(predecir(m, meta, fila) - f.predicciones[i])).toBeLessThan(1e-4);
    });
  });
});

describe("Preparación del CSV", () => {
  const lect = leerCsv(csv);
  const serie = construirSerie(lect.ventas);
  it("reproduce los hechos verificados", () => {
    expect(lect.leidos).toBe(4385);
    expect(lect.ventas.length).toBe(4361);
    expect(lect.excluidos).toEqual([{ motivo: "Venta cancelada", n: 24 }]);
    expect(serie.semanas.length).toBe(157);
    expect(Object.keys(serie.platos).length).toBe(62);
    expect(Object.values(serie.platos).reduce((a, s) => a + s.u.reduce((x, y) => x + y, 0), 0)).toBe(7118);
  });
  it("la serie y los estados coinciden con Python", () => {
    expect(serie.semanas).toEqual(fx.semanas);
    for (const [p, u] of Object.entries(fx.u)) expect(serie.platos[p].u).toEqual(u);
    for (const [p, e] of Object.entries(fx.estados)) expect(serie.platos[p].estado).toBe(e);
  });
  it("nombra el campo faltante", () => {
    const r = leerCsv("Date,Category\n01/01/2023,X\n");
    expect(r.errores.join(" ")).toContain("«Quantity»");
  });
  it("la proyección, el reparto y la clasificación coinciden con Python", () => {
    const base: Datos = {
      resumen: datos("resumen"), platos: datos("platos"), serie: datos("serie_semanal"), menu: datos("ingenieria_menu"),
      ranking: datos("ranking"), confiabilidad: datos("confiabilidad"), origen: "original",
    };
    const r = calcularTodo(lect.ventas, { meta }, base);
    for (const p of r.platos.platos) {
      if (p.proyeccion !== null) expect(p.proyeccion).toBe(fx.proy[p.plato]);
      if (p.reparto_diario) expect(p.reparto_diario).toEqual(fx.reparto[p.plato]);
    }
    const h = Object.fromEntries(r.menu.historica.platos.map((f) => [f.plato, f.categoria_menu]));
    const q = Object.fromEntries(r.menu.proyectada.platos.map((f) => [f.plato, f.categoria_menu]));
    expect(h).toEqual(fx.clasif_hist);
    expect(q).toEqual(fx.clasif_proy);
  });
});

describe("Ingeniería de menú", () => {
  it("clasifica a mano un caso pequeño", () => {
    // 4 platos: total 100 u; margen ponderado = (6*40+2*30+5*20+1*10)/100 = 4.1; umbral = 0.7/4 = 17.5 %
    const { platos, umbrales } = clasificar([
      { plato: "A", categoria: "x", unidades: 40, precio: 10, costo: 4 },
      { plato: "B", categoria: "x", unidades: 30, precio: 4, costo: 2 },
      { plato: "C", categoria: "x", unidades: 20, precio: 9, costo: 4 },
      { plato: "D", categoria: "x", unidades: 10, precio: 3, costo: 2 },
    ]);
    expect(umbrales.margen_ponderado).toBeCloseTo(4.1, 10);
    const c = Object.fromEntries(platos.map((f) => [f.plato, f.categoria_menu]));
    expect(c).toEqual({ A: "Estrella", B: "Caballo de arado", C: "Estrella", D: "Perro" });
  });
  it("caso de referencia: los 12 platos más vendidos", () => {
    const s = datos("serie_semanal");
    const e = Object.entries(s.platos as Record<string, { categoria: string; u: number[]; i: number[]; c: number[] }>)
      .map(([plato, x]) => {
        const u = x.u.reduce((a, b) => a + b, 0);
        return { plato, categoria: x.categoria, unidades: u, precio: x.i.reduce((a, b) => a + b, 0) / u,
          costo: x.c.reduce((a, b) => a + b, 0) / u };
      }).sort((a, b) => b.unidades - a.unidades).slice(0, 12);
    const { platos, umbrales } = clasificar(e);
    expect(umbrales.margen_ponderado).toBeCloseTo(3.36, 2);
    expect(umbrales.umbral_popularidad * 100).toBeCloseTo(5.83, 2);
    const n = (c: string) => platos.filter((f) => f.categoria_menu === c).length;
    expect([n("Estrella"), n("Caballo de arado"), n("Puzzle"), n("Perro")]).toEqual([2, 6, 4, 0]);
  });
});

describe("Reparto diario", () => {
  it("la suma diaria es exactamente la proyección semanal", () => {
    for (const total of [0, 1, 2, 5, 7, 13, 40])
      for (const w of [[1, 1, 1, 1, 1, 1], [5, 0, 3, 9, 2, 1], [0.3, 0.3, 0.3, 0.05, 0.05, 0]])
        expect(mayorResiduo(total, w).reduce((a, b) => a + b, 0)).toBe(total);
  });
});
