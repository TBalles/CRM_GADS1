"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;

export default function EmpresaForm({
  empresa,
  onSaved,
  onCancel,
}: {
  empresa?: Empresa;
  onSaved: (empresa: Empresa) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? "");
  const [cuit, setCuit] = useState(empresa?.cuit ?? "");
  const [telefono, setTelefono] = useState(empresa?.telefono ?? "");
  const [email, setEmail] = useState(empresa?.email ?? "");
  const [direccion, setDireccion] = useState(empresa?.direccion ?? "");
  const [notas, setNotas] = useState(empresa?.notas ?? "");
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
      cuit: cuit.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      notas: notas.trim() || null,
    };

    const { data, error: dbError } = empresa
      ? await supabase.from("empresas").update(payload).eq("id", empresa.id).select().single()
      : await supabase.from("empresas").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar la empresa. Revisá los datos e intentá de nuevo.");
      return;
    }

    showToast(empresa ? "Empresa actualizada." : "Empresa creada.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="nombre"
        label="Nombre"
        required
        autoFocus
        placeholder="Club Atlético…"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="cuit" label="CUIT" inputMode="numeric" placeholder="30-12345678-9" value={cuit} onChange={setCuit} />
        <Campo id="telefono" label="Teléfono" type="tel" inputMode="tel" placeholder="11 5555-5555" value={telefono} onChange={setTelefono} />
      </div>

      <Campo id="email" label="Email" type="email" inputMode="email" placeholder="contacto@club.com" value={email} onChange={setEmail} />
      <Campo id="direccion" label="Dirección" placeholder="Av. Siempre Viva 742" value={direccion} onChange={setDireccion} />
      <CampoTextarea id="notas" label="Notas" placeholder="Contexto, historial, preferencias…" value={notas} onChange={setNotas} />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
