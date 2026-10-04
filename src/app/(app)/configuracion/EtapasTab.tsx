"use client";

import { useState } from "react";
import { Pencil, Plus, Route, Trash2 } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import { Campo, CampoSelect, FormActions, FormBanner } from "@/components/form";
import {
  Button,
  Card,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  type Tono,
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import Mover from "./Mover";
import type { Tables } from "@/lib/supabase/types";

type Etapa = Tables<"etapas">;
type TipoEtapa = "abierta" | "ganada" | "perdida";

const TIPOS: { value: TipoEtapa; label: string; tono: Tono; ayuda: string }[] = [
  { value: "abierta", label: "Abierta", tono: "azul", ayuda: "La oportunidad sigue en juego." },
  { value: "ganada", label: "Ganada", tono: "verde", ayuda: "Cierra la oportunidad como ganada." },
  { value: "perdida", label: "Perdida", tono: "rojo", ayuda: "Cierra la oportunidad como perdida y pide el motivo." },
];
const tipoDe = (t: string) => TIPOS.find((x) => x.value === t) ?? TIPOS[0];

/**
 * El color de una etapa es un DATO (se guarda en `etapas.color` y se pinta en el
 * embudo), no un token del tema: por eso es una paleta fija de tonos 400, los
 * mismos con los que arranca cada empresa (design-overrides §7).
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

/** Postgres: violacion de CHECK. La usa el trigger que cuida el tipo de una etapa con oportunidades. */
const CHECK_VIOLATION = "23514";
/** Postgres: violacion de clave foranea. */
const FK_VIOLATION = "23503";
/** Postgres: violacion de restriccion unica. Aca, (organizacion_id, orden). */
const UNIQUE_VIOLATION = "23505";

/**
 * Regla del embudo: tiene que quedar siempre al menos una etapa Ganada y una
 * Perdida, o ninguna oportunidad podria cerrarse. Devuelve el motivo si sacar
 * `etapa` de su tipo (borrandola o cambiandole el tipo) rompe la regla.
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

export default function EtapasTab({ etapas }: { etapas: Etapa[] }) {
  const [lista, setLista] = useState(() => [...etapas].sort((a, b) => a.orden - b.orden));
  const [editando, setEditando] = useState<Etapa | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState<Etapa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { showToast } = useToast();

  function abrir(etapa: Etapa | null) {
    setEditando(etapa);
    setAbierto(true);
  }

  function guardada(etapa: Etapa) {
    setLista((prev) => {
      const existe = prev.some((e) => e.id === etapa.id);
      return (existe ? prev.map((e) => (e.id === etapa.id ? etapa : e)) : [...prev, etapa]).sort(
        (a, b) => a.orden - b.orden,
      );
    });
    setAbierto(false);
  }

  /** Vuelve a leer las etapas de la base: la verdad, cuando un reordenamiento a medias falla. */
  async function recargar() {
    const { data } = await createClient().from("etapas").select("*").order("orden");
    if (data) setLista(data);
  }

  /**
   * (organizacion_id, orden) es UNICO y no se puede diferir: cruzar dos etapas
   * en un paso violaria la restriccion. Se hace en tres: la que sube pasa por un
   * numero libre (el maximo + 1), la otra toma su lugar y la primera toma el de
   * la otra. Si el segundo paso falla se devuelve la primera a su lugar; si falla
   * el tercero se devuelve la vecina y despues la primera. Cada devolucion se
   * comprueba, y en cualquier fallo se recarga la lista desde la base (la
   * secuencia NO es atomica: si un paso de la devolucion tambien falla, lo unico
   * confiable es lo que la base tiene).
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
      const { error } = await supabase.from("etapas").update({ orden }).eq("id", id).select().single();
      return !error;
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
          .map((e) =>
            e.id === etapa.id ? { ...e, orden: vecina.orden } : e.id === vecina.id ? { ...e, orden: etapa.orden } : e,
          )
          .sort((a, b) => a.orden - b.orden),
      );
    } else {
      showToast("No se pudo cambiar el orden de las etapas. Mostramos cómo quedó.", "error");
      await recargar();
    }
    setOcupado(false);
  }

  async function borrar(etapa: Etapa) {
    const bloqueo = motivoDeBloqueo(lista, etapa, "borrar");
    if (bloqueo) {
      showToast(bloqueo, "error");
      return;
    }
    setOcupado(true);
    const { data, error } = await createClient().from("etapas").delete().eq("id", etapa.id).select().single();
    setOcupado(false);

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

  const acciones = (e: Etapa) => (
    <RowActions
      label={`Acciones de ${e.nombre}`}
      items={[
        { label: "Editar", icon: Pencil, onClick: () => abrir(e) },
        { label: "Borrar", icon: Trash2, variant: "destructive", onClick: () => setBorrando(e) },
      ]}
    />
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Etapas del embudo">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            Los pasos por los que va una oportunidad, de izquierda a derecha en el embudo. Una etapa{" "}
            <strong className="font-semibold text-foreground">Ganada</strong> cierra la oportunidad como ganada y una{" "}
            <strong className="font-semibold text-foreground">Perdida</strong> la cierra como perdida; tiene que haber al
            menos una de cada una.
          </p>
          <p className="mt-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {lista.length} {lista.length === 1 ? "etapa" : "etapas"}
          </p>
        </div>
        <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Nueva etapa
        </Button>
      </div>

      {!lista.length ? (
        <EmptyState
          escena="cancha"
          text="El embudo no tiene etapas"
          hint="Sin etapas no se pueden cargar oportunidades. Creá una abierta, una ganada y una perdida para arrancar."
          action={
            <Button onClick={() => abrir(null)} className="gap-2">
              <Plus aria-hidden="true" className="h-4 w-4" /> Nueva etapa
            </Button>
          }
        />
      ) : (
        <>
          {/* Tabla en desktop */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">N.º</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-28">Orden</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((e, i) => {
                  const tipo = tipoDe(e.tipo);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2.5 font-medium">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-border"
                            style={{ backgroundColor: e.color ?? undefined }}
                          />
                          {e.nombre}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Pill tono={tipo.tono}>{tipo.label}</Pill>
                      </TableCell>
                      <TableCell>
                        <Mover
                          nombre={e.nombre}
                          esPrimero={i === 0}
                          esUltimo={i === lista.length - 1}
                          ocupado={ocupado}
                          onMover={(d) => mover(e, d)}
                        />
                      </TableCell>
                      <TableCell>{acciones(e)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Tarjetas en mobile */}
          <ul className="space-y-2 md:hidden">
            {lista.map((e, i) => {
              const tipo = tipoDe(e.tipo);
              return (
                <li key={e.id}>
                  <Card className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-border"
                            style={{ backgroundColor: e.color ?? undefined }}
                          />
                          <span className="truncate">{e.nombre}</span>
                        </p>
                        <div className="mt-1">
                          <Pill tono={tipo.tono}>{tipo.label}</Pill>
                        </div>
                      </div>
                      <Mover
                        nombre={e.nombre}
                        esPrimero={i === 0}
                        esUltimo={i === lista.length - 1}
                        ocupado={ocupado}
                        onMover={(d) => mover(e, d)}
                      />
                      {acciones(e)}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title={editando ? "Editar etapa" : "Nueva etapa"}
        subtitle={editando?.nombre}
        icon={Route}
      >
        <EtapaForm
          key={editando?.id ?? "nueva"}
          etapa={editando ?? undefined}
          lista={lista}
          onSaved={guardada}
          onCancel={() => setAbierto(false)}
          onConflict={recargar}
        />
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(borrando)}
        onClose={() => setBorrando(null)}
        onConfirm={() => {
          if (borrando) borrar(borrando);
          setBorrando(null);
        }}
        title="Borrar la etapa"
        description={
          borrando
            ? `«${borrando.nombre}» desaparece del embudo. Solo se puede borrar una etapa que nunca tuvo oportunidades; si ya se usó, la base lo frena.`
            : ""
        }
        confirmText="Borrar etapa"
        variant="danger"
        icon={<Trash2 className="h-6 w-6" />}
      />
    </section>
  );
}

function EtapaForm({
  etapa,
  lista,
  onSaved,
  onCancel,
  onConflict,
}: {
  etapa?: Etapa;
  lista: Etapa[];
  onSaved: (etapa: Etapa) => void;
  onCancel: () => void;
  /** Se pisaron con otra persona: que el padre vuelva a leer la lista. */
  onConflict: () => void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoEtapa>((etapa?.tipo as TipoEtapa | undefined) ?? "abierta");
  const [color, setColor] = useState(etapa?.color ?? COLORES[0].hex);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [tipoError, setTipoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Si la etapa trae un color que no esta en la paleta (cargado a mano en la
  // base), se conserva como una opcion mas en vez de pisarlo en silencio.
  const colores = COLORES.some((c) => c.hex === color) ? COLORES : [...COLORES, { hex: color, nombre: "Color actual" }];

  async function handleSubmit(e: React.FormEvent) {
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
      // El trigger de la base frena el cambio de tipo de una etapa con
      // oportunidades adentro, con un mensaje que ya dice que hacer.
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="etapa-nombre"
        label="Nombre"
        required
        autoFocus
        placeholder="Relevamiento de cancha"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />

      <div>
        <CampoSelect
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
        <p className="mt-1.5 text-xs text-muted-foreground">{tipoDe(tipo).ayuda}</p>
      </div>

      <fieldset>
        <legend className="mb-1 block text-xs font-medium text-muted-foreground">Color</legend>
        <div className="flex flex-wrap gap-2.5">
          {colores.map((c) => (
            <label key={c.hex} className="relative cursor-pointer">
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
                title={c.nombre}
                className={cn(
                  "block h-8 w-8 rounded-full ring-1 ring-inset ring-border transition-shadow",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
                  color === c.hex && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: c.hex }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
