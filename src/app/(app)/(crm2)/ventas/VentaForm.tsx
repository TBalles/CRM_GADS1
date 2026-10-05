"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, IconButton } from "@/components/crm/Button";
import { Input, Label } from "@/components/crm/Field";
import { DatePicker } from "@/components/crm/DatePicker";
import { MoneyInput } from "@/components/crm/MoneyInput";
import { Select } from "@/components/crm/Select";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoArea, CampoFecha, CampoOpciones, CampoTexto, FormDrawer, Par } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, cn } from "@/components/crm/cx";
import { formatMoney, maskFromNumber, parseMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";
import { errorDeLineas, espejarEntregas, hoyLocal, type LineaBorrador } from "./logica";
import { sinTrabarse } from "@/lib/guardar";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;
type Producto = Tables<"productos">;

function nuevaLinea(fecha: string): LineaBorrador {
  return { key: crypto.randomUUID(), productoId: "", cantidad: "1", precio: "", fechaEntrega: fecha };
}

/**
 * "Nueva venta" (CRM 2.0): drawer de 640 con los campos, ids, validaciones, payload y textos de siempre. El detalle es una
 * grilla compacta (una fila por producto desde 34rem de ancho, con las cabeceras una sola vez; apilada en el celular,
 * con el label de cada campo a la vista). Las fechas con el `DatePicker` ("YYYY-MM-DD", mismos ids: `#fecha`,
 * `#item-<key>-entrega`), los precios con el `MoneyInput` de CRM 2.0. `key` desde quien abre: cada apertura arranca vacía.
 */
export default function VentaForm({
  open,
  onClose,
  empresas,
  contactos,
  productos,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empresas: Empresa[];
  contactos: Contacto[];
  productos: Producto[];
  onSaved: () => void;
}) {
  const [fecha, setFecha] = React.useState(hoyLocal);
  const [empresaId, setEmpresaId] = React.useState("");
  const [contactoId, setContactoId] = React.useState("");
  const [comprobante, setComprobante] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [lineas, setLineas] = React.useState<LineaBorrador[]>(() => [nuevaLinea(hoyLocal())]);
  const [empresaError, setEmpresaError] = React.useState<string | null>(null);
  const [lineasError, setLineasError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  function cambiarFecha(nueva: string) {
    setLineas((prev) => espejarEntregas(prev, fecha, nueva));
    setFecha(nueva);
  }

  // Solo los productos activos entran en una venta nueva: los de baja siguen en el historial, no se ofrecen otra vez.
  const opcionesProducto = React.useMemo(
    () =>
      productos
        .filter((p) => p.activo)
        .map((p) => ({ value: p.id, label: p.vida_util_meses ? `${p.nombre} · ${p.vida_util_meses} meses` : p.nombre })),
    [productos],
  );
  const opcionesEmpresa = React.useMemo(() => empresas.map((e) => ({ value: e.id, label: e.nombre })), [empresas]);
  // El contacto tiene que pertenecer a la empresa elegida: ofrecer todos invitaría a asociar la venta con otro club.
  const opcionesContacto = React.useMemo(
    () =>
      contactos
        .filter((c) => c.empresa_id === empresaId)
        .map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido ?? ""}`.trim() })),
    [contactos, empresaId],
  );

  const total = lineas.reduce((acc, l) => acc + parseMoney(l.precio) * (Number(l.cantidad) || 0), 0);

  function actualizar(key: string, cambios: Partial<LineaBorrador>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
    if (lineasError) setLineasError(null);
  }

  /** Al elegir un producto se sugiere su precio de lista, si el campo está vacío. */
  function elegirProducto(key: string, productoId: string) {
    const producto = productos.find((p) => p.id === productoId);
    setLineas((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, productoId, precio: l.precio.trim() || producto?.precio == null ? l.precio : maskFromNumber(producto.precio) } : l,
      ),
    );
    if (lineasError) setLineasError(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) {
      setEmpresaError("Elegí el cliente de esta venta.");
      return;
    }
    const problema = errorDeLineas(lineas);
    if (problema) {
      setLineasError(problema);
      return;
    }
    const cargadas = lineas.filter((l) => l.productoId);

    setEmpresaError(null);
    setLineasError(null);
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

    const { error: itemsError } = await supabase.from("venta_items").insert(
      cargadas.map((l) => ({
        venta_id: venta.id,
        producto_id: l.productoId,
        cantidad: Number(l.cantidad),
        precio_unitario: l.precio.trim() ? parseMoney(l.precio) : null,
        fecha_entrega: l.fechaEntrega || null,
        // vida_util_meses lo completa el trigger copiándolo del catálogo.
      })),
    );

    if (itemsError) {
      // La cabecera ya se insertó. Sin los ítems es una venta vacía que ensucia el historial y no genera ninguna alerta:
      // se deshace. No es una transacción real (haría falta una RPC), pero deja el estado consistente en el caso que importa.
      const { error: rollbackError } = await supabase.from("ventas").delete().eq("id", venta.id);
      setSaving(false);
      // Si el rollback también falló, la cabecera quedó huérfana: decir "no se registró nada" sería mentir.
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
    // Solo se promete el recambio si algún ítem de verdad lo sigue.
    const conRecambio = cargadas.some((l) => productos.find((p) => p.id === l.productoId)?.vida_util_meses);
    showToast(conRecambio ? "Venta registrada. Arrancó el reloj del recambio." : "Venta registrada.", "success");
    onSaved();
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Nueva venta"
      description="El detalle define las alertas de recambio"
      size="lg"
      saving={saving}
      error={error}
      submitLabel="Registrar venta"
      onSubmit={(e) => void sinTrabarse(() => guardar(e), (m) => {
        setSaving(false);
        setError(m);
      })}
    >
      <CampoOpciones
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
      <Par>
        <CampoOpciones
          id="contacto_id"
          label="Contacto"
          placeholder={empresaId ? "Opcional" : "Elegí un cliente primero"}
          options={opcionesContacto}
          value={contactoId}
          onChange={setContactoId}
        />
        <CampoFecha id="fecha" label="Fecha" required value={fecha} onChange={cambiarFecha} />
      </Par>
      <CampoTexto id="comprobante" label="Comprobante" placeholder="Remito 0001-00012345" value={comprobante} onChange={setComprobante} />

      {/* Como un FormSection (título 13/600 + divisor, sin caja), con el total corriendo a la derecha del título. */}
      <section aria-labelledby="venta-detalle" className="@container flex flex-col gap-3 border-t border-(--crm-border) pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="venta-detalle" className="text-[13px] font-semibold leading-[18px]">
            Productos entregados
          </h3>
          <span className={cn(TYPE.mono, "text-[13px] font-medium leading-[18px]")}>
            <span className={TYPE.unit}>$</span> {formatMoney(total).replace(/^\$/, "")}
          </span>
        </div>
        {lineasError && (
          <p role="alert" className={cn(TYPE.meta, "text-(--crm-danger)")}>
            {lineasError}
          </p>
        )}
        {/* Cabeceras de la grilla, una sola vez (decorativas: cada campo tiene su label, oculto en este ancho). */}
        <div aria-hidden="true" className={cn(TYPE.th, "hidden grid-cols-[minmax(0,1fr)_56px_128px_152px_28px] gap-2 @[34rem]:grid")}>
          <span>Producto</span>
          <span>Cantidad</span>
          <span>Precio unit.</span>
          <span>Entrega</span>
        </div>
        <ul className="flex flex-col gap-3 @[34rem]:gap-2">
          {lineas.map((l, i) => (
            <Linea
              key={l.key}
              linea={l}
              numero={i + 1}
              opciones={opcionesProducto}
              quitable={lineas.length > 1}
              onProducto={(v) => elegirProducto(l.key, v)}
              onCambio={(c) => actualizar(l.key, c)}
              onQuitar={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
            />
          ))}
        </ul>
        <div>
          <Button size="sm" icon={Plus} onClick={() => setLineas((prev) => [...prev, nuevaLinea(fecha)])}>
            Agregar producto
          </Button>
        </div>
        <p className={cn(TYPE.meta, "max-w-prose text-(--crm-text-2)")}>
          La fecha de entrega es la que arranca el reloj de la vida útil. Si todavía no entregaste, dejala en la fecha real de
          entrega para que la alerta caiga cuando corresponde.
        </p>
      </section>

      <CampoArea id="notas" label="Notas" placeholder="Condiciones, observaciones de la entrega…" value={notas} onChange={setNotas} />
    </FormDrawer>
  );
}

/**
 * Una línea del detalle. Desde 34rem de ancho: una fila (producto | cantidad | precio | entrega | quitar) bajo las
 * cabeceras de la grilla, con los labels solo para lectores de pantalla. Más angosto: "Producto N" + quitar arriba, el
 * producto, y cantidad · precio y la entrega debajo, con sus labels a la vista. Ids de siempre (`item-<key>-…`).
 */
function Linea({
  linea: l,
  numero,
  opciones,
  quitable,
  onProducto,
  onCambio,
  onQuitar,
}: {
  linea: LineaBorrador;
  numero: number;
  opciones: { value: string; label: string }[];
  quitable: boolean;
  onProducto: (v: string) => void;
  onCambio: (c: Partial<LineaBorrador>) => void;
  onQuitar: () => void;
}) {
  const id = (campo: string) => `item-${l.key}-${campo}`;
  const oculto = "@[34rem]:sr-only";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-end gap-x-2 gap-y-1 border-t border-(--crm-border) pt-3 first:border-t-0 first:pt-0 @[34rem]:grid-cols-[minmax(0,1fr)_56px_128px_152px_28px] @[34rem]:border-t-0 @[34rem]:pt-0">
      <div className="col-span-2 flex min-w-0 flex-col gap-1 @[34rem]:col-span-1">
        <Label id={id("label")} className={oculto}>
          Producto {numero}
        </Label>
        <Select id={id("producto")} searchable placeholder="Elegí un producto…" options={opciones} value={l.productoId} onChange={onProducto} aria-labelledby={id("label")} />
      </div>
      <div className="row-start-1 col-start-3 flex items-end @[34rem]:col-start-5">
        {quitable && <IconButton label={`Quitar producto ${numero}`} icon={Trash2} size="sm" className="mb-0.5" onClick={onQuitar} />}
      </div>
      <div className="flex min-w-0 flex-col gap-1 @[34rem]:row-start-1 @[34rem]:col-start-2">
        <Label htmlFor={id("cantidad")} className={oculto}>
          Cantidad
        </Label>
        <Input id={id("cantidad")} inputMode="numeric" className="tabular-nums" value={l.cantidad} onChange={(e) => onCambio({ cantidad: e.target.value })} />
      </div>
      <div className="flex min-w-0 flex-col gap-1 @[34rem]:row-start-1 @[34rem]:col-start-3">
        <Label htmlFor={id("precio")} className={oculto}>
          Precio unit.
        </Label>
        <MoneyInput id={id("precio")} value={l.precio} onChange={(v) => onCambio({ precio: v })} />
      </div>
      <div className="col-span-2 flex min-w-0 flex-col gap-1 @[34rem]:col-span-1 @[34rem]:row-start-1 @[34rem]:col-start-4">
        <Label htmlFor={id("entrega")} className={oculto}>
          Entrega
        </Label>
        <DatePicker id={id("entrega")} value={l.fechaEntrega} onChange={(v) => onCambio({ fechaEntrega: v })} />
      </div>
    </li>
  );
}
