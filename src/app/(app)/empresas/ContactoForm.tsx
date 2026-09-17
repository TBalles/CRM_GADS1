"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
type Empresa = Tables<"empresas">;

export default function ContactoForm({
  contacto,
  empresaId,
  empresas,
  onSaved,
  onCancel,
}: {
  contacto?: Contacto;
  empresaId?: string;
  empresas: Pick<Empresa, "id" | "nombre">[];
  onSaved: (contacto: Contacto) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [apellido, setApellido] = useState(contacto?.apellido ?? "");
  const [empresaIdValue, setEmpresaIdValue] = useState(contacto?.empresa_id ?? empresaId ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "");
  const [notas, setNotas] = useState(contacto?.notas ?? "");
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setNombreError("El nombre es obligatorio.");
      return;
    }

    setNombreError(null);
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      nombre: nombre.trim(),
      apellido: apellido.trim() || null,
      empresa_id: empresaIdValue || null,
      cargo: cargo.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      notas: notas.trim() || null,
    };

    const { data, error: dbError } = contacto
      ? await supabase.from("contactos").update(payload).eq("id", contacto.id).select().single()
      : await supabase.from("contactos").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar el contacto. Revisá los datos e intentá de nuevo.");
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
            if (nombreError) setNombreError(null);
          }}
          error={nombreError ?? undefined}
        />
        <Campo id="apellido" label="Apellido" value={apellido} onChange={setApellido} />
      </div>

      <CampoSelect
        id="empresa_id"
        label="Empresa"
        placeholder="Sin empresa asociada"
        value={empresaIdValue}
        onChange={setEmpresaIdValue}
        options={empresas.map((emp) => ({ value: emp.id, label: emp.nombre }))}
      />

      <Campo id="cargo" label="Cargo" placeholder="Presidente, encargado de compras…" value={cargo} onChange={setCargo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="email" label="Email" type="email" inputMode="email" value={email} onChange={setEmail} />
        <Campo id="telefono" label="Teléfono" type="tel" inputMode="tel" value={telefono} onChange={setTelefono} />
      </div>

      <CampoTextarea id="notas" label="Notas" value={notas} onChange={setNotas} />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
