"use client";

import * as React from "react";
import { Drawer } from "../Drawer";
import { Button } from "../Button";
import { InlineBanner } from "../Feedback";
import { Field, Input, Textarea } from "../Field";
import { Select, type SelectOption } from "../Select";
import type { OrigenOpcion, PerfilOpcion } from "@/lib/clientes";

/**
 * Piezas de los formularios de CRM 2.0 que comparten empresa, contacto, actividad y cancha: el drawer con su footer
 * ("Cancelar" / "Guardar" → "Guardando…"), los campos de texto y select por id, y los de responsable y origen.
 * La lógica de cada formulario (validación, payload, guardado) NO vive acá: la trae su hook o su componente.
 */

/**
 * Un abrir/cerrar con carga útil para drawers y diálogos. El valor sobrevive al cierre (el título no cambia a mitad de
 * la animación de salida) y `n` cuenta las aperturas: como `key`, rearma el formulario vacío en cada apertura.
 */
export function useApertura<T>() {
  const [estado, setEstado] = React.useState<{ valor: T | null; abierto: boolean; n: number }>({ valor: null, abierto: false, n: 0 });
  const abrir = React.useCallback((valor: T) => setEstado((e) => ({ valor, abierto: true, n: e.n + 1 })), []);
  const cerrar = React.useCallback(() => setEstado((e) => ({ ...e, abierto: false })), []);
  return { ...estado, abrir, cerrar };
}

export function FormDrawer({
  open,
  onClose,
  title,
  description,
  size,
  saving,
  error,
  submitLabel = "Guardar",
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  size?: "md" | "lg";
  saving: boolean;
  error: string | null;
  submitLabel?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      busy={saving}
      onSubmit={(e) => onSubmit(e)}
      footer={
        <>
          <Button onClick={onClose} disabled={saving} className="max-sm:h-9">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="max-sm:h-9 sm:min-w-28">
            {saving ? "Guardando…" : submitLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <InlineBanner tone="danger">{error}</InlineBanner>}
        {children}
      </div>
    </Drawer>
  );
}

/** Campo de texto con label, error y el id de siempre (`#nombre`…). */
export function CampoTexto({
  id,
  label,
  value,
  onChange,
  error,
  required,
  help,
  className,
  ...input
}: Omit<React.ComponentProps<"input">, "onChange" | "value" | "id"> & {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: React.ReactNode;
}) {
  return (
    <Field id={id} label={label} error={error} required={required} help={help} className={className}>
      {(p) => <Input {...p} {...input} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function CampoArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field id={id} label={label}>
      {(p) => <Textarea {...p} rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function CampoOpciones({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  required,
  searchable,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  searchable?: boolean;
}) {
  return (
    <Field id={id} label={label} error={error} required={required}>
      {(p, labelId) => (
        <Select
          {...p}
          aria-labelledby={labelId}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          searchable={searchable}
        />
      )}
    </Field>
  );
}

/**
 * Responsable (misma regla que `ClienteCampos`): con `clientes.asignar` se elige entre los usuarios (uno dado de baja
 * solo si ya es el actual); sin él es de solo lectura, porque la base rechaza asignar a otro.
 */
export function CampoResponsableCrm({
  puedeAsignar,
  value,
  onChange,
  perfiles,
  actual,
  esAlta,
}: {
  puedeAsignar: boolean;
  value: string;
  onChange: (id: string) => void;
  perfiles: PerfilOpcion[];
  actual: string | null;
  esAlta: boolean;
}) {
  if (puedeAsignar) {
    return (
      <CampoOpciones
        id="responsable_id"
        label="Responsable"
        placeholder="Sin asignar"
        searchable={perfiles.length > 8}
        value={value}
        onChange={onChange}
        options={perfiles
          .filter((p) => p.activo || p.id === actual)
          .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` }))}
      />
    );
  }
  const nombre = esAlta ? "Vos" : perfiles.find((p) => p.id === actual)?.nombre;
  return (
    <div role="group" aria-labelledby="responsable-label" className="flex flex-col gap-1">
      <span id="responsable-label" className="text-[13px] font-medium leading-[18px]">
        Responsable
      </span>
      <p className="flex h-8 items-center rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) px-3">{nombre ?? "Sin asignar"}</p>
      <p className="text-[12px] leading-4 text-(--crm-text-2)">
        {esAlta ? "Queda asignado a tu usuario. Reasignarlo lo hace quien tiene permiso de asignar." : "Lo cambia quien tiene permiso de asignar."}
      </p>
    </div>
  );
}

/** Origen: solo los activos, más el que ya tiene el registro. */
export function CampoOrigenCrm({ value, onChange, origenes }: { value: string; onChange: (id: string) => void; origenes: OrigenOpcion[] }) {
  return (
    <CampoOpciones
      id="origen_id"
      label="Origen"
      placeholder="Sin origen"
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "Sin origen" },
        ...origenes.filter((o) => o.activo || o.id === value).map((o) => ({ value: o.id, label: o.activo ? o.nombre : `${o.nombre} (inactivo)` })),
      ]}
    />
  );
}

/** Dos campos cortos lado a lado desde `sm` (CUIT/Tipo, Teléfono/Email); uno abajo del otro en mobile. */
export function Par({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
