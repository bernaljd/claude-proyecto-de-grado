import type { ReactNode } from "react";

export function Tarjeta({ titulo, valor, nota, children }: { titulo: string; valor?: ReactNode; nota?: ReactNode; children?: ReactNode }) {
  return (
    <section className="tarjeta">
      <h3>{titulo}</h3>
      {valor !== undefined && <p className="valor">{valor}</p>}
      {nota && <p className="nota">{nota}</p>}
      {children}
    </section>
  );
}
