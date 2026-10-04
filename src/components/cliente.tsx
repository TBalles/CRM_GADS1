import Link from "next/link";
import { Ban, Handshake, Receipt } from "lucide-react";
import { Card, Pill, SectionTitle } from "@/components/ui/UIComponents";
import { estadoInfo, formatFecha } from "@/lib/clientes";
import { formatMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";

/**
 * Piezas que comparten las fichas de empresa y de contacto. Sin estado ni
 * hooks: se renderizan igual del lado servidor y del cliente.
 */

/** El estado siempre lleva texto: el color solo no alcanza (daltonismo, impresion). */
export function EstadoPill({ estado }: { estado: string }) {
  const e = estadoInfo(estado);
  return <Pill tono={e.tono}>{e.label}</Pill>;
}

/** Un dato de la ficha: etiqueta chica arriba, valor abajo. Sin valor muestra una raya legible por lector de pantalla. */
export function Dato({ label, children }: { label: string; children?: React.ReactNode }) {
  const vacio = children == null || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">
        {vacio ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              —
            </span>
            <span className="sr-only">Sin dato</span>
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}

/** Tarjeta de una seccion de la ficha: titulo con ícono, cantidad en mono y una accion opcional. */
export function Seccion({
  icon,
  titulo,
  cantidad,
  accion,
  children,
}: {
  icon: React.ElementType;
  titulo: string;
  cantidad?: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <SectionTitle
        icon={icon}
        right={
          <div className="flex shrink-0 items-center gap-3">
            {cantidad != null && (
              <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                {cantidad}
              </span>
            )}
            {accion}
          </div>
        }
      >
        {titulo}
      </SectionTitle>
      {children}
    </Card>
  );
}

/** Aviso de estado de la ficha: dada de baja o marcada como no contactar. Null si no hace falta. */
export function AvisoEstado({
  estado,
  entidad,
  accion,
}: {
  estado: string;
  entidad: "empresa" | "contacto";
  accion?: React.ReactNode;
}) {
  if (estado !== "inactivo" && estado !== "no_contactar") return null;
  const noContactar = estado === "no_contactar";
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-border bg-secondary p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex min-w-0 items-start gap-2">
        <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>
          {noContactar ? (
            <>
              <strong>No contactar.</strong> Esta {entidad === "empresa" ? "empresa" : "persona"} pidió que no
              la contacten: antes de registrar una actividad, oportunidad o venta, confirmalo con quien la
              atiende.
            </>
          ) : (
            <>
              <strong>Dada de baja.</strong> No se borra: conserva todo su historial y no aparece en la lista
              salvo que pidas ver las dadas de baja.
            </>
          )}
        </span>
      </p>
      {accion}
    </div>
  );
}

const ESTADO_OPORTUNIDAD = {
  abierta: { label: "Abierta", tono: "azul" },
  ganada: { label: "Ganada", tono: "verde" },
  perdida: { label: "Perdida", tono: "rojo" },
} as const;

export type OportunidadFila = Pick<Tables<"oportunidades">, "id" | "titulo" | "monto" | "estado" | "etapa_id">;

/**
 * Oportunidades de un cliente. El titulo es texto, no link: el detalle de la
 * oportunidad llega en la fase siguiente (F2).
 */
export function OportunidadesLista({
  oportunidades,
  etapas,
}: {
  oportunidades: OportunidadFila[];
  etapas: Pick<Tables<"etapas">, "id" | "nombre">[];
}) {
  const nombreEtapa = new Map(etapas.map((e) => [e.id, e.nombre]));
  if (!oportunidades.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay oportunidades. Se cargan desde{" "}
        <Link href="/oportunidades" className="font-medium text-brand underline-offset-4 hover:underline">
          Oportunidades
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {oportunidades.map((o) => {
        const est = ESTADO_OPORTUNIDAD[o.estado as keyof typeof ESTADO_OPORTUNIDAD] ?? ESTADO_OPORTUNIDAD.abierta;
        return (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Handshake aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{o.titulo}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{nombreEtapa.get(o.etapa_id) ?? "Sin etapa"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-xs font-semibold tabular-nums">
                {o.monto ? formatMoney(Number(o.monto)) : "—"}
              </span>
              <Pill tono={est.tono}>{est.label}</Pill>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type VentaFila = Pick<Tables<"ventas">, "id" | "fecha" | "comprobante"> & { total: number };

/** Ventas de un cliente: fecha, comprobante y total (suma de sus items). */
export function VentasLista({ ventas }: { ventas: VentaFila[] }) {
  if (!ventas.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no compró. Las entregas se cargan desde{" "}
        <Link href="/ventas" className="font-medium text-brand underline-offset-4 hover:underline">
          Ventas
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {ventas.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Receipt aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">{formatFecha(v.fecha)}</span>
            {v.comprobante && <span className="truncate text-muted-foreground">· {v.comprobante}</span>}
          </p>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
            {v.total ? formatMoney(v.total) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
