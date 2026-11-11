import { Route, Routes } from 'react-router-dom';
import Navegacion from './componentes/Navegacion';
import Inicio from './vistas/Inicio';
import Demanda from './vistas/Demanda';
import DemandaPlato from './vistas/DemandaPlato';
import Menu from './vistas/Menu';
import MenuPlato from './vistas/MenuPlato';
import Alertas from './vistas/Alertas';
import Confiabilidad from './vistas/Confiabilidad';
import Datos from './vistas/Datos';
import Cargar from './vistas/Cargar';

export default function App() {
  return (
    <div className="aplicacion">
      <Navegacion />
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/demanda" element={<Demanda />} />
          <Route path="/demanda/:plato" element={<DemandaPlato />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/menu/:plato" element={<MenuPlato />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/confiabilidad" element={<Confiabilidad />} />
          <Route path="/datos" element={<Datos />} />
          <Route path="/cargar" element={<Cargar />} />
          <Route
            path="*"
            element={
              <div className="tarjeta">
                <h1>Página no encontrada</h1>
                <p className="suave">La dirección no existe. Use la navegación para volver al inicio.</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
