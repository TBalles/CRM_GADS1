"use client";

import { CampoSelect } from "@/components/form";
import { FieldLabel } from "@/components/ui/UIComponents";
import type { OrigenOpcion, PerfilOpcion } from "@/lib/clientes";

/**
 * Responsable de una empresa o contacto.
 *
 * Con `clientes.asignar` se elige entre los usuarios de la organizacion. Sin
 * ese permiso el campo es de solo lectura: la base (trigger `validar_responsable`)
 * rechaza asignar a otro, y un alta nueva queda a nombre de quien la crea. Se
 * muestra igual para que se vea de quien es el registro.
 */
export function CampoResponsable({
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
  /** Id del responsable que ya tiene el registro (null en un alta). */
  actual: string | null;
  esAlta: boolean;
}) {
  if (puedeAsignar) {
    return (
      <CampoSelect
        id="responsable_id"
        label="Responsable"
        placeholder="Sin asignar"
        searchable={perfiles.length > 8}
        value={value}
        onChange={onChange}
        // Un usuario dado de baja solo se ofrece si ya es el responsable actual.
        options={perfiles
          .filter((p) => p.activo || p.id === actual)
          .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` }))}
      />
    );
  }

  const nombre = esAlta ? "Vos" : perfiles.find((p) => p.id === actual)?.nombre;
  return (
    <div role="group" aria-labelledby="responsable-label">
      <FieldLabel id="responsable-label">Responsable</FieldLabel>
      <p
        className="flex h-10 items-center rounded-lg border border-input bg-secondary px-3 text-sm"
      >
        {nombre ?? "Sin asignar"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {esAlta
          ? "Queda asignado a tu usuario. Reasignarlo lo hace quien tiene permiso de asignar."
          : "Lo cambia quien tiene permiso de asignar."}
      </p>
    </div>
  );
}

/** Origen del cliente (catalogo de la organizacion). Solo ofrece los activos, mas el que ya tiene el registro. */
export function CampoOrigen({
  value,
  onChange,
  origenes,
}: {
  value: string;
  onChange: (id: string) => void;
  origenes: OrigenOpcion[];
}) {
  return (
    <CampoSelect
      id="origen_id"
      label="Origen"
      placeholder="Sin origen"
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: "Sin origen" },
        ...origenes
          .filter((o) => o.activo || o.id === value)
          .map((o) => ({ value: o.id, label: o.activo ? o.nombre : `${o.nombre} (inactivo)` })),
      ]}
    />
  );
}
