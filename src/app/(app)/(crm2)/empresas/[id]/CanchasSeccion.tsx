"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleCheck, Pencil, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, Tr, CellActions } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { SectionBar } from "@/components/crm/PageBar";
import { StatusDot } from "@/components/crm/Status";
import { Tooltip } from "@/components/crm/Tooltip";
import { useCrmToast } from "@/components/crm/Toast";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, cn } from "@/components/crm/cx";
import { IconoArco, IconoPelota, IconoRed } from "@/components/Equipamiento";
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
 * Canchas de una empresa y el equipamiento sugerido (tab "Canchas y parque" de la ficha).
 *
 * La sugerencia es una cuenta con medidas estándar (src/lib/canchas.ts), comparada con lo que ESTE proveedor le entregó
 * al cliente: no es un diagnóstico, y la pantalla lo dice. Sin permiso para ver ventas no se muestra. La lógica (alta,
 * baja lógica, crear oportunidad) es la de siempre; cambia la presentación (tabla densa + drawer de CRM 2.0).
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
  parque: GrupoParque[] | null;
  etapas: { id: string; tipo: string; orden: number }[];
  origenes: OrigenOpcion[];
  yoId: string;
  puedeEditar: boolean;
  puedeCrearOportunidad: boolean;
}) {
  const router = useRouter();
  const { showToast } = useCrmToast();
  const [canchas, setCanchas] = useState(() => ordenar(canchasIniciales));
  const editor = useApertura<Cancha | null>();
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const activas = canchas.filter((c) => c.activa);
  const sugerencia = useMemo(
    () => (parque ? equipamientoSugerido(canchas, unidadesDelParque(parque.flatMap((g) => g.filas))) : null),
    [canchas, parque],
  );

  function guardada(saved: Cancha) {
    setCanchas((prev) => ordenar([...prev.filter((c) => c.id !== saved.id), saved]));
    editor.cerrar();
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
    setCanchas((prev) => ordenar([...prev.filter((x) => x.id !== data.id), data]));
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
    <section className="flex min-w-0 flex-col">
      <SectionBar
        title="Canchas"
        count={activas.length}
        actions={
          puedeEditar ? (
            <Button size="sm" icon={Plus} onClick={() => editor.abrir(null)}>
              Agregar
            </Button>
          ) : undefined
        }
      />
      <DataTable label="Canchas">
        <THead>
          <Th>Cancha</Th>
          <Th width={120}>Formato</Th>
          <Th width={56} align="right">
            Cant.
          </Th>
          <Th width={240} hideBelow="md">
            Superficie
          </Th>
          <Th width={96}>Estado</Th>
          {puedeEditar && (
            <Th width={72}>
              <span className="sr-only">Acciones</span>
            </Th>
          )}
        </THead>
        <TBody>
          {canchas.length === 0 ? (
            <tr>
              <td colSpan={puedeEditar ? 6 : 5} className="p-0">
                <EmptyState
                  compact
                  title="Todavía no cargaste las canchas de este cliente."
                  description="Con el formato y la cantidad de cada una, el CRM sugiere qué arcos y redes le tocan."
                />
              </td>
            </tr>
          ) : (
            canchas.map((c) => (
              <Tr key={c.id} className={cn(!c.activa && "text-(--crm-text-2)")}>
                <Td>
                  <span className="block truncate font-medium">{c.nombre}</span>
                </Td>
                <Td>{etiquetaFormato(c.formato)}</Td>
                <Td align="right">
                  <span className={TYPE.mono}>{c.cantidad}</span>
                </Td>
                <Td hideBelow="md">
                  {etiquetaSuperficie(c.superficie) ?? <span className="text-(--crm-text-2)">—</span>}
                  {c.iluminacion && <span className="text-(--crm-text-2)"> · con iluminación</span>}
                </Td>
                <Td>{c.activa ? <StatusDot tone="success">Activa</StatusDot> : <StatusDot>De baja</StatusDot>}</Td>
                {puedeEditar && (
                  <Td className="px-1">
                    <CellActions>
                      <Tooltip content="Editar">
                        <IconButton size="sm" icon={Pencil} label={`Editar ${c.nombre}`} onClick={() => editor.abrir(c)} />
                      </Tooltip>
                      <Tooltip content={c.activa ? "Dar de baja (no se borra)" : "Reactivar"}>
                        <IconButton
                          size="sm"
                          icon={c.activa ? Archive : ArchiveRestore}
                          label={c.activa ? `Dar de baja ${c.nombre}` : `Reactivar ${c.nombre}`}
                          disabled={pendienteId === c.id}
                          aria-busy={pendienteId === c.id || undefined}
                          onClick={() => alternarBaja(c)}
                        />
                      </Tooltip>
                    </CellActions>
                  </Td>
                )}
              </Tr>
            ))
          )}
        </TBody>
      </DataTable>
      {canchas.some((c) => c.notas) && (
        <ul className={cn(TYPE.meta, "mt-2 flex flex-col gap-1 text-(--crm-text-2)")}>
          {canchas
            .filter((c) => c.notas)
            .map((c) => (
              <li key={c.id} className="whitespace-pre-line">
                <span className="font-medium text-(--crm-text)">{c.nombre}:</span> {c.notas}
              </li>
            ))}
        </ul>
      )}

      {sugerencia?.hayCanchas && (
        <div className="mt-4 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-3">
          <h3 className="text-[14px] font-semibold leading-5">Equipamiento sugerido</h3>
          <p className="mt-1 flex items-start gap-2 text-[14px] leading-5" role="status">
            {sugerencia.completo ? (
              <>
                <CircleCheck aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-(--crm-success)" />
                <span>
                  <strong className="font-medium">Equipamiento completo</strong> para las medidas estándar de sus canchas.
                </span>
              </>
            ) : (
              <strong className="font-medium">Le faltan {unirLista(faltantesTexto(sugerencia))}.</strong>
            )}
          </p>
          <ul className="mt-2 flex flex-col">
            {sugerencia.lineas.map((l) => (
              <LineaEquipo key={`${l.tipo}-${l.medida ?? "x"}`} linea={l} />
            ))}
          </ul>
          <p className={cn(TYPE.meta, "mt-2 max-w-prose text-(--crm-text-2)")}>
            Es una sugerencia, no un diagnóstico: sale de las medidas estándar de cada formato (2 arcos por cancha, una red por
            arco) y de lo que este cliente nos compró. Puede tener equipo de otros proveedores. Los equipos vencidos no se
            cuentan.
          </p>
          {puedeCrearOportunidad && (
            <Button size="sm" icon={Plus} loading={creando} className="mt-3" onClick={crearOportunidad}>
              Crear oportunidad
            </Button>
          )}
        </div>
      )}

      <CanchaForm
        key={editor.n}
        open={editor.abierto}
        onClose={editor.cerrar}
        cancha={editor.valor ?? undefined}
        empresaId={empresa.id}
        empresaNombre={empresa.nombre}
        onSaved={guardada}
      />
    </section>
  );
}

/** Una línea de la sugerencia: qué hace falta, cuánto hay y cuánto falta. Las pelotas son una reserva opcional. */
function LineaEquipo({ linea: l }: { linea: LineaSugerida }) {
  const Icono = ICONO_LINEA[l.tipo];
  const cubierta = l.faltan === 0;
  return (
    <li className="flex h-8 items-center gap-2 border-b border-(--crm-border) text-[13px] last:border-b-0">
      <Icono className="size-4 shrink-0 text-(--crm-text-2)" />
      <span className="min-w-0 flex-1 truncate">
        {l.opcional ? "Reserva opcional: " : ""}
        {textoLinea(l, l.necesarias)}
      </span>
      <span className={cn(TYPE.mono, "shrink-0 text-[12px]", cubierta ? "text-(--crm-success)" : "font-medium text-(--crm-text)")}>
        {cubierta ? "Cubierto" : `Faltan ${l.faltan} · tiene ${l.cubiertas}`}
      </span>
    </li>
  );
}
