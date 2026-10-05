"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { CellActions, DataTable, TBody, THead, TableMessage, Td, Th, Tr } from "@/components/crm/DataTable";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { EmptyState } from "@/components/crm/Feedback";
import { Menu } from "@/components/crm/Menu";
import { StatusDot, type Tone } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoOpciones, CampoTexto, FormDrawer, useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, cn } from "@/components/crm/cx";
import { createClient } from "@/lib/supabase/client";
import { sinTrabarse } from "@/lib/guardar";
import type { Tables } from "@/lib/supabase/types";
import { BotonNuevo, SeccionConfig, useFocoMover } from "./CatalogoTab";
import Mover from "./Mover";

type Etapa = Tables<"etapas">;
type TipoEtapa = "abierta" | "ganada" | "perdida";

const TIPOS: { value: TipoEtapa; label: string; tono: Tone; ayuda: string }[] = [
  { value: "abierta", label: "Abierta", tono: "info", ayuda: "La oportunidad sigue en juego." },
  { value: "ganada", label: "Ganada", tono: "success", ayuda: "Cierra la oportunidad como ganada." },
  { value: "perdida", label: "Perdida", tono: "danger", ayuda: "Cierra la oportunidad como perdida y pide el motivo." },
];
const tipoDe = (t: string) => TIPOS.find((x) => x.value === t) ?? TIPOS[0];

/**
 * El color de una etapa es un DATO (se guarda en `etapas.color` y se pinta en el embudo), no un token del tema: por eso
 * es una paleta fija de tonos 400, los mismos con los que arranca cada empresa (design-overrides §7). Va en `style`
 * (dato), nunca como clase.
 */
const COLORES = [
  { hex: "#94a3b8", nombre: "Gris" },
  { hex: "#60a5fa", nombre: "Azul" },
  { hex: "#22d3ee", nombre: "Cian" },
  { hex: "#4ade80", nombre: "Verde" },
  { hex: "#a3e635", nombre: "Lima" },
  { hex: "#fbbf24", nombre: "Ámbar" },
  { hex: "#fb923c", nombre: "Naranja" },
  { hex: "#f87171", nombre: "Rojo" },
  { hex: "#f472b6", nombre: "Rosa" },
  { hex: "#a78bfa", nombre: "Violeta" },
];
const nombreColor = (hex: string | null) => COLORES.find((c) => c.hex === hex)?.nombre;

/** Postgres: violacion de CHECK. La usa el trigger que cuida el tipo de una etapa con oportunidades. */
const CHECK_VIOLATION = "23514";
/** Postgres: violacion de clave foranea. */
const FK_VIOLATION = "23503";
/** Postgres: violacion de restriccion unica. Aca, (organizacion_id, orden). */
const UNIQUE_VIOLATION = "23505";

/**
 * Regla del embudo: tiene que quedar siempre al menos una etapa Ganada y una Perdida, o ninguna oportunidad podria
 * cerrarse. Devuelve el motivo si sacar `etapa` de su tipo (borrandola o cambiandole el tipo) rompe la regla.
 */
function motivoDeBloqueo(lista: Etapa[], etapa: Etapa, nuevoTipo: TipoEtapa | "borrar"): string | null {
  if (etapa.tipo === "abierta" || nuevoTipo === etapa.tipo) return null;
  const quedan = lista.some((e) => e.id !== etapa.id && e.tipo === etapa.tipo);
  if (quedan) return null;
  const que = etapa.tipo === "ganada" ? "Ganada" : "Perdida";
  return `«${etapa.nombre}» es la única etapa ${que}. Tiene que quedar al menos una: creá otra de tipo ${que} antes de ${
    nuevoTipo === "borrar" ? "borrar esta" : "cambiarle el tipo a esta"
  }.`;
}

