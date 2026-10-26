import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "../datos";
import { fecha, num } from "../formato";

type Orden = "proyeccion" | "nombre" | "puesto";

export default function Demanda() {
  const { datos } = useDatos();
  const [orden, setOrden] = useState<Orden>("proyeccion");
  const [sel, setSel] = useState<string>("");
  const platos = datos!.platos.platos;
  const puesto = useMemo(() => new Map(datos!.ranking.ranking.map((r) => [r.plato, r.puesto_total])), [datos]);
  const lista = useMemo(() => [...platos].sort((a, b) =>
    orden === "nombre" ? a.plato.localeCompare(b.plato)
      : orden === "puesto" ? (puesto.get(a.plato) ?? 99) - (puesto.get(b.plato) ?? 99)
        : (b.proyeccion ?? -1) - (a.proyeccion ?? -1) || a.plato.localeCompare(b.plato)), [platos, orden, puesto]);
  const p = platos.find((x) => x.plato === (sel || lista[0]?.plato));
  const serie = p ? [
    ...p.ultimas_12.map((s) => ({ semana: fecha(s.semana), real: s.unidades, proy: 0 })),
    ...(p.proyeccion !== null ? [{ semana: `${fecha(datos!.resumen.semana_proyectada)} (proyección)`, real: 0, proy: p.proyeccion }] : []),
  ] : [];
  const dias = p?.reparto_diario ? datos!.platos.dias.map((d, i) => ({ dia: d, unidades: p.reparto_diario![i] })) : [];
  return (
    <>
      <h1>Demanda por plato</h1>
      <div className="campo">
        <label htmlFor="orden">Ordenar por</label>
        <select id="orden" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
          <option value="proyeccion">Unidades proyectadas</option>
          <option value="puesto">Más vendidos en total</option>
          <option value="nombre">Nombre</option>
        </select>
      </div>
      <div className="dos">
        <div className="tabla-scroll">
          <table>
            <caption className="solo-lectores">Platos y unidades proyectadas para la próxima semana</caption>
            <thead><tr><th>Plato</th><th className="der">Proyección</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.plato} className={x.plato === p?.plato ? "fila-sel" : ""}>
                  <td>
                    <button className="enlace" onClick={() => setSel(x.plato)} aria-pressed={x.plato === p?.plato}>{x.plato}</button>
                    {x.estado === "historial_insuficiente" && <span className="marca-estado">Poco historial</span>}
                    {x.estado === "retirado" && <span className="marca-estado gris">Retirado del menú</span>}
                  </td>
                  <td className="der">{x.proyeccion === null ? "—" : num(x.proyeccion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p && (
          <div>
            <h2>{p.plato}</h2>
            {p.estado === "retirado" && <p className="aviso">Este plato no se ha vendido en las últimas 26 semanas; no se proyecta.</p>}
            {p.estado === "historial_insuficiente" && <p className="aviso">Tiene poco historial: la proyección es el promedio de sus últimas semanas.</p>}
            <h3>Últimas 12 semanas y proyección</h3>
            <div className="grafica" role="img" aria-label={`Unidades por semana de ${p.plato}`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semana" angle={-40} textAnchor="end" interval={0} fontSize={10} height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="real" name="Vendidas" stackId="a" fill="#1E3A8A" />
                  <Bar dataKey="proy" name="Proyectadas" stackId="a" fill="#EA580C" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="nota"><span className="punto" style={{ background: "#1E3A8A" }} /> Vendidas · <span className="punto" style={{ background: "#EA580C" }} /> Proyectada
              {p.proyeccion_exacta !== null && ` · valor sin redondear: ${num(p.proyeccion_exacta, 2)}`}</p>
            {dias.length > 0 && (
              <>
                <h3>Reparto por día de la próxima semana</h3>
                <div className="grafica" role="img" aria-label="Unidades proyectadas por día">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dias} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" fontSize={11} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="unidades" name="Unidades">{dias.map((d) => <Cell key={d.dia} fill="#EA580C" />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="nota">El domingo el restaurante no tiene ventas.</p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
