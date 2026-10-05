"use client";

import * as React from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { CellActions, DataTable, TBody, THead, TableMessage, Td, Th, Tr } from "@/components/crm/DataTable";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { EmptyState } from "@/components/crm/Feedback";
import { Menu } from "@/components/crm/Menu";
import { SectionBar } from "@/components/crm/PageBar";
import { StatusDot } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoTexto, FormDrawer, useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, cn } from "@/components/crm/cx";
import { createClient } from "@/lib/supabase/client";
import { sinTrabarse } from "@/lib/guardar";
import type { Tables } from "@/lib/supabase/types";
import { moverEnCatalogo } from "./logica";
import Mover from "./Mover";

export type TablaCatalogo = "origenes" | "motivos_perdida" | "tipos_actividad";
type Item = Tables<"origenes"> | Tables<"motivos_perdida"> | Tables<"tipos_actividad">;

/** Postgres: violacion de restriccion unica. (organizacion_id, nombre) es unique. */
const UNIQUE_VIOLATION = "23505";

const porOrden = (a: Item, b: Item) => a.orden - b.orden || a.nombre.localeCompare(b.nombre);

/**
 * Una sección de Configuración sin caja: barra de sección (h2 + contador + la acción "Nuevo…"), la línea que explica
 * para qué sirve la lista (la "bajada" de siempre) y la tabla. La comparten los tres catálogos y Etapas.
 */
export function SeccionConfig({
  titulo,
  ariaLabel,
  count,
  accion,
  bajada,
  children,
}: {
  titulo: string;
  ariaLabel: string;
  count: string;
  accion: React.ReactNode;
  bajada: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className="flex min-w-0 max-w-5xl flex-col pb-6">
      <SectionBar title={titulo} count={count} actions={accion} />
      <p className={cn(TYPE.ui, "mb-3 max-w-prose text-(--crm-text-2)")}>{bajada}</p>
      {children}
    </section>
  );
}

/** "Nuevo tipo de actividad" / "Nueva etapa": la primaria de la sección visible (con poco ancho, solo el ícono). */
export function BotonNuevo({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <Button variant="primary" size="sm" icon={Plus} onClick={onClick} aria-label={texto} className="max-sm:w-7 max-sm:px-0">
      <span className="max-sm:sr-only">{texto}</span>
    </Button>
  );
}

/**
 * Tras subir/bajar una fila, el foco vuelve a la flecha que se usó: React puede mover la fila en el DOM y un nodo
 * movido pierde el foco (quedaba en `body`). Solo si el foco se perdió o sigue en esa flecha: no se lo saca a nadie.
 */
export function useFocoMover() {
  const destino = React.useRef<string | null>(null);
  // Sin dependencias: corre tras cada render y solo actúa si hay un destino pendiente (lo deja el movimiento al terminar).
  React.useEffect(() => {
    if (!destino.current) return;
    const el = document.querySelector<HTMLElement>(`[data-mover="${destino.current}"]`);
    const activo = document.activeElement;
    if (el && (!activo || activo === document.body || activo === el)) el.focus();
    destino.current = null;
  });
  return React.useCallback((d: string) => {
    destino.current = d;
  }, []);
}

/**
 * Un catálogo editable de la organización (CRM 2.0): nombre, orden y activo. Lo usan tres listas con la misma forma
 * (tipos de actividad, orígenes, motivos de pérdida). Mismas lecturas, escrituras, mensajes y nombres accesibles que el
 * legacy; la tabla es la misma en todo ancho (las columnas se esconden por el ancho del contenedor).
 *
 * No se borra nada: las oportunidades y actividades viejas los siguen referenciando (FK sin cascade). Se desactivan, y
 * dejan de ofrecerse al cargar cosas nuevas.
 */
