import { Link } from "react-router-dom";
import { Etiqueta } from "../components/Etiqueta";
import { Tarjeta } from "../components/Tarjeta";
import { useDatos } from "../datos";
import { fecha, num } from "../formato";
import type { CategoriaMenu } from "../types";

const CATS: CategoriaMenu[] = ["Estrella", "Caballo de arado", "Puzzle", "Perro"];

export default function Inicio() {
  const { datos } = useDatos();
  const r = datos!.resumen;
  const dif = r.unidades_ultima_semana - r.unidades_semana_anterior;
  const variacion = r.unidades_semana_anterior > 0
    ? `${dif >= 0 ? "+" : ""}${num((100 * dif) / r.unidades_semana_anterior, 0)} % frente a la semana anterior`
    : "Sin semana anterior para comparar";
  return (
    <>
      <h1>Inicio</h1>
      <p className="nota">Datos del {fecha(r.rango.desde)} al {fecha(r.rango.hasta)}
        {datos!.origen === "archivo" && " (archivo cargado por usted)"}.</p>
      <div className="rejilla">
        <Tarjeta titulo="Platos vendidos la última semana" valor={`${num(r.unidades_ultima_semana)} unidades`}
          nota={`Semana del ${fecha(r.ultima_semana)} · ${variacion}`} />
        <Tarjeta titulo="Proyección de la próxima semana" valor={`${num(r.total_proyectado)} unidades`}
          nota={`Semana del ${fecha(r.semana_proyectada)}`} />
        <Tarjeta titulo="Alertas" valor={r.n_alertas}
          nota={r.n_alertas ? <Link to="/alertas">Ver los platos que cambian de categoría</Link> : "Ningún plato cambia de categoría."} />
      </div>
      <h2>Platos por categoría del menú</h2>
      <div className="rejilla">
        {CATS.map((c) => (
          <Tarjeta key={c} titulo="" valor={r.platos_por_categoria[c] ?? 0}><Etiqueta cat={c} /></Tarjeta>
        ))}
      </div>
      <p><Link className="boton" to="/menu">Ver la matriz del menú</Link></p>
    </>
  );
}
