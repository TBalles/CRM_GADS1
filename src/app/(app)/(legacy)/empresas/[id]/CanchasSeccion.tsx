"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleCheck, LandPlot, Lightbulb, Loader2, Pencil, Plus } from "lucide-react";
import Drawer from "@/components/Drawer";
import { Seccion } from "@/components/cliente";
import { IconoArco, IconoPelota, IconoRed } from "@/components/Equipamiento";
import { Badge, Button, Pill } from "@/components/ui/UIComponents";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { origenPorNombre, type OrigenOpcion } from "@/lib/clientes";
import { mensajeErrorOportunidad } from "@/lib/oportunidades";
import {
  equipamientoSugerido,
  etiquetaFormato,
  etiquetaSuperficie,
  faltantesTexto,
  notasEquipamiento,
  textoLinea,
  tituloEquipamiento,
  unidadesDelParque,
  unirLista,
  type LineaSugerida,
} from "@/lib/canchas";
import { etapaInicialId } from "@/lib/recambio";
import type { GrupoParque } from "@/lib/parque";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";
import CanchaForm from "./CanchaForm";

type Cancha = Tables<"canchas">;

/** Origen del catálogo con el que nace una oportunidad sugerida a partir de la ficha de canchas. */
const ORIGEN_EQUIPAMIENTO = "Visita a predio";

const ICONO_LINEA = { arco: IconoArco, red: IconoRed, pelota: IconoPelota } as const;

function ordenar(lista: Cancha[]): Cancha[] {
  return [...lista].sort((a, b) => Number(b.activa) - Number(a.activa) || a.nombre.localeCompare(b.nombre));
}

/**
 * Ficha de canchas de una empresa y el equipamiento sugerido.
 *
 * La sugerencia es una cuenta con medidas estándar (src/lib/canchas.ts), comparada con
 * lo que ESTE proveedor le entregó al cliente: no es un diagnóstico de la cancha, y la
 * pantalla lo dice. Sin permiso para ver ventas no hay con qué comparar y no se muestra.
 */
