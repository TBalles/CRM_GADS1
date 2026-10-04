"use client";

import { Button } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Si la base no responde, la lista no se dibuja vacía como si no hubiera nada:
 * se avisa y se deja reintentar. (Antes de F3 los errores de lectura se tragaban.)
 * `retry` (Next 16.3) vuelve a pedir los datos; `reset` solo limpia el error y
 * re-renderiza, así que queda de reserva por si `retry` no existe.
 */
export default function ErrorDelModulo({ retry, reset }: { error: Error; retry?: () => void; reset?: () => void }) {
  return (
    <EmptyState
      escena="afuera"
      text="No pudimos traer los datos"
      hint="Fue un problema de conexión o de la base, no algo que hayas hecho vos. Probá de nuevo en unos segundos."
      action={<Button onClick={() => (retry ?? reset)?.()}>Reintentar</Button>}
    />
  );
}
