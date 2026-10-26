import { COLORES } from "../formato";
import type { CategoriaMenu } from "../types";

/** El color siempre va acompañado del nombre de la categoría. */
export function Etiqueta({ cat }: { cat: CategoriaMenu }) {
  const claro = cat === "Puzzle";
  return <span className="etiqueta" style={{ background: COLORES[cat], color: claro ? "#0F172A" : "#fff" }}>{cat}</span>;
}
