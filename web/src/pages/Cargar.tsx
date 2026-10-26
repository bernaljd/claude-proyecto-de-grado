import { useState } from "react";
import { useDatos } from "../datos";
import { calcularTodo, type ModeloCompleto } from "../lib/pipeline";
import { leerCsv } from "../lib/preparacion";
import { cargarModelo } from "../lib/xgboost";
import { fecha, num } from "../formato";
import type { ModeloMeta } from "../types";

const base = import.meta.env.BASE_URL;

async function cargarModeloCompleto(): Promise<ModeloCompleto> {
  const meta: ModeloMeta = await (await fetch(`${base}data/modelo_meta.json`)).json();
  if (meta.vigente !== "xgboost") return { meta };
  return { meta, xgb: cargarModelo(await (await fetch(`${base}data/modelo_xgb.json`)).json()) };
}

export default function Cargar() {
  const { datos, guardar, restaurar } = useDatos();
  const [errores, setErrores] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErrores([]); setOcupado(true);
    try {
      const lect = leerCsv(await f.text());
      if (lect.errores.length) { setErrores(lect.errores); return; }
      const nuevo = calcularTodo(lect.ventas, await cargarModeloCompleto(), datos!);
      nuevo.resumenCarga = [
        `Registros leídos: ${num(lect.leidos)}`,
        `Registros usados: ${num(lect.ventas.length)}`,
        ...lect.excluidos.map((x) => `Excluidos por «${x.motivo}»: ${num(x.n)}`),
        `Periodo: del ${fecha(nuevo.resumen.rango.desde)} al ${fecha(nuevo.resumen.rango.hasta)}`,
        `Platos distintos: ${Object.keys(nuevo.serie.platos).length}`,
      ];
      guardar(nuevo);
    } catch (err) {
      setErrores([`No se pudo procesar el archivo: ${(err as Error).message}`]);
    } finally { setOcupado(false); e.target.value = ""; }
  }

  return (
    <>
      <h1>Cargar datos</h1>
      <p>Suba el archivo de ventas (CSV) para actualizar las proyecciones y la clasificación del menú.
        El archivo debe tener, al menos: fecha, plato, categoría, cantidad, precio unitario y costo estimado.</p>
      <p className="aviso bueno">🔒 El archivo nunca sale de su navegador: todo el cálculo se hace en este equipo.</p>
      <div className="campo">
        <label htmlFor="archivo">Archivo de ventas (.csv)</label>
        <input id="archivo" type="file" accept=".csv,text/csv" onChange={alElegir} disabled={ocupado} />
      </div>
      {ocupado && <p>Procesando…</p>}
      {errores.length > 0 && <div role="alert" className="aviso malo">{errores.map((x) => <p key={x}>{x}</p>)}</div>}
      {datos?.origen === "archivo" ? (
        <section className="tarjeta">
          <h2>Archivo cargado</h2>
          <ul>{datos.resumenCarga?.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="nota">Última actualización: {datos.actualizado}</p>
          <button className="boton" onClick={restaurar}>Volver a los datos originales</button>
        </section>
      ) : (
        <p className="nota">Está usando los datos originales del restaurante (hasta el {fecha(datos!.resumen.rango.hasta)}).</p>
      )}
      <p className="nota">Cargar un archivo no vuelve a entrenar el modelo; solo recalcula las proyecciones con los datos nuevos.</p>
    </>
  );
}
