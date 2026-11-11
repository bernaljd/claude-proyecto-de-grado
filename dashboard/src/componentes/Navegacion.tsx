// Barra lateral en computador y barra inferior de 5 íconos en celular
// (Inicio, Demanda, Menú, Alertas, Más). El globo muestra las alertas activas.
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ChefHat,
  Database,
  Home,
  LayoutGrid,
  MoreHorizontal,
  ShieldCheck,
  Upload,
  UtensilsCrossed,
} from 'lucide-react';
import { useDatos } from '../DatosContext';

const PRINCIPALES = [
  { ruta: '/', nombre: 'Inicio', Icono: Home },
  { ruta: '/demanda', nombre: 'Demanda', Icono: BarChart3 },
  { ruta: '/menu', nombre: 'Menú', Icono: LayoutGrid },
  { ruta: '/alertas', nombre: 'Alertas', Icono: Bell },
];

const SECUNDARIAS = [
  { ruta: '/confiabilidad', nombre: 'Confiabilidad', Icono: ShieldCheck },
  { ruta: '/datos', nombre: 'Datos y fuentes', Icono: Database },
  { ruta: '/cargar', nombre: 'Cargar datos', Icono: Upload },
];

export default function Navegacion() {
  const { menu } = useDatos();
  const [masAbierto, setMasAbierto] = useState(false);
  const ubicacion = useLocation();

  const alertas =
    menu?.filter((fila) => fila.escenario === 'proyectado' && fila.cambia_de_categoria === 'sí').length ?? 0;

  const clase = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');
  const enSecundaria = SECUNDARIAS.some((enlace) => ubicacion.pathname.startsWith(enlace.ruta));

  return (
    <>
      <nav className="barra-lateral" aria-label="Navegación principal">
        <div className="logo">
          <ChefHat aria-hidden size={22} />
          DSS del restaurante
        </div>
        {[...PRINCIPALES, ...SECUNDARIAS].map(({ ruta, nombre, Icono }) => (
          <NavLink key={ruta} to={ruta} end={ruta === '/'} className={clase}>
            <Icono aria-hidden size={18} />
            {nombre}
            {ruta === '/alertas' && alertas > 0 && (
              <span className="globo" aria-label={`${alertas} alertas activas`}>
                {alertas}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <nav className="barra-inferior" aria-label="Navegación principal">
        {PRINCIPALES.map(({ ruta, nombre, Icono }) => (
          <NavLink key={ruta} to={ruta} end={ruta === '/'} className={clase} onClick={() => setMasAbierto(false)}>
            <Icono aria-hidden size={20} />
            {nombre}
            {ruta === '/alertas' && alertas > 0 && (
              <span className="globo" aria-label={`${alertas} alertas activas`}>
                {alertas}
              </span>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          aria-expanded={masAbierto}
          aria-haspopup="menu"
          className={enSecundaria ? 'activo' : ''}
          onClick={() => setMasAbierto((abierto) => !abierto)}
        >
          <MoreHorizontal aria-hidden size={20} />
          Más
        </button>
      </nav>

      {masAbierto && (
        <div className="menu-mas" role="menu" aria-label="Más vistas">
          {SECUNDARIAS.map(({ ruta, nombre, Icono }) => (
            <NavLink key={ruta} to={ruta} className={clase} role="menuitem" onClick={() => setMasAbierto(false)}>
              <Icono aria-hidden size={18} />
              {nombre}
            </NavLink>
          ))}
          <NavLink to="/" role="menuitem" onClick={() => setMasAbierto(false)} aria-label="Cerrar el menú">
            <UtensilsCrossed aria-hidden size={18} />
            Cerrar
          </NavLink>
        </div>
      )}
    </>
  );
}
