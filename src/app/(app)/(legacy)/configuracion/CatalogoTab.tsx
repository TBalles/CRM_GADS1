"use client";

import { useState } from "react";
import { ListChecks, Pencil, Plus, Power } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import { Campo, FormActions, FormBanner } from "@/components/form";
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
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import Mover from "./Mover";
import type { Tables } from "@/lib/supabase/types";

export type TablaCatalogo = "origenes" | "motivos_perdida" | "tipos_actividad";
type Item = Tables<"origenes"> | Tables<"motivos_perdida"> | Tables<"tipos_actividad">;

/** Postgres: violacion de restriccion unica. (organizacion_id, nombre) es unique. */
const UNIQUE_VIOLATION = "23505";

const porOrden = (a: Item, b: Item) => a.orden - b.orden || a.nombre.localeCompare(b.nombre);

/**
 * Un catalogo editable de la organizacion: nombre, orden y activo. Lo usan tres
 * listas con la misma forma (tipos de actividad, origenes, motivos de perdida).
 *
 * No se borra nada: las oportunidades y actividades viejas los siguen
 * referenciando (FK sin cascade). Se desactivan, y dejan de ofrecerse al cargar
 * cosas nuevas.
 */
export default function CatalogoTab({
  tabla,
  items,
  singular,
  plural,
  bajada,
}: {
  tabla: TablaCatalogo;
  items: Item[];
  singular: string;
  plural: string;
  bajada: string;
}) {
  const [lista, setLista] = useState(() => [...items].sort(porOrden));
  const [editando, setEditando] = useState<Item | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [desactivando, setDesactivando] = useState<Item | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { showToast } = useToast();

  function abrir(item: Item | null) {
    setEditando(item);
    setAbierto(true);
  }

  function guardado(item: Item) {
    setLista((prev) => {
      const existe = prev.some((p) => p.id === item.id);
      return (existe ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]).sort(porOrden);
    });
    setAbierto(false);
  }

  async function cambiarActivo(item: Item) {
    if (ocupado) return;
    const proximo = !item.activo;
    setOcupado(true);
    const { data, error } = await createClient()
      .from(tabla)
      .update({ activo: proximo })
      .eq("id", item.id)
      .select()
      .single();
    setOcupado(false);

    if (error || !data) {
      showToast(`No se pudo cambiar el estado de «${item.nombre}».`, "error");
      return;
    }
    setLista((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    showToast(proximo ? `«${item.nombre}» vuelve a ofrecerse.` : `«${item.nombre}» ya no se ofrece.`, "success");
  }

  /**
   * Sube o baja una fila. El orden se renumera 1..N (no hay restriccion unica
   * sobre `orden` en estas tablas): solo se escriben las filas que cambian de
   * numero, normalmente las dos que se cruzan.
   */
  async function mover(item: Item, direccion: -1 | 1) {
    if (ocupado) return;
    const desde = lista.findIndex((p) => p.id === item.id);
    const hasta = desde + direccion;
    if (desde < 0 || hasta < 0 || hasta >= lista.length) return;

    const nueva = [...lista];
    [nueva[desde], nueva[hasta]] = [nueva[hasta], nueva[desde]];
    const cambios = nueva
      .map((p, i) => ({ item: p, orden: i + 1 }))
      .filter(({ item: p, orden }) => p.orden !== orden);

    setOcupado(true);
    const supabase = createClient();
    const resultados = await Promise.all(
      cambios.map(({ item: p, orden }) =>
        supabase.from(tabla).update({ orden }).eq("id", p.id).select().single(),
      ),
    );
    setOcupado(false);

    const fallo = resultados.some((r) => r.error || !r.data);
    if (fallo) {
      showToast("No se pudo guardar el nuevo orden. Recargá la página para ver cómo quedó.", "error");
    }
    // Lo que sí se guardó se refleja; así la pantalla nunca muestra un orden inventado.
    const guardadas = new Map(resultados.flatMap((r) => (r.data ? [[r.data.id, r.data] as const] : [])));
    setLista((prev) => prev.map((p) => guardadas.get(p.id) ?? p).sort(porOrden));
  }

  const activos = lista.filter((p) => p.activo).length;

  return (
    <section className="flex flex-col gap-4" aria-label={plural}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="max-w-[68ch] text-sm text-muted-foreground">{bajada}</p>
          <p className="mt-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {lista.length} {lista.length === 1 ? singular : plural} · {activos} activos
          </p>
        </div>
        <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Nuevo {singular}
        </Button>
      </div>

      {!lista.length ? (
        <EmptyState
          escena="cancha"
          text={`Todavía no hay ${plural}`}
          hint={`Cargá el primero y se ofrece al instante donde corresponda.`}
          action={
            <Button onClick={() => abrir(null)} className="gap-2">
              <Plus aria-hidden="true" className="h-4 w-4" /> Nuevo {singular}
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-28">Orden</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className={p.activo ? "font-medium" : "font-medium text-muted-foreground"}>
                      {p.nombre}
                    </TableCell>
                    <TableCell>
                      <Pill tono={p.activo ? "verde" : "gris"}>{p.activo ? "Activo" : "Inactivo"}</Pill>
                    </TableCell>
                    <TableCell>
                      <Mover
                        nombre={p.nombre}
                        esPrimero={i === 0}
                        esUltimo={i === lista.length - 1}
                        ocupado={ocupado}
                        onMover={(d) => mover(p, d)}
                      />
                    </TableCell>
                    <TableCell>
                      <Acciones item={p} onEditar={abrir} onActivo={cambiarActivo} onDesactivar={setDesactivando} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Tarjetas en mobile */}
          <ul className="space-y-2 md:hidden">
            {lista.map((p, i) => (
              <li key={p.id}>
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={p.activo ? "truncate text-sm font-semibold" : "truncate text-sm font-semibold text-muted-foreground"}>
                        {p.nombre}
                      </p>
                      <div className="mt-1">
                        <Pill tono={p.activo ? "verde" : "gris"}>{p.activo ? "Activo" : "Inactivo"}</Pill>
                      </div>
                    </div>
                    <Mover
                      nombre={p.nombre}
                      esPrimero={i === 0}
                      esUltimo={i === lista.length - 1}
                      ocupado={ocupado}
                      onMover={(d) => mover(p, d)}
                    />
                    <Acciones item={p} onEditar={abrir} onActivo={cambiarActivo} onDesactivar={setDesactivando} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title={editando ? `Editar ${singular}` : `Nuevo ${singular}`}
        subtitle={editando?.nombre}
        icon={ListChecks}
      >
        <CatalogoForm
          key={editando?.id ?? "nuevo"}
          tabla={tabla}
          item={editando ?? undefined}
          siguienteOrden={Math.max(0, ...lista.map((p) => p.orden)) + 1}
          singular={singular}
          onSaved={guardado}
          onCancel={() => setAbierto(false)}
        />
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(desactivando)}
        onClose={() => setDesactivando(null)}
        onConfirm={() => {
          if (desactivando) cambiarActivo(desactivando);
          setDesactivando(null);
        }}
        title={`Desactivar ${singular}`}
        description={
          desactivando
            ? `«${desactivando.nombre}» deja de ofrecerse al cargar cosas nuevas. Lo que ya lo usa lo conserva, y lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Desactivar"
        variant="danger"
        icon={<Power className="h-6 w-6" />}
      />
    </section>
  );
}

function Acciones({
  item,
  onEditar,
  onActivo,
  onDesactivar,
}: {
  item: Item;
  onEditar: (item: Item) => void;
  onActivo: (item: Item) => void;
  onDesactivar: (item: Item) => void;
}) {
  return (
    <RowActions
      label={`Acciones de ${item.nombre}`}
      items={[
        { label: "Editar", icon: Pencil, onClick: () => onEditar(item) },
        {
          label: item.activo ? "Desactivar" : "Reactivar",
          icon: Power,
          variant: item.activo ? "destructive" : "default",
          onClick: () => (item.activo ? onDesactivar(item) : onActivo(item)),
        },
      ]}
    />
  );
}

function CatalogoForm({
  tabla,
  item,
  siguienteOrden,
  singular,
  onSaved,
  onCancel,
}: {
  tabla: TablaCatalogo;
  item?: Item;
  siguienteOrden: number;
  singular: string;
  onSaved: (item: Item) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) {
      setNombreError("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = item
      ? await supabase.from(tabla).update({ nombre: limpio }).eq("id", item.id).select().single()
      : await supabase.from(tabla).insert({ nombre: limpio, orden: siguienteOrden }).select().single();
    setSaving(false);

    if (dbError || !data) {
      if (dbError?.code === UNIQUE_VIOLATION) {
        setNombreError(`Ya tenés un ${singular} con ese nombre.`);
        return;
      }
      setError(`No se pudo guardar el ${singular}. Revisá los datos e intentá de nuevo.`);
      return;
    }

    showToast(item ? "Cambios guardados." : "Listo, ya está en la lista.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}
      <Campo
        id="catalogo-nombre"
        label="Nombre"
        required
        autoFocus
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
