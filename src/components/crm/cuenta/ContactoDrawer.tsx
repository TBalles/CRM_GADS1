"use client";

import { useCrmToast } from "../Toast";
import { CampoArea, CampoOpciones, CampoOrigenCrm, CampoResponsableCrm, CampoTexto, FormDrawer, Par } from "./FormDrawer";
import { ESTADOS, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { opcionesEmpresa, useContactoForm, type EmpresaOpcion } from "@/lib/formularios/contacto";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;

type Props = {
  open: boolean;
  onClose: () => void;
  contacto?: Contacto;
  /** Empresa preseleccionada al crear desde su ficha. */
  empresaId?: string;
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  puedeAsignar: boolean;
  yoId: string;
  /** Subtítulo del drawer (la empresa desde la que se abre). */
  description?: string;
  onSaved: (contacto: Contacto) => void;
};

/**
 * "Nuevo contacto" / "Editar contacto" en un drawer de CRM 2.0. Misma lógica que el formulario legacy
 * (`useContactoForm`): mismos campos, ids (`#nombre`, `#apellido`, `#empresa_id`…), validaciones y mensajes.
 * Quien lo usa le pone `key` por apertura (`useApertura().n`) para que cada alta empiece vacía.
 */
export function ContactoDrawer({ open, onClose, contacto, empresaId, empresas, perfiles, origenes, puedeAsignar, yoId, description, onSaved }: Props) {
  const { showToast } = useCrmToast();
  const { v, set, errores, error, saving, submit } = useContactoForm({ contacto, empresaId, puedeAsignar, yoId, notificar: showToast, onSaved });
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={contacto ? "Editar contacto" : "Nuevo contacto"}
      description={description}
      saving={saving}
      error={error}
      onSubmit={submit}
    >
      <Par>
        <CampoTexto id="nombre" label="Nombre" required value={v.nombre} onChange={(x) => set("nombre", x)} error={errores.nombre} />
        <CampoTexto id="apellido" label="Apellido" value={v.apellido} onChange={(x) => set("apellido", x)} />
      </Par>
      <Par>
        <CampoTexto id="documento" label="Documento" inputMode="numeric" placeholder="DNI" value={v.documento} onChange={(x) => set("documento", x)} />
        <CampoTexto id="cargo" label="Cargo" placeholder="Presidente, encargado de compras…" value={v.cargo} onChange={(x) => set("cargo", x)} />
      </Par>
      <CampoOpciones
        id="empresa_id"
        label="Empresa"
        placeholder="Sin empresa (cliente individual)"
        searchable={empresas.length > 8}
        value={v.empresaId}
        onChange={(x) => set("empresaId", x)}
        options={opcionesEmpresa(empresas, v.empresaId)}
      />
      <Par>
        <CampoTexto id="email" label="Email" type="email" inputMode="email" value={v.email} onChange={(x) => set("email", x)} error={errores.email} />
        <CampoTexto id="telefono" label="Teléfono" type="tel" inputMode="tel" value={v.telefono} onChange={(x) => set("telefono", x)} />
      </Par>
      <Par>
        <CampoOpciones id="estado" label="Estado" value={v.estado} onChange={(x) => set("estado", x)} options={ESTADOS.map((s) => ({ value: s.value, label: s.label }))} />
        <CampoOrigenCrm value={v.origenId} onChange={(x) => set("origenId", x)} origenes={origenes} />
      </Par>
      <CampoResponsableCrm
        puedeAsignar={puedeAsignar}
        value={v.responsableId}
        onChange={(x) => set("responsableId", x)}
        perfiles={perfiles}
        actual={contacto?.responsable_id ?? null}
        esAlta={!contacto}
      />
      <CampoArea id="notas" label="Observaciones" value={v.notas} onChange={(x) => set("notas", x)} />
    </FormDrawer>
  );
}
