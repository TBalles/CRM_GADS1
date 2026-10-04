import { InlineBanner } from "../Feedback";
import { StatusDot, type Tone } from "../Status";
import { estadoInfo } from "@/lib/clientes";
import { estadoOportunidadInfo } from "@/lib/oportunidades";

/**
 * Estados del dominio como punto + palabra (MASTER.md §3.2). Los tonos legacy (`azul`, `verde`…) de `lib/` se
 * traducen a los tonos semánticos de CRM 2.0. Sin "use client".
 */
const TONO: Record<string, Tone> = { azul: "info", verde: "success", gris: "neutral", rojo: "danger", ambar: "warning", indigo: "info" };

export function toneDe(tonoLegacy: string): Tone {
  return TONO[tonoLegacy] ?? "neutral";
}

/** Estado de una empresa o contacto (Potencial, Cliente, Inactivo, No contactar). */
export function EstadoCliente({ estado, className }: { estado: string; className?: string }) {
  const e = estadoInfo(estado);
  return (
    <StatusDot tone={toneDe(e.tono)} className={className}>
      {e.label}
    </StatusDot>
  );
}

/** Estado de una oportunidad (Abierta, Ganada, Perdida). */
export function EstadoOportunidad({ estado }: { estado: string }) {
  const e = estadoOportunidadInfo(estado);
  return <StatusDot tone={toneDe(e.tono)}>{e.label}</StatusDot>;
}

/** Aviso de la ficha cuando la empresa o el contacto está dado de baja o marcado "No contactar" (mismo texto que el legacy). */
export function AvisoEstadoCrm({
  estado,
  entidad,
  accion,
  className,
}: {
  estado: string;
  entidad: "empresa" | "contacto";
  accion?: React.ReactNode;
  className?: string;
}) {
  if (estado !== "inactivo" && estado !== "no_contactar") return null;
  return estado === "no_contactar" ? (
    <InlineBanner tone="warning" title="No contactar." className={className}>
      Esta {entidad === "empresa" ? "empresa" : "persona"} pidió que no la contacten: antes de registrar una actividad, oportunidad o
      venta, confirmalo con quien la atiende.
    </InlineBanner>
  ) : (
    <InlineBanner tone="info" title="Dada de baja." action={accion} className={className}>
      No se borra: conserva todo su historial y no aparece en la lista salvo que pidas ver las dadas de baja.
    </InlineBanner>
  );
}
