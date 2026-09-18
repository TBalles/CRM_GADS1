"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Campo,
  CampoSelect,
  CampoTextarea,
  FormActions,
  FormBanner,
} from "@/components/form";
import { Button, FieldLabel, Input } from "@/components/ui/UIComponents";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { formatMoney, parseMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;
type Producto = Tables<"productos">;

/** Una linea del detalle, mientras se edita en el formulario. */
type ItemBorrador = {
  /** Clave local y estable: el id de la fila todavía no existe en la base. */
  key: string;
  productoId: string;
  cantidad: string;
  precio: string;
  fechaEntrega: string;
};

function nuevoItem(fecha: string): ItemBorrador {
  return {
    key: crypto.randomUUID(),
    productoId: "",
    cantidad: "1",
    precio: "",
    fechaEntrega: fecha,
  };
}

/**
 * aaaa-mm-dd de HOY en hora LOCAL.
 *
 * `toISOString()` da la fecha en UTC. En Argentina (UTC-3), a partir de las 21
 * ya es "mañana" en UTC: una venta cargada a la noche quedaría con la fecha
 * del día siguiente, y esa fecha es la que arranca el reloj de la vida útil.
 * Se corre el instante por el offset local antes de recortarlo.
 */
function hoy() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function VentaForm({
  empresas,
  contactos,
  productos,
  onSaved,
  onCancel,
}: {
  empresas: Empresa[];
  contactos: Contacto[];
  productos: Producto[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fecha, setFecha] = useState(hoy);
  const [empresaId, setEmpresaId] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemBorrador[]>(() => [nuevoItem(hoy())]);
  const [empresaError, setEmpresaError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Solo los productos activos entran en una venta nueva. Los de baja siguen
  // existiendo en el historial, pero no se ofrecen para vender otra vez.
  const opcionesProducto = useMemo(
    () =>
      productos
        .filter((p) => p.activo)
        .map((p) => ({
          value: p.id,
          label: p.vida_util_meses ? `${p.nombre} · ${p.vida_util_meses} meses` : p.nombre,
        })),
    [productos],
  );

  const opcionesEmpresa = useMemo(
    () => empresas.map((e) => ({ value: e.id, label: e.nombre })),
    [empresas],
  );

  // El contacto tiene que pertenecer a la empresa elegida: ofrecer todos
  // invitaría a asociar una venta con el responsable de otro club.
  const opcionesContacto = useMemo(
    () =>
      contactos
        .filter((c) => c.empresa_id === empresaId)
        .map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido ?? ""}`.trim() })),
    [contactos, empresaId],
  );

  const total = items.reduce(
    (acc, it) => acc + parseMoney(it.precio) * (Number(it.cantidad) || 0),
    0,
  );

  function actualizarItem(key: string, cambios: Partial<ItemBorrador>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...cambios } : it)));
    if (itemsError) setItemsError(null);
  }

  /** Al elegir un producto se sugiere su precio de lista, si el campo está vacío. */
  function elegirProducto(key: string, productoId: string) {
    const producto = productos.find((p) => p.id === productoId);
    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? {
              ...it,
              productoId,
              precio:
                it.precio.trim() || producto?.precio == null
                  ? it.precio
                  : new Intl.NumberFormat("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(producto.precio),
            }
          : it,
      ),
    );
    if (itemsError) setItemsError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      setEmpresaError("Elegí el cliente de esta venta.");
      return;
    }

    const cargados = items.filter((it) => it.productoId);
    if (!cargados.length) {
      setItemsError("Agregá al menos un producto.");
      return;
    }
    if (cargados.some((it) => !Number.isInteger(Number(it.cantidad)) || Number(it.cantidad) <= 0)) {
      setItemsError("Las cantidades tienen que ser números enteros mayores a 0.");
      return;
    }

    setEmpresaError(null);
    setItemsError(null);
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        empresa_id: empresaId,
        contacto_id: contactoId || null,
        fecha,
        comprobante: comprobante.trim() || null,
        notas: notas.trim() || null,
      })
      .select()
      .single();

    if (ventaError || !venta) {
      setSaving(false);
      setError("No se pudo registrar la venta. Revisá los datos e intentá de nuevo.");
      return;
    }

    const { error: itemsDbError } = await supabase.from("venta_items").insert(
      cargados.map((it) => ({
        venta_id: venta.id,
        producto_id: it.productoId,
        cantidad: Number(it.cantidad),
        precio_unitario: it.precio.trim() ? parseMoney(it.precio) : null,
        fecha_entrega: it.fechaEntrega || null,
        // vida_util_meses lo completa el trigger copiándolo del catálogo.
      })),
    );

    if (itemsDbError) {
      // La cabecera ya se insertó. Sin los ítems es una venta vacía que
      // ensucia el historial y no genera ninguna alerta, así que se deshace.
      // No es una transacción real — para eso haría falta una función RPC en
      // la base — pero deja el estado consistente en el caso que importa.
      const { error: rollbackError } = await supabase.from("ventas").delete().eq("id", venta.id);
      setSaving(false);
      // Si el rollback también falló, la cabecera quedó huérfana: decir "no se
      // registró nada" sería mentir, y nadie iría a limpiarla.
      setError(
        rollbackError
          ? `No se pudieron guardar los productos y quedó una venta vacía (comprobante ${
              comprobante.trim() || "sin número"
            }). Borrala a mano antes de volver a intentar.`
          : "No se pudieron guardar los productos de la venta. No se registró nada.",
      );
      return;
    }

    setSaving(false);
    showToast("Venta registrada.", "success");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <CampoSelect
        id="empresa_id"
        label="Cliente"
        required
        searchable
        placeholder="Elegí un club o complejo…"
        options={opcionesEmpresa}
        value={empresaId}
        onChange={(v) => {
          setEmpresaId(v);
          // El contacto elegido pertenecía a la empresa anterior.
          setContactoId("");
          if (empresaError) setEmpresaError(null);
        }}
        error={empresaError ?? undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="contacto_id"
          label="Contacto"
          placeholder={empresaId ? "Opcional" : "Elegí un cliente primero"}
          options={opcionesContacto}
          value={contactoId}
          onChange={setContactoId}
        />
        <Campo id="fecha" label="Fecha" type="date" required value={fecha} onChange={setFecha} />
      </div>

      <Campo
        id="comprobante"
        label="Comprobante"
        placeholder="Remito 0001-00012345"
        value={comprobante}
        onChange={setComprobante}
      />

      {/* ── Detalle ─────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Productos entregados</h3>
          <span className="text-sm font-bold tabular-nums">{formatMoney(total)}</span>
        </div>

        {itemsError && (
          <p role="alert" className="text-[10px] font-medium text-destructive">
            {itemsError}
          </p>
        )}

        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={it.key} className="space-y-2 rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel id={`item-${it.key}-label`}>Producto {i + 1}</FieldLabel>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                    aria-label={`Quitar producto ${i + 1}`}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select
                id={`item-${it.key}-producto`}
                searchable
                placeholder="Elegí un producto…"
                options={opcionesProducto}
                value={it.productoId}
                onChange={(v) => elegirProducto(it.key, v)}
                aria-labelledby={`item-${it.key}-label`}
              />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <FieldLabel htmlFor={`item-${it.key}-cantidad`}>Cantidad</FieldLabel>
                  <Input
                    id={`item-${it.key}-cantidad`}
                    inputMode="numeric"
                    value={it.cantidad}
                    onChange={(e) => actualizarItem(it.key, { cantidad: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`item-${it.key}-precio`}>Precio unit.</FieldLabel>
                  <MoneyInput
                    id={`item-${it.key}-precio`}
                    value={it.precio}
                    onChange={(v) => actualizarItem(it.key, { precio: v })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <FieldLabel htmlFor={`item-${it.key}-entrega`}>Entrega</FieldLabel>
                  <Input
                    id={`item-${it.key}-entrega`}
                    type="date"
                    value={it.fechaEntrega}
                    onChange={(e) => actualizarItem(it.key, { fechaEntrega: e.target.value })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((prev) => [...prev, nuevoItem(fecha)])}
          className="w-full gap-1.5 sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar producto
        </Button>

        <p className="text-xs leading-relaxed text-muted-foreground">
          La fecha de entrega es la que arranca el reloj de la vida útil. Si todavía no entregaste,
          dejala en la fecha real de entrega para que la alerta caiga cuando corresponde.
        </p>
      </div>

      <CampoTextarea
        id="notas"
        label="Notas"
        placeholder="Condiciones, observaciones de la entrega…"
        value={notas}
        onChange={setNotas}
      />

      <FormActions saving={saving} onCancel={onCancel} submitLabel="Registrar venta" />
    </form>
  );
}
