import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Fila, filas, type Fuente } from "./csv";
import { leerDatos, leerModelo } from "./datosCsv";
import { clasificar } from "./ingenieriaMenu";
import { calcularTodo, ffillPrecio, filaVentana } from "./pipeline";
import { construirSerie, leerCsv } from "./preparacion";
import { mayorResiduo } from "./repartoDiario";
import { predecir } from "./xgboost";

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), "utf-8");
const fuente: Fuente = { texto: async (n) => leer(`../../public/data/${n}`) };
const csvVentas = leer("../../../data/raw/Anonymized_Restaurant_Sales_Data.csv");
const ABREV = ["lun", "mar", "mie", "jue", "vie", "sab"];

describe("XGBoost en el navegador (tabla de nodos en CSV)", () => {
  it("coincide con Python (diferencia < 1e-4 en 200 filas)", async () => {
    const { meta, xgb } = await leerModelo(fuente);
    const f = filas<Fila>(leer("./__fixtures__/paridad_xgb.csv"));
    expect(f.length).toBe(200);
    for (const fila of f) {
      const x = meta.columnas.map((c) => Number(fila[c]));
      expect(Math.abs(predecir(xgb!, meta, x) - Number(fila.prediccion))).toBeLessThan(1e-4);
    }
  });
});

describe("Preparación del CSV", () => {
  const lect = leerCsv(csvVentas);
  const serie = construirSerie(lect.ventas);
  it("reproduce los hechos verificados", () => {
    expect(lect.leidos).toBe(4385);
    expect(lect.ventas.length).toBe(4361);
    expect(lect.excluidos).toEqual([{ motivo: "Venta cancelada", n: 24 }]);
    expect(serie.semanas.length).toBe(157);
    expect(Object.keys(serie.platos).length).toBe(62);
    expect(Object.values(serie.platos).reduce((a, s) => a + s.u.reduce((x, y) => x + y, 0), 0)).toBe(7118);
  });
  it("la serie y los estados coinciden con los CSV de Python (data/processed)", () => {
    const idx = new Map(serie.semanas.map((w, i) => [w, i]));
    const py = filas<{ plato: string; semana: string; unidades: number }>(leer("../../../data/processed/serie_semanal.csv"));
    expect(py.length).toBe(9734);
    for (const r of py) expect(serie.platos[r.plato].u[idx.get(r.semana)!]).toBe(r.unidades);
    for (const e of filas<{ plato: string; estado: string }>(leer("../../../data/processed/estados_platos.csv")))
      expect(serie.platos[e.plato].estado).toBe(e.estado);
  });
  it("nombra el campo faltante", () => {
    expect(leerCsv("Date,Category\n01/01/2023,X\n").errores.join(" ")).toContain("«Quantity»");
  });
  it("las entradas, la proyección, el reparto y la clasificación coinciden con Python", async () => {
    const modelo = await leerModelo(fuente);
    const base = await leerDatos(fuente);
    const r = calcularTodo(lect.ventas, modelo, base);
    const fx = filas<Fila>(leer("./__fixtures__/paridad_navegador.csv"));
    const hist = Object.fromEntries(r.menu.historica.platos.map((f) => [f.plato, f.categoria_menu]));
    const proy = Object.fromEntries(r.menu.proyectada.platos.map((f) => [f.plato, f.categoria_menu]));
    const sp = r.platos.platos;
    for (const f of fx) {
      const p = String(f.plato), plato = sp.find((x) => x.plato === p)!;
      expect(plato.proyeccion).toBe(f.proy_nav);
      expect(plato.reparto_diario).toEqual(ABREV.map((a) => f[`rep_${a}`]));
      expect(hist[p] ?? "").toBe(f.cat_hist ?? "");
      expect(proy[p] ?? "").toBe(f.cat_proy_nav ?? "");
      if (f.estado === "modelable") {
        const s = serie.platos[p];
        const w = filaVentana(s.u, ffillPrecio(s), serie.semanas, modelo.meta.ventana);
        for (const [k, v] of Object.entries(w)) expect(v).toBeCloseTo(Number(f[`f_${k}`]), 9);
      }
    }
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
    expect(Object.fromEntries(platos.map((f) => [f.plato, f.categoria_menu]))).toEqual(
      { A: "Estrella", B: "Caballo de arado", C: "Estrella", D: "Perro" });
  });
  it("caso de referencia: los 12 platos más vendidos", async () => {
    const s = (await leerDatos(fuente)).serie;
    const e = Object.entries(s.platos).map(([plato, x]) => {
      const u = x.u.reduce((a, b) => a + b, 0);
      return { plato, categoria: x.categoria, unidades: u, precio: x.i.reduce((a, b) => a + b, 0) / u, costo: x.c.reduce((a, b) => a + b, 0) / u };
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
