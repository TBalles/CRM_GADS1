"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { CampoOrigen, CampoResponsable } from "@/components/ClienteCampos";
import { useToast } from "@/components/ui/Toast";
import {
  EMAIL_RE,
  ESTADOS,
  estaDeBaja,
  mensajeErrorGuardado,
  type OrigenOpcion,
  type PerfilOpcion,
} from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
export type EmpresaOpcion = { id: string; nombre: string; estado: string };
type Errores = Partial<Record<"nombre" | "email", string>>;

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
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [apellido, setApellido] = useState(contacto?.apellido ?? "");
  const [documento, setDocumento] = useState(contacto?.documento ?? "");
  const [empresaIdValue, setEmpresaIdValue] = useState(contacto?.empresa_id ?? empresaId ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "");
  const [estado, setEstado] = useState(contacto?.estado ?? "potencial");
  const [responsableId, setResponsableId] = useState(contacto ? (contacto.responsable_id ?? "") : yoId);
  const [origenId, setOrigenId] = useState(contacto?.origen_id ?? "");
  const [notas, setNotas] = useState(contacto?.notas ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = "El nombre es obligatorio.";
    if (email.trim() && !EMAIL_RE.test(email.trim())) nuevos.email = "Ese mail no parece válido.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      nombre: nombre.trim(),
      apellido: apellido.trim() || null,
      documento: documento.trim() || null,
      empresa_id: empresaIdValue || null,
      cargo: cargo.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      estado,
      origen_id: origenId || null,
      notas: notas.trim() || null,
      ...(puedeAsignar ? { responsable_id: responsableId || null } : {}),
    };

    const { data, error: dbError } = contacto
      ? await supabase.from("contactos").update(payload).eq("id", contacto.id).select().single()
      : await supabase.from("contactos").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError(mensajeErrorGuardado(dbError, "No se pudo guardar el contacto. Revisá los datos e intentá de nuevo."));
      return;
    }

    showToast(contacto ? "Contacto actualizado." : "Contacto creado.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id="nombre"
          label="Nombre"
          required
          autoFocus
          value={nombre}
          onChange={(v) => {
            setNombre(v);
            limpiar("nombre");
          }}
          error={errores.nombre}
        />
        <Campo id="apellido" label="Apellido" value={apellido} onChange={setApellido} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="documento" label="Documento" inputMode="numeric" placeholder="DNI" value={documento} onChange={setDocumento} />
        <Campo id="cargo" label="Cargo" placeholder="Presidente, encargado de compras…" value={cargo} onChange={setCargo} />
      </div>

      <CampoSelect
        id="empresa_id"
        label="Empresa"
        placeholder="Sin empresa (cliente individual)"
        searchable={empresas.length > 8}
        value={empresaIdValue}
        onChange={setEmpresaIdValue}
        // Las empresas dadas de baja no se ofrecen, salvo la que el contacto ya tiene.
        options={[
          { value: "", label: "Sin empresa (cliente individual)" },
          ...empresas
            .filter((emp) => !estaDeBaja(emp.estado) || emp.id === empresaIdValue)
            .map((emp) => ({ value: emp.id, label: emp.nombre })),
          // La empresa actual puede ser de otra cartera (la RLS no la devuelve): sin esta opción el
          // selector mostraría "Sin empresa" y guardar la desvincularía sin querer.
          ...(empresaIdValue && !empresas.some((emp) => emp.id === empresaIdValue)
            ? [{ value: empresaIdValue, label: "Empresa de otra cartera" }]
            : []),
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            limpiar("email");
          }}
          error={errores.email}
        />
        <Campo id="telefono" label="Teléfono" type="tel" inputMode="tel" value={telefono} onChange={setTelefono} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="estado"
          label="Estado"
          value={estado}
          onChange={setEstado}
          options={ESTADOS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <CampoOrigen value={origenId} onChange={setOrigenId} origenes={origenes} />
      </div>

      <CampoResponsable
        puedeAsignar={puedeAsignar}
        value={responsableId}
        onChange={setResponsableId}
        perfiles={perfiles}
        actual={contacto?.responsable_id ?? null}
        esAlta={!contacto}
      />

      <CampoTextarea id="notas" label="Observaciones" value={notas} onChange={setNotas} />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
