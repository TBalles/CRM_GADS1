"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const ID = "crm-portal";
const noop = () => () => {};

/**
 * Lleva una capa flotante a `#crm-portal`, el contenedor que `CrmRoot` pone DENTRO de `[data-crm]`: así lo
 * portalizado hereda los `--crm-*` (en `body` no los tendría). Todo lo que pasa por acá va con `position: fixed` y
 * su z-index de la escala `--crm-z-*` (el wrapper es `display: contents`).
 *
 * - En el servidor y en la hidratación no dibuja nada (el destino solo existe en el navegador).
 * - Respaldo si `#crm-portal` no existe (un árbol sin CrmRoot): dibuja la capa EN EL LUGAR, nunca en `body`. Es un
 *   respaldo degradado: hereda los tokens solo si ese lugar está dentro de `[data-crm]`, y un ancestro con
 *   `transform`, `filter` u `overflow` puede recortarla o romper su `position: fixed`. Por eso en desarrollo avisa
 *   por consola: es un error de montaje, no un modo de uso.
 */
export function CrmPortal({ children }: { children: React.ReactNode }) {
  const montado = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  React.useEffect(() => {
    if (montado && process.env.NODE_ENV !== "production" && !document.getElementById(ID)) {
      console.warn("[crm] No existe #crm-portal: la capa se dibuja en el lugar. ¿Falta <CrmRoot> en el layout?");
    }
  }, [montado]);
  if (!montado) return null;
  const destino = document.getElementById(ID);
  return destino ? createPortal(children, destino) : <>{children}</>;
}