export default function CanchasSeccion({
  empresa,
  canchas: canchasIniciales,
  parque,
  etapas,
  origenes,
  yoId,
  puedeEditar,
  puedeCrearOportunidad,
}: {
  empresa: { id: string; nombre: string };
  canchas: Cancha[];
  /** El parque instalado de la empresa; `null` si el rol no puede ver ventas. */
  parque: GrupoParque[] | null;
  etapas: { id: string; tipo: string; orden: number }[];
  origenes: OrigenOpcion[];
  yoId: string;
  puedeEditar: boolean;
  puedeCrearOportunidad: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [canchas, setCanchas] = useState(() => ordenar(canchasIniciales));
  // The payload outlives `open` on purpose so the drawer's title doesn't flip mid-animation.
  const [editando, setEditando] = useState<Cancha | "nueva" | null>(null);
  const [open, setOpen] = useState(false);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const activas = canchas.filter((c) => c.activa);
  const sugerencia = useMemo(
    () => (parque ? equipamientoSugerido(canchas, unidadesDelParque(parque.flatMap((g) => g.filas))) : null),
    [canchas, parque],
  );

  function abrir(next: Cancha | "nueva") {
    setEditando(next);
    setOpen(true);
  }

  function guardada(saved: Cancha) {
    setCanchas((prev) => ordenar([...prev.filter((c) => c.id !== saved.id), saved]));
    setOpen(false);
  }

  async function alternarBaja(c: Cancha) {
    if (pendienteId) return;
    setPendienteId(c.id);
    const { data, error } = await createClient().from("canchas").update({ activa: !c.activa }).eq("id", c.id).select().single();
    setPendienteId(null);
    if (error || !data) {
      showToast("No se pudo cambiar el estado de la cancha. Intentá de nuevo.", "error");
      return;
    }
    guardada(data);
    showToast(data.activa ? `«${c.nombre}» volvió a estar activa.` : `«${c.nombre}» quedó de baja. No se borra: la podés reactivar.`, "success");
  }

  async function crearOportunidad() {
    if (!sugerencia || creando) return;
    const etapaId = etapaInicialId(etapas);
    if (!etapaId) {
      showToast("El embudo no tiene una etapa abierta donde crear la oportunidad. Revisá Configuración.", "error");
      return;
    }
    setCreando(true);
    const { data, error } = await createClient()
      .from("oportunidades")
      .insert({
        titulo: tituloEquipamiento(empresa.nombre, canchas),
        empresa_id: empresa.id,
        etapa_id: etapaId,
        origen_id: origenPorNombre(origenes, ORIGEN_EQUIPAMIENTO),
        responsable_id: yoId,
        notas: notasEquipamiento(sugerencia),
        tipo: "directa",
      })
      .select()
      .single();
    setCreando(false);
    if (error || !data) {
      showToast(mensajeErrorOportunidad(error, "No se pudo crear la oportunidad. Intentá de nuevo."), "error");
      return;
    }
    showToast(`Creamos «${data.titulo}».`, "success", 8000, { label: "Ver la oportunidad →", href: `/oportunidades/${data.id}` });
    router.refresh();
  }

  return (
    <>
      <Seccion
        icon={LandPlot}
        titulo="Canchas"
        cantidad={activas.length}
        accion={
          puedeEditar ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrir("nueva")}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Agregar
            </Button>
          ) : undefined
        }
      >
        {canchas.length ? (
          <ul className="divide-y divide-border">
            {canchas.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className={cn("min-w-0 flex-1", !c.activa && "text-muted-foreground")}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    <span className="min-w-0 break-words">{c.nombre}</span>
                    <Pill tono={c.activa ? "verde" : "gris"}>{etiquetaFormato(c.formato)}</Pill>
                    {c.cantidad > 1 && (
                      <Badge variant="outline" className="tabular-nums">
                        ×{c.cantidad}
                      </Badge>
                    )}
                    {!c.activa && <Pill tono="gris">De baja</Pill>}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{etiquetaSuperficie(c.superficie) ?? "Superficie sin dato"}</span>
                    {c.iluminacion && (
                      <span className="inline-flex items-center gap-1">
                        <Lightbulb aria-hidden="true" className="h-3 w-3" /> Con iluminación
                      </span>
                    )}
                  </p>
                  {c.notas && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{c.notas}</p>}
                </div>
                {puedeEditar && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Editar ${c.nombre}`}
                      title={`Editar ${c.nombre}`}
                      onClick={() => abrir(c)}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={c.activa ? `Dar de baja ${c.nombre}` : `Reactivar ${c.nombre}`}
                      title={c.activa ? "Dar de baja (no se borra)" : "Reactivar"}
                      disabled={pendienteId === c.id}
                      onClick={() => alternarBaja(c)}
                    >
                      {pendienteId === c.id ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : c.activa ? (
                        <Archive aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore aria-hidden="true" className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no cargaste las canchas de este cliente. Con el formato y la cantidad de cada una, el CRM sugiere qué
            arcos y redes le tocan.
          </p>
        )}

        {sugerencia?.hayCanchas && (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Equipamiento sugerido</h3>
            <p className="mt-1 flex items-start gap-2 text-sm" role="status">
              {sugerencia.completo ? (
                <>
                  <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span>
                    <strong>Equipamiento completo</strong> para las medidas estándar de sus canchas.
                  </span>
                </>
              ) : (
                <span>
                  <strong>Le faltan {unirLista(faltantesTexto(sugerencia))}.</strong>
                </span>
              )}
            </p>

            <ul className="mt-3 space-y-1.5">
              {sugerencia.lineas.map((l) => (
                <LineaEquipo key={`${l.tipo}-${l.medida ?? "x"}`} linea={l} />
              ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
              Es una sugerencia, no un diagnóstico: sale de las medidas estándar de cada formato (2 arcos por cancha, una
              red por arco) y de lo que este cliente nos compró. Puede tener equipo de otros proveedores. Los equipos
              vencidos no se cuentan.
            </p>

            {puedeCrearOportunidad && (
              <Button
                variant={sugerencia.completo ? "outline" : "default"}
                size="sm"
                className="mt-3 gap-1.5"
                disabled={creando}
                onClick={crearOportunidad}
              >
                {creando ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}
                Crear oportunidad
              </Button>
            )}
          </div>
        )}
      </Seccion>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editando && editando !== "nueva" ? "Editar cancha" : "Nueva cancha"}
        subtitle={empresa.nombre}
        icon={LandPlot}
      >
        {editando ? (
          <CanchaForm
            key={editando === "nueva" ? `nueva-${empresa.id}` : editando.id}
            cancha={editando === "nueva" ? undefined : editando}
            empresaId={empresa.id}
            onSaved={guardada}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </Drawer>
    </>
  );
}

/** Una línea de la sugerencia: qué hace falta, cuánto hay y cuánto falta. Los pelotas son una reserva opcional. */
function LineaEquipo({ linea: l }: { linea: LineaSugerida }) {
  const Icono = ICONO_LINEA[l.tipo];
  const cubierta = l.faltan === 0;
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          cubierta ? "bg-brand/10 text-brand" : "bg-secondary text-foreground",
        )}
      >
        <Icono className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        {l.opcional ? "Reserva opcional: " : ""}
        {textoLinea(l, l.necesarias)}
      </span>
      <span className={cn("shrink-0 text-xs tabular-nums", cubierta ? "font-medium text-brand" : "font-semibold text-foreground")}>
        {cubierta ? "Cubierto" : `Faltan ${l.faltan} · tiene ${l.cubiertas}`}
      </span>
    </li>
  );
}
