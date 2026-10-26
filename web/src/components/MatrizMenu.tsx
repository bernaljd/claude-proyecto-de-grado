import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { COLORES, libras, num } from "../formato";
import type { FilaMenu, Umbrales } from "../types";

export function MatrizMenu({ filas, umbrales }: { filas: FilaMenu[]; umbrales: Umbrales }) {
  const ir = useNavigate();
  const pts = filas.map((f) => ({ ...f, x: f.popularidad * 100, y: f.margen }));
  const ux = umbrales.umbral_popularidad * 100;
  return (
    <div className="grafica" role="img" aria-label="Matriz de popularidad y margen de los platos">
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="Popularidad" unit=" %" tickFormatter={(v) => num(v, 0)}
            label={{ value: "Popularidad (% de las unidades)", position: "insideBottom", offset: -16 }} />
          <YAxis type="number" dataKey="y" name="Margen" tickFormatter={(v) => `£${num(v, 1)}`}
            label={{ value: "Margen por unidad (£)", angle: -90, position: "insideLeft", offset: 12 }} />
          <ReferenceLine x={ux} stroke="#334155" strokeDasharray="5 4" label={{ value: "Popularidad alta →", position: "insideTopRight", fontSize: 11 }} />
          <ReferenceLine y={umbrales.margen_ponderado} stroke="#334155" strokeDasharray="5 4"
            label={{ value: "Margen alto ↑", position: "insideTopLeft", fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
            const p = payload?.[0]?.payload as (FilaMenu & { x: number }) | undefined;
            if (!p) return null;
            return <div className="tip"><strong>{p.plato}</strong><br />{p.categoria_menu}<br />{num(p.x, 1)} % de las ventas<br />Margen {libras(p.margen)}</div>;
          }} />
          <Scatter data={pts} onClick={(d: any) => ir(`/menu/${encodeURIComponent(d.plato)}`)} cursor="pointer">
            {pts.map((p) => <Cell key={p.plato} fill={COLORES[p.categoria_menu]} stroke="#0F172A" />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
