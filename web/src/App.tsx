import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useDatos } from "./datos";
import Alertas from "./pages/Alertas";
import Cargar from "./pages/Cargar";
import Confiabilidad from "./pages/Confiabilidad";
import Demanda from "./pages/Demanda";
import DetallePlato from "./pages/DetallePlato";
import Inicio from "./pages/Inicio";
import Menu from "./pages/Menu";

const ENLACES = [
  { a: "/", t: "Inicio", c: "Inicio" }, { a: "/demanda", t: "Demanda", c: "Demanda" }, { a: "/menu", t: "Menú", c: "Menú" },
  { a: "/alertas", t: "Alertas", c: "Alertas" }, { a: "/cargar", t: "Cargar datos", c: "Datos" },
  { a: "/confiabilidad", t: "Confiabilidad", c: "Confianza" },
];

export default function App() {
  const { datos, error } = useDatos();
  const n = datos?.resumen.n_alertas ?? 0;
  return (
    <div className="app">
      <nav className="nav" aria-label="Navegación principal">
        <div className="marca">Restaurante<br /><small>Apoyo a decisiones</small></div>
        {ENLACES.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.a === "/"} aria-label={e.t} className={({ isActive }) => (isActive ? "activo" : "")}>
            <span className="txt" aria-hidden="true">{e.t}</span>
            <span className="corto" aria-hidden="true">{e.c}</span>
            {e.a === "/alertas" && n > 0 && <span className="insignia" aria-label={`${n} alertas`}>{n}</span>}
          </NavLink>
        ))}
      </nav>
      <main className="contenido">
        {error && <p role="alert" className="aviso malo">No se pudieron cargar los datos: {error}</p>}
        {!datos && !error && <p>Cargando…</p>}
        {datos && (
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/demanda" element={<Demanda />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/menu/:plato" element={<DetallePlato />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/cargar" element={<Cargar />} />
            <Route path="/confiabilidad" element={<Confiabilidad />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
