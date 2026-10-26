// Carga de los JSON por defecto y del resultado guardado en el navegador (localStorage).
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Datos } from "./types";

const CLAVE = "dss_datos_cargados_v1";
const base = import.meta.env.BASE_URL;

async function leer<T>(n: string): Promise<T> {
  const r = await fetch(`${base}data/${n}.json`);
  if (!r.ok) throw new Error(`No se pudo leer ${n}.json`);
  return r.json();
}

export async function cargarOriginales(): Promise<Datos> {
  const [resumen, platos, serie, menu, ranking, confiabilidad] = await Promise.all([
    leer<Datos["resumen"]>("resumen"), leer<Datos["platos"]>("platos"), leer<Datos["serie"]>("serie_semanal"),
    leer<Datos["menu"]>("ingenieria_menu"), leer<Datos["ranking"]>("ranking"), leer<Datos["confiabilidad"]>("confiabilidad"),
  ]);
  return { resumen, platos, serie, menu, ranking, confiabilidad, origen: "original" };
}

interface Ctx {
  datos: Datos | null; error: string | null;
  guardar: (d: Datos) => void; restaurar: () => void;
}
const Contexto = createContext<Ctx>({ datos: null, error: null, guardar: () => {}, restaurar: () => {} });
export const useDatos = () => useContext(Contexto);

export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const guardado = (() => { try { return localStorage.getItem(CLAVE); } catch { return null; } })();
        if (guardado) { const d = JSON.parse(guardado) as Datos; if (vivo) { setDatos(d); return; } }
      } catch { /* si el guardado está dañado se usan los originales */ }
      try { const d = await cargarOriginales(); if (vivo) setDatos(d); }
      catch (e) { if (vivo) setError((e as Error).message); }
    })();
    return () => { vivo = false; };
  }, []);

  const guardar = useCallback((d: Datos) => {
    setDatos(d);
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* sin espacio: queda solo en memoria */ }
  }, []);
  const restaurar = useCallback(() => {
    try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
    cargarOriginales().then(setDatos).catch((e) => setError(e.message));
  }, []);

  return <Contexto.Provider value={{ datos, error, guardar, restaurar }}>{children}</Contexto.Provider>;
}