/** Las etapas del embudo (CRM 2.0): misma lógica, mensajes y nombres accesibles que el legacy. */
export default function EtapasTab({ etapas }: { etapas: Etapa[] }) {
  const [lista, setLista] = React.useState(() => [...etapas].sort((a, b) => a.orden - b.orden));
  const editor = useApertura<Etapa | null>();
  const [borrando, setBorrando] = React.useState<Etapa | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const { showToast } = useCrmToast();
  const enfocar = useFocoMover();

  function guardada(etapa: Etapa) {
    setLista((prev) => {
      const existe = prev.some((e) => e.id === etapa.id);
      return (existe ? prev.map((e) => (e.id === etapa.id ? etapa : e)) : [...prev, etapa]).sort((a, b) => a.orden - b.orden);
    });
    editor.cerrar();
  }

  /** Vuelve a leer las etapas de la base: la verdad, cuando un reordenamiento a medias falla. */
  async function recargar() {
    try {
      const { data } = await createClient().from("etapas").select("*").order("orden");
      if (data) setLista(data);
    } catch {
      // Sin red no hay nada mejor que mostrar: queda la lista que está.
    }
  }

  /**
   * (organizacion_id, orden) es UNICO y no se puede diferir: cruzar dos etapas en un paso violaria la restriccion. Se
   * hace en tres: la que sube pasa por un numero libre (el maximo + 1), la otra toma su lugar y la primera toma el de la
   * otra. Si el segundo paso falla se devuelve la primera a su lugar; si falla el tercero se devuelve la vecina y despues
   * la primera. Cada devolucion se comprueba, y en cualquier fallo se recarga la lista desde la base (la secuencia NO es
   * atomica: si un paso de la devolucion tambien falla, lo unico confiable es lo que la base tiene).
   */
  async function mover(etapa: Etapa, direccion: -1 | 1) {
    if (ocupado) return;
    const desde = lista.findIndex((e) => e.id === etapa.id);
    const vecina = lista[desde + direccion];
    if (desde < 0 || !vecina) return;

    setOcupado(true);
    const supabase = createClient();
    const libre = Math.max(...lista.map((e) => e.orden)) + 1;
    const paso = async (id: string, orden: number) => {
      try {
        const { error } = await supabase.from("etapas").update({ orden }).eq("id", id).select().single();
        return !error;
      } catch {
        return false;
      }
    };

    let ok = await paso(etapa.id, libre);
    if (ok) {
      if (!(await paso(vecina.id, etapa.orden))) {
        ok = false;
        await paso(etapa.id, etapa.orden);
      } else if (!(await paso(etapa.id, vecina.orden))) {
        ok = false;
        if (await paso(vecina.id, vecina.orden)) await paso(etapa.id, etapa.orden);
      }
    }

    if (ok) {
      setLista((prev) =>
        prev
          .map((e) => (e.id === etapa.id ? { ...e, orden: vecina.orden } : e.id === vecina.id ? { ...e, orden: etapa.orden } : e))
          .sort((a, b) => a.orden - b.orden),
      );
    } else {
      showToast("No se pudo cambiar el orden de las etapas. Mostramos cómo quedó.", "error");
      await recargar();
    }
    setOcupado(false);
    enfocar(`${etapa.id}:${direccion}`);
  }

  async function borrar(etapa: Etapa) {
    const bloqueo = motivoDeBloqueo(lista, etapa, "borrar");
    if (bloqueo) {
      showToast(bloqueo, "error");
      return;
    }
    setOcupado(true);
    let resultado: { data: Etapa | null; error: { code?: string; message: string } | null };
    try {
      resultado = await createClient().from("etapas").delete().eq("id", etapa.id).select().single();
    } catch {
      resultado = { data: null, error: { message: "" } };
    } finally {
      setOcupado(false);
    }
    const { data, error } = resultado;

    if (error || !data) {
      showToast(
        error?.code === FK_VIOLATION
          ? `No se puede borrar «${etapa.nombre}»: hay oportunidades, o su historial, que pasaron por esta etapa. Si ya no la querés, renombrala.`
          : error?.code === CHECK_VIOLATION
            ? error.message
            : "No se pudo borrar la etapa. Probá de nuevo.",
        "error",
      );
      return;
    }
    setLista((prev) => prev.filter((e) => e.id !== etapa.id));
    showToast(`Etapa «${etapa.nombre}» borrada.`, "success");
  }

  const nueva = () => editor.abrir(null);

  return (
    <SeccionConfig
      titulo="Etapas"
      ariaLabel="Etapas del embudo"
      count={`${lista.length} ${lista.length === 1 ? "etapa" : "etapas"}`}
      accion={<BotonNuevo texto="Nueva etapa" onClick={nueva} />}
      bajada={
        <>
          Los pasos por los que va una oportunidad, de izquierda a derecha en el embudo. Una etapa{" "}
          <strong className="font-semibold text-(--crm-text)">Ganada</strong> cierra la oportunidad como ganada y una{" "}
          <strong className="font-semibold text-(--crm-text)">Perdida</strong> la cierra como perdida; tiene que haber al menos
          una de cada una.
        </>
      }
    >
      <DataTable label="Etapas" busy={ocupado}>
        <THead>
          <Th width={56} hideBelow="sm">
            N.º
          </Th>
          <Th>Etapa</Th>
          <Th width={112} hideBelow="sm">
            Tipo
          </Th>
          <Th width={88}>Orden</Th>
          <Th width={48}>
            <span className="sr-only">Acciones</span>
          </Th>
        </THead>
        <TBody>
          {lista.length === 0 ? (
            <TableMessage colSpan={5}>
              <EmptyState
                compact
                title="El embudo no tiene etapas"
                description="Sin etapas no se pueden cargar oportunidades. Creá una abierta, una ganada y una perdida para arrancar."
                action={
                  <Button size="sm" onClick={nueva}>
                    Nueva etapa
                  </Button>
                }
              />
            </TableMessage>
          ) : (
            lista.map((e, i) => {
              const tipo = tipoDe(e.tipo);
              const color = nombreColor(e.color);
              return (
                <Tr key={e.id}>
                  <Td hideBelow="sm" className={cn(TYPE.mono, "text-(--crm-text-2)")}>
                    {i + 1}
                  </Td>
                  <Td className="py-1">
                    {/* El cuadradito es el color de la etapa (como en el embudo); su nombre, para lectores de pantalla. */}
                    <StatusDot color={e.color ?? undefined} className="max-w-full font-medium">
                      {e.nombre}
                      {color && <span className="sr-only"> (color {color})</span>}
                    </StatusDot>
                    <span className={cn(TYPE.meta, "block text-(--crm-text-2) @[30rem]:hidden")}>{tipo.label}</span>
                  </Td>
                  <Td hideBelow="sm">
                    <StatusDot tone={tipo.tono}>{tipo.label}</StatusDot>
                  </Td>
                  <Td className="overflow-visible px-2">
                    <Mover
                      id={e.id}
                      nombre={e.nombre}
                      esPrimero={i === 0}
                      esUltimo={i === lista.length - 1}
                      ocupado={ocupado}
                      onMover={(d) => void mover(e, d)}
                    />
                  </Td>
                  <Td className="overflow-visible px-1">
                    <CellActions
                      menu={
                        <Menu
                          label={`Acciones de ${e.nombre}`}
                          size="sm"
                          items={[
                            { label: "Editar", icon: Pencil, onSelect: () => editor.abrir(e) },
                            { label: "Borrar", icon: Trash2, variant: "danger", onSelect: () => setBorrando(e) },
                          ]}
                        />
                      }
                    />
                  </Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </DataTable>

      <EtapaForm
        key={editor.n}
        open={editor.abierto}
        onClose={editor.cerrar}
        etapa={editor.valor ?? undefined}
        lista={lista}
        onSaved={guardada}
        onConflict={recargar}
      />

      <ConfirmDialog
        open={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={async () => {
          if (borrando) await borrar(borrando);
        }}
        title="Borrar la etapa"
        description={
          borrando
            ? `«${borrando.nombre}» desaparece del embudo. Solo se puede borrar una etapa que nunca tuvo oportunidades; si ya se usó, la base lo frena.`
            : ""
        }
        confirmText="Borrar etapa"
        variant="danger"
      />
    </SeccionConfig>
  );
}

function EtapaForm({
  open,
  onClose,
  etapa,
  lista,
  onSaved,
  onConflict,
}: {
  open: boolean;
  onClose: () => void;
  etapa?: Etapa;
  lista: Etapa[];
  onSaved: (etapa: Etapa) => void;
  /** Se pisaron con otra persona: que el padre vuelva a leer la lista. */
  onConflict: () => void;
}) {
  const [nombre, setNombre] = React.useState(etapa?.nombre ?? "");
  const [tipo, setTipo] = React.useState<TipoEtapa>((etapa?.tipo as TipoEtapa | undefined) ?? "abierta");
  const [color, setColor] = React.useState(etapa?.color ?? COLORES[0].hex);
  const [nombreError, setNombreError] = React.useState<string | null>(null);
  const [tipoError, setTipoError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  // Si la etapa trae un color que no esta en la paleta (cargado a mano en la base), se conserva como una opcion mas en
  // vez de pisarlo en silencio.
  const colores = COLORES.some((c) => c.hex === color) ? COLORES : [...COLORES, { hex: color, nombre: "Color actual" }];

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) {
      setNombreError("El nombre es obligatorio.");
      return;
    }
    if (etapa) {
      const bloqueo = motivoDeBloqueo(lista, etapa, tipo);
      if (bloqueo) {
        setTipoError(bloqueo);
        return;
      }
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = etapa
      ? await supabase.from("etapas").update({ nombre: limpio, tipo, color }).eq("id", etapa.id).select().single()
      : await supabase
          .from("etapas")
          .insert({ nombre: limpio, tipo, color, orden: Math.max(0, ...lista.map((x) => x.orden)) + 1 })
          .select()
          .single();
    setSaving(false);

    if (dbError || !data) {
      // El trigger de la base frena el cambio de tipo de una etapa con oportunidades adentro, con un mensaje que ya
      // dice que hacer.
      if (dbError?.code === CHECK_VIOLATION) {
        setTipoError(dbError.message);
        return;
      }
      // Otra persona creo una etapa al mismo tiempo y se quedo con el mismo numero de orden.
      if (dbError?.code === UNIQUE_VIOLATION) {
        setError("Alguien más modificó las etapas al mismo tiempo. Cerrá este panel, recargá la lista e intentá de nuevo.");
        onConflict();
        return;
      }
      setError("No se pudo guardar la etapa. Revisá los datos e intentá de nuevo.");
      return;
    }

    showToast(etapa ? "Etapa actualizada." : "Etapa creada. Quedó al final: subila con las flechas.", "success");
    onSaved(data);
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={etapa ? "Editar etapa" : "Nueva etapa"}
      description={etapa?.nombre}
      saving={saving}
      error={error}
      onSubmit={(e) =>
        void sinTrabarse(
          () => guardar(e),
          (m) => {
            setSaving(false);
            setError(m);
          },
        )
      }
    >
      <CampoTexto
        id="etapa-nombre"
        label="Nombre"
        required
        placeholder="Relevamiento de cancha"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />

      <div className="flex flex-col gap-1">
        <CampoOpciones
          id="etapa-tipo"
          label="Tipo"
          required
          value={tipo}
          onChange={(v) => {
            setTipo(v as TipoEtapa);
            if (tipoError) setTipoError(null);
          }}
          options={TIPOS.map((t) => ({ value: t.value, label: t.label }))}
          error={tipoError ?? undefined}
        />
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>{tipoDe(tipo).ayuda}</p>
      </div>

      {/* Radios nativos (una parada de Tab, flechas entre colores); el círculo es el color, el nombre lo lee el lector. */}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium leading-[18px]">Color</legend>
        <div className="flex flex-wrap gap-2">
          {colores.map((c) => (
            <label key={c.hex} className="relative inline-flex cursor-pointer">
              <input
                type="radio"
                name="etapa-color"
                value={c.hex}
                checked={color === c.hex}
                onChange={() => setColor(c.hex)}
                className="peer sr-only"
              />
              <span className="sr-only">{c.nombre}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "block size-8 rounded-full border border-(--crm-border-strong)",
                  // Elegido: un anillo en el color del texto (contraste propio en claro y oscuro), separado del círculo.
                  "peer-checked:shadow-[0_0_0_2px_var(--crm-panel),0_0_0_4px_var(--crm-text)]",
                  // El foco de teclado (en el radio escondido) se ve en el círculo: el anillo de foco de siempre, por fuera.
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[6px] peer-focus-visible:outline-solid peer-focus-visible:outline-(--crm-focus)",
                )}
                style={{ backgroundColor: c.hex }}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </FormDrawer>
  );
}
