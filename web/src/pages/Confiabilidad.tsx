import { Tarjeta } from "../components/Tarjeta";
import { useDatos } from "../datos";
import { fecha, num } from "../formato";

export default function Confiabilidad() {
  const { datos } = useDatos();
  const c = datos!.confiabilidad;
  const m = c.metricas_prueba.por_plato, t = c.metricas_prueba.total_semanal;
  return (
    <>
      <h1>Confiabilidad</h1>
      <p>Modelo vigente: <strong>{c.modelo_vigente}</strong>. Datos del {fecha(c.rango_datos.desde)} al {fecha(c.rango_datos.hasta)}.
        {" "}Calculado el {c.fecha_calculo}.</p>
      <p className="nota">Métricas medidas en el periodo de prueba (2025-07-07 a 2025-12-29), que el modelo no vio al entrenarse.</p>
      <div className="rejilla">
        <Tarjeta titulo="MAE (por plato y semana)" valor={`${num(m.MAE, 3)} unidades`} nota={c.frases.MAE} />
        <Tarjeta titulo="RMSE (por plato y semana)" valor={`${num(m.RMSE, 3)} unidades`} nota={c.frases.RMSE} />
        <Tarjeta titulo="SMAPE (por plato y semana)" valor={`${num(m.SMAPE, 1)} %`} nota={c.frases.SMAPE} />
      </div>
      <h2>Demanda total semanal</h2>
      <div className="rejilla">
        <Tarjeta titulo="MAE" valor={`${num(t.MAE, 2)} unidades`} nota={c.frases.total} />
        <Tarjeta titulo="RMSE" valor={`${num(t.RMSE, 2)} unidades`} />
        <Tarjeta titulo="SMAPE" valor={`${num(t.SMAPE, 1)} %`} />
      </div>
      {c.nota_recarga && <p className="aviso">{c.nota_recarga}</p>}
      {datos!.origen === "archivo" && (
        <p className="aviso">Estas métricas son las del entrenamiento original; al cargar un archivo nuevo el modelo no se reentrena.</p>
      )}
    </>
  );
}