export default function CatalogoTab({
  tabla,
  items,
  titulo,
  singular,
  plural,
  bajada,
}: {
  tabla: TablaCatalogo;
  items: Item[];
  titulo: string;
  singular: string;
  plural: string;
  bajada: string;
}) {
  const [lista, setLista] = React.useState(() => [...items].sort(porOrden));
  const editor = useApertura<Item | null>();
  const [desactivando, setDesactivando] = React.useState<Item | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const { showToast } = useCrmToast();
  const enfocar = useFocoMover();

  function guardado(item: Item) {
    setLista((prev) => {
      const existe = prev.some((p) => p.id === item.id);
      return (existe ? prev.map((p) => (p.id === item.id ? item : p)) : [...prev, item]).sort(porOrden);
    });
    editor.cerrar();
  }

  async function cambiarActivo(item: Item) {
    if (ocupado) return;
    const proximo = !item.activo;
    setOcupado(true);
    try {
      const { data, error } = await createClient().from(tabla).update({ activo: proximo }).eq("id", item.id).select().single();
      if (error || !data) {
        showToast(`No se pudo cambiar el estado de «${item.nombre}».`, "error");
        return;
      }
      setLista((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      showToast(proximo ? `«${item.nombre}» vuelve a ofrecerse.` : `«${item.nombre}» ya no se ofrece.`, "success");
    } catch {
      showToast(`No se pudo cambiar el estado de «${item.nombre}».`, "error");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Sube o baja una fila. El orden se renumera 1..N (no hay restriccion unica sobre `orden` en estas tablas): solo se
   * escriben las filas que cambian de numero, normalmente las dos que se cruzan.
   */
  async function mover(item: Item, direccion: -1 | 1) {
    if (ocupado) return;
    const paso = moverEnCatalogo(lista, item.id, direccion);
    if (!paso) return;

    setOcupado(true);
    let resultados: { data: Item | null; error: unknown }[] = [];
    try {
      const supabase = createClient();
      resultados = await Promise.all(
        paso.cambios.map(({ item: p, orden }) => supabase.from(tabla).update({ orden }).eq("id", p.id).select().single()),
      );
    } catch {
      resultados = [{ data: null, error: true }];
    } finally {
      setOcupado(false);
    }

    if (resultados.some((r) => r.error || !r.data)) {
      showToast("No se pudo guardar el nuevo orden. Recargá la página para ver cómo quedó.", "error");
    }
    // Lo que sí se guardó se refleja; así la pantalla nunca muestra un orden inventado.
    const guardadas = new Map(resultados.flatMap((r) => (r.data ? [[r.data.id, r.data] as const] : [])));
    setLista((prev) => prev.map((p) => guardadas.get(p.id) ?? p).sort(porOrden));
    enfocar(`${item.id}:${direccion}`);
  }

  const activos = lista.filter((p) => p.activo).length;
  const nuevo = () => editor.abrir(null);

  return (
    <SeccionConfig
      titulo={titulo}
      ariaLabel={plural}
      count={`${lista.length} ${lista.length === 1 ? singular : plural} · ${activos} activos`}
      accion={<BotonNuevo texto={`Nuevo ${singular}`} onClick={nuevo} />}
      bajada={bajada}
    >
      <DataTable label={titulo} busy={ocupado}>
        <THead>
          <Th width={56} hideBelow="sm">
            N.º
          </Th>
          <Th>Nombre</Th>
          <Th width={112} hideBelow="sm">
            Estado
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
                title={`Todavía no hay ${plural}`}
                description="Cargá el primero y se ofrece al instante donde corresponda."
                action={
                  <Button size="sm" icon={Plus} onClick={nuevo}>
                    Nuevo {singular}
                  </Button>
                }
              />
            </TableMessage>
          ) : (
            lista.map((p, i) => (
              <Tr key={p.id}>
                <Td hideBelow="sm" className={cn(TYPE.mono, "text-(--crm-text-2)")}>
                  {i + 1}
                </Td>
                <Td className="py-1">
                  <span className={cn("block truncate font-medium", !p.activo && "text-(--crm-text-2)")}>{p.nombre}</span>
                  {/* Sin la columna Estado (celular): solo "Inactivo" debajo; "Activo" en cada fila es ruido. */}
                  {!p.activo && (
                    <span className={cn(TYPE.meta, "block @[30rem]:hidden")}>
                      <StatusDot tone="neutral">Inactivo</StatusDot>
                    </span>
                  )}
                </Td>
                <Td hideBelow="sm">
                  <StatusDot tone={p.activo ? "success" : "neutral"}>{p.activo ? "Activo" : "Inactivo"}</StatusDot>
                </Td>
                <Td className="overflow-visible px-2">
                  <Mover
                    id={p.id}
                    nombre={p.nombre}
                    esPrimero={i === 0}
                    esUltimo={i === lista.length - 1}
                    ocupado={ocupado}
                    onMover={(d) => void mover(p, d)}
                  />
                </Td>
                <Td className="overflow-visible px-1">
                  <CellActions
                    menu={
                      <Menu
                        label={`Acciones de ${p.nombre}`}
                        size="sm"
                        items={[
                          { label: "Editar", icon: Pencil, onSelect: () => editor.abrir(p) },
                          p.activo
                            ? { label: "Desactivar", icon: Power, variant: "danger", onSelect: () => setDesactivando(p) }
                            : { label: "Reactivar", icon: Power, onSelect: () => void cambiarActivo(p) },
                        ]}
                      />
                    }
                  />
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </DataTable>

      <CatalogoForm
        key={editor.n}
        open={editor.abierto}
        onClose={editor.cerrar}
        tabla={tabla}
        item={editor.valor ?? undefined}
        siguienteOrden={Math.max(0, ...lista.map((p) => p.orden)) + 1}
        singular={singular}
        onSaved={guardado}
      />

      <ConfirmDialog
        open={Boolean(desactivando)}
        onClose={() => setDesactivando(null)}
        onConfirm={async () => {
          if (desactivando) await cambiarActivo(desactivando);
        }}
        title={`Desactivar ${singular}`}
        description={
          desactivando
            ? `«${desactivando.nombre}» deja de ofrecerse al cargar cosas nuevas. Lo que ya lo usa lo conserva, y lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Desactivar"
        variant="danger"
      />
    </SeccionConfig>
  );
}

function CatalogoForm({
  open,
  onClose,
  tabla,
  item,
  siguienteOrden,
  singular,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tabla: TablaCatalogo;
  item?: Item;
  siguienteOrden: number;
  singular: string;
  onSaved: (item: Item) => void;
}) {
  const [nombre, setNombre] = React.useState(item?.nombre ?? "");
  const [nombreError, setNombreError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  async function guardar(e: React.FormEvent) {
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
    <FormDrawer
      open={open}
      onClose={onClose}
      title={item ? `Editar ${singular}` : `Nuevo ${singular}`}
      description={item?.nombre}
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
        id="catalogo-nombre"
        label="Nombre"
        required
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />
    </FormDrawer>
  );
}
