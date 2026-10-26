import { Link } from "react-router-dom";
import { Etiqueta } from "../components/Etiqueta";
import { useDatos } from "../datos";

export default function Alertas() {
  const { datos } = useDatos();
  const a = datos!.menu.alertas;
  return (
    <>
      <h1>Alertas</h1>
      {a.length === 0 ? (
        <p className="aviso bueno">No hay alertas: ningún plato cambia de categoría en la próxima semana.</p>
      ) : (
        <ul className="lista-alertas">
          {a.map((x) => (
            <li key={x.plato} className="tarjeta">
              <h3><Link to={`/menu/${encodeURIComponent(x.plato)}`}>{x.plato}</Link></h3>
              <p>Pasa de <Etiqueta cat={x.historica} /> a <Etiqueta cat={x.proyectada} /></p>
              <p className="nota">Acción sugerida: {x.accion}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="nota">Las acciones son informativas: el sistema no cambia precios ni el menú.</p>
    </>
  );
}
