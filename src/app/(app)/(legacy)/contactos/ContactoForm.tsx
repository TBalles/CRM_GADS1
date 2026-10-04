"use client";

import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { CampoOrigen, CampoResponsable } from "@/components/ClienteCampos";
import { useToast } from "@/components/ui/Toast";
import { ESTADOS, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { opcionesEmpresa, useContactoForm, type EmpresaOpcion } from "@/lib/formularios/contacto";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
export type { EmpresaOpcion };

/** Formulario legacy del contacto. La lógica (validación, payload, guardado) es `useContactoForm`, compartida con CRM 2.0. */
export default function ContactoForm({
  contacto,
  empresaId,
  empresas,
  perfiles,
  origenes,
  puedeAsignar,
  yoId,
  onSaved,
  onCancel,
}: {
  contacto?: Contacto;
  /** Empresa preseleccionada al crear desde su ficha. */
  empresaId?: string;
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** `clientes.asignar`: sin el, el responsable no se elige (la base lo rechaza igual). */
  puedeAsignar: boolean;
  yoId: string;
  onSaved: (contacto: Contacto) => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const { v, set, errores, error, saving, submit } = useContactoForm({ contacto, empresaId, puedeAsignar, yoId, notificar: showToast, onSaved });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id="nombre"
          label="Nombre"
          required
          autoFocus
          value={v.nombre}
          onChange={(x) => set("nombre", x)}
          error={errores.nombre}
        />
        <Campo id="apellido" label="Apellido" value={v.apellido} onChange={(x) => set("apellido", x)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="documento" label="Documento" inputMode="numeric" placeholder="DNI" value={v.documento} onChange={(x) => set("documento", x)} />
        <Campo id="cargo" label="Cargo" placeholder="Presidente, encargado de compras…" value={v.cargo} onChange={(x) => set("cargo", x)} />
      </div>

      <CampoSelect
        id="empresa_id"
        label="Empresa"
        placeholder="Sin empresa (cliente individual)"
        searchable={empresas.length > 8}
        value={v.empresaId}
        onChange={(x) => set("empresaId", x)}
        options={opcionesEmpresa(empresas, v.empresaId)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          value={v.email}
          onChange={(x) => set("email", x)}
          error={errores.email}
        />
        <Campo id="telefono" label="Teléfono" type="tel" inputMode="tel" value={v.telefono} onChange={(x) => set("telefono", x)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="estado"
          label="Estado"
          value={v.estado}
          onChange={(x) => set("estado", x)}
          options={ESTADOS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <CampoOrigen value={v.origenId} onChange={(x) => set("origenId", x)} origenes={origenes} />
      </div>

      <CampoResponsable
        puedeAsignar={puedeAsignar}
        value={v.responsableId}
        onChange={(x) => set("responsableId", x)}
        perfiles={perfiles}
        actual={contacto?.responsable_id ?? null}
        esAlta={!contacto}
      />

      <CampoTextarea id="notas" label="Observaciones" value={v.notas} onChange={(x) => set("notas", x)} />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
