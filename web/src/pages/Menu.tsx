import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Etiqueta } from "../components/Etiqueta";
import { MatrizMenu } from "../components/MatrizMenu";
import { useDatos } from "../datos";
import { agregarPeriodo, clasificar } from "../lib/ingenieriaMenu";
import { fecha, libras, num, pct } from "../formato";
import type { CategoriaMenu } from "../types";

const CATS: CategoriaMenu[] = ["Estrella", "Caballo de arado", "Puzzle", "Perro"];
const PERIODOS = [4, 8, 12, 26, 52, 0];

export default function Menu() {
  const { datos } = useDatos();
  const [vista, setVista] = useState<"historica" | "proyectada">("historica");
  const [semanas, setSemanas] = useState(12);
  const [categoria, setCategoria] = useState("todas");
  const n = datos!.serie.semanas.length;

  const hist = useMemo(() => {
    const desde = semanas === 0 ? 0 : Math.max(0, n - semanas);
    return { ...clasificar(agregarPeriodo(datos!.serie, desde, n - 1)), desde: datos!.serie.semanas[desde], hasta: datos!.serie.semanas[n - 1] };
  }, [datos, semanas, n]);
  const actual = vista === "historica" ? hist : { ...datos!.menu.proyectada, desde: datos!.resumen.semana_proyectada, hasta: datos!.resumen.semana_proyectada };
  const platosClas = vista === "historica" ? hist.platos : datos!.menu.proyectada.platos;
  const umbrales = vista === "historica" ? hist.umbrales : datos!.menu.proyectada.umbrales;
  const cats = [...new Set(datos!.platos.platos.map((p) => p.categoria))].sort();
  const filas = platosClas.filter((f) => categoria === "todas" || f.categoria === categoria);
  const cuenta = (c: CategoriaMenu) => filas.filter((f) => f.categoria_menu === c).length;

  return (
    <>
      <h1>Ingeniería de menú</h1>
      <p className="aviso">El costo de cada plato es una estimación cercana al 35 % del precio; por eso, en este restaurante un margen alto equivale a un precio alto.</p>
      <div className="filtros">
        <div className="campo">
          <label htmlFor="vista">Clasificación</label>
          <select id="vista" value={vista} onChange={(e) => setVista(e.target.value as typeof vista)}>
            <option value="historica">Histórica (lo que ya se vendió)</option>
            <option value="proyectada">Proyectada (próxima semana)</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="periodo">Periodo</label>
          <select id="periodo" value={semanas} disabled={vista === "proyectada"} onChange={(e) => setSemanas(+e.target.value)}>
            {PERIODOS.map((s) => <option key={s} value={s}>{s === 0 ? "Todo el historial" : `Últimas ${s} semanas`}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cat">Categoría de la carta</label>
          <select id="cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="todas">Todas</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <p className="nota">
        {vista === "historica" ? `Del ${fecha(actual.desde)} al ${fecha(actual.hasta)}` : `Semana del ${fecha(actual.desde)}`} ·
        {" "}margen promedio del menú {libras(umbrales.margen_ponderado)} · popularidad alta desde {pct(umbrales.umbral_popularidad)}
      </p>
      <div className="rejilla cuatro">
        {CATS.map((c) => <div key={c} className="contador"><Etiqueta cat={c} /><strong>{cuenta(c)}</strong></div>)}
      </div>
      {filas.length === 0 ? <p>No hay platos con ventas en este periodo.</p> : <MatrizMenu filas={filas} umbrales={umbrales} />}
      <div className="tabla-scroll">
        <table>
          <caption className="solo-lectores">Platos clasificados</caption>
          <thead><tr><th>Plato</th><th>Categoría</th><th className="der">Unidades</th><th className="der">Popularidad</th><th className="der">Margen</th></tr></thead>
          <tbody>
            {[...filas].sort((a, b) => b.unidades - a.unidades).map((f) => (
              <tr key={f.plato}>
                <td><Link to={`/menu/${encodeURIComponent(f.plato)}`}>{f.plato}</Link></td>
                <td><Etiqueta cat={f.categoria_menu} /></td>
                <td className="der">{num(f.unidades)}</td><td className="der">{pct(f.popularidad)}</td><td className="der">{libras(f.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
