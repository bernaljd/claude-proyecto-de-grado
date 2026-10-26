import { Link, useParams } from "react-router-dom";
import { Etiqueta } from "../components/Etiqueta";
import { Tarjeta } from "../components/Tarjeta";
import { useDatos } from "../datos";
import { libras, num, pct } from "../formato";

export default function DetallePlato() {
  const { datos } = useDatos();
  const nombre = decodeURIComponent(useParams().plato ?? "");
  const p = datos!.platos.platos.find((x) => x.plato === nombre);
  if (!p) return <><h1>Plato no encontrado</h1><Link to="/menu">Volver al menú</Link></>;
  const h = datos!.menu.historica.platos.find((x) => x.plato === nombre);
  const q = datos!.menu.proyectada.platos.find((x) => x.plato === nombre);
  const accion = (q ?? h)?.accion;
  return (
    <>
      <p><Link to="/menu">← Volver a la matriz</Link></p>
      <h1>{p.plato}</h1>
      <p className="nota">{p.categoria}</p>
      <div className="rejilla">
        <Tarjeta titulo="Precio por unidad" valor={libras(p.precio)} />
        <Tarjeta titulo="Costo por unidad (estimado)" valor={libras(p.costo)} />
        <Tarjeta titulo="Margen por unidad" valor={libras(p.margen)} />
        <Tarjeta titulo="Popularidad (últimas 12 semanas)" valor={h ? pct(h.popularidad) : "Sin ventas"} />
        <Tarjeta titulo="Categoría histórica">{h ? <Etiqueta cat={h.categoria_menu} /> : <p>Sin ventas en el periodo</p>}</Tarjeta>
        <Tarjeta titulo="Categoría proyectada">{q ? <Etiqueta cat={q.categoria_menu} /> : <p>Sin ventas proyectadas</p>}</Tarjeta>
      </div>
      {p.proyeccion !== null && <p>Unidades proyectadas para la próxima semana: <strong>{num(p.proyeccion)}</strong></p>}
      {accion && <><h2>Acción sugerida</h2><p>{accion}</p></>}
      <p className="aviso">La acción es informativa: el sistema no cambia precios ni el menú.</p>
    </>
  );
}
