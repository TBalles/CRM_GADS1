import {
  AlertTriangle,
  CircleDot,
  FileText,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  NotebookPen,
  Phone,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/UIComponents";
import { formatMomento } from "@/lib/clientes";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type Actividad = Tables<"bitacora_entradas">;

/** Ícono por el `codigo` estable de los tipos de sistema. Los tipos que crea el cliente (codigo null) usan el genérico. */
const ICONO_POR_CODIGO: Record<string, React.ElementType> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  reunion: Users,
  reunion_virtual: Monitor,
  demostracion: Monitor,
  propuesta: FileText,
  visita_cancha: MapPin,
  entrega: Truck,
  queja: AlertTriangle,
  nota: NotebookPen,
  otro: CircleDot,
};

/**
 * Línea de tiempo de actividades, la más reciente arriba. Una actividad es un
 * hecho ya ocurrido (no una tarea): se muestra qué pasó, cuándo, quién lo
 * registró, con quién, y a qué oportunidad pertenece si la tiene.
 *
 * Sin estado ni hooks: sirve igual de un Server Component y de un island.
 */
export default function ActividadesTimeline({
  actividades,
  tipos,
  perfiles,
  contactos = [],
  oportunidades = [],
  vacio,
}: {
  actividades: Actividad[];
  tipos: Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo">[];
  perfiles: { id: string; nombre: string }[];
  /** Para nombrar el contacto de cada actividad (solo en la ficha de la empresa). */
  contactos?: { id: string; label: string }[];
  oportunidades?: { id: string; label: string }[];
  /** Texto del estado vacío; cada ficha dice qué falta registrar. */
  vacio?: { texto: string; pista: string };
}) {
  if (!actividades.length) {
    return (
      <EmptyState
        compact
        text={vacio?.texto ?? "Todavía no hay actividades"}
        hint={vacio?.pista ?? "Asentá lo que se charló, lo que consultó o el reclamo que tuvo. Así el historial no se va con quien atendió."}
        className="py-8"
      />
    );
  }

  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const autorPorId = new Map(perfiles.map((p) => [p.id, p.nombre]));
  const contactoPorId = new Map(contactos.map((c) => [c.id, c.label]));
  const oportunidadPorId = new Map(oportunidades.map((o) => [o.id, o.label]));

  const ordenadas = [...actividades].sort(
    (a, b) => new Date(b.ocurrido_en).getTime() - new Date(a.ocurrido_en).getTime(),
  );

  return (
    <ol className="space-y-3">
      {ordenadas.map((a) => (
        <ActividadFila
          key={a.id}
          actividad={a}
          tipo={tipoPorId.get(a.tipo_actividad_id)}
          autor={a.autor_id ? autorPorId.get(a.autor_id) : null}
          contacto={a.contacto_id ? contactoPorId.get(a.contacto_id) : null}
          oportunidad={a.oportunidad_id ? oportunidadPorId.get(a.oportunidad_id) : null}
        />
      ))}
    </ol>
  );
}

/**
 * Una actividad de la linea de tiempo (un `<li>`). Se exporta para que el
 * detalle de la oportunidad la mezcle con los cambios de etapa en una sola lista.
 */
export function ActividadFila({
  actividad: a,
  tipo,
  autor,
  contacto,
  oportunidad,
}: {
  actividad: Actividad;
  tipo?: Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo">;
  autor?: string | null;
  contacto?: string | null;
  oportunidad?: string | null;
}) {
  const Icon = (tipo?.codigo && ICONO_POR_CODIGO[tipo.codigo]) || CircleDot;
  const esReclamo = tipo?.codigo === "queja";

  return (
    <li className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          esReclamo ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold">{a.titulo}</p>
          <Pill tono={esReclamo ? "rojo" : "gris"}>{tipo?.nombre ?? "Actividad"}</Pill>
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <time dateTime={a.ocurrido_en} className="tabular-nums">
            {formatMomento(a.ocurrido_en)}
          </time>
          {autor && (
            <span className="flex items-center gap-1">
              <UserRound aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="sr-only">Registró </span>
              {autor}
            </span>
          )}
          {contacto && <span>con {contacto}</span>}
          {oportunidad && (
            <span className="flex items-center gap-1">
              <Handshake aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="sr-only">Oportunidad: </span>
              {oportunidad}
            </span>
          )}
        </p>

        {a.detalle && (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{a.detalle}</p>
        )}
        {a.resultado && (
          <p className="mt-1.5 text-sm">
            <span className="font-semibold">Resultado: </span>
            {a.resultado}
          </p>
        )}
      </div>
    </li>
  );
}
