"use client";

import { usePathname } from "next/navigation";
import { PantallaCarga } from "@/components/ui/PantallaCarga";
import CargandoPresupuesto from "./oportunidades/[id]/presupuesto/loading";

/**
 * Pantalla de carga al cambiar de modulo (la de respaldo: cada modulo tiene la
 * suya con su propio texto).
 *
 * Sin estos archivos, Next deja la pantalla ANTERIOR congelada hasta que la
 * nueva termina de consultar la base (todas las paginas del CRM leen datos en
 * el servidor). Con ellos la navegacion es instantanea: el menu queda y en el
 * contenido aparece el loader de marca (DESIGN.md §3.12).
 *
 * Excepción (Lote C): al entrar al presupuesto desde la ficha de oportunidad (que ya es CRM 2.0, otro route group) Next
 * muestra ESTA carga, la primera del grupo `(legacy)`, y no la del presupuesto: para esa ruta se dibuja el esqueleto
 * neutro del presupuesto. El resto de las pantallas legacy sigue con el loader de siempre.
 */
export default function Cargando() {
  const ruta = usePathname();
  if (/^\/oportunidades\/[^/]+\/presupuesto$/.test(ruta)) return <CargandoPresupuesto />;
  return <PantallaCarga texto="Cargando…" modulo="Tuco & Nito" />;
}
