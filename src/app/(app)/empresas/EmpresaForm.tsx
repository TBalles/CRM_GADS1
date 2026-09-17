"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoTextarea } from "@/components/form";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;

export default function EmpresaForm({
  empresa,
  onSaved,
}: {
  empresa?: Empresa;
  onSaved: (empresa: Empresa) => void;
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? "");
  const [cuit, setCuit] = useState(empresa?.cuit ?? "");
  const [telefono, setTelefono] = useState(empresa?.telefono ?? "");
  const [email, setEmail] = useState(empresa?.email ?? "");
  const [direccion, setDireccion] = useState(empresa?.direccion ?? "");
  const [notas, setNotas] = useState(empresa?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

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
      setError("No se pudo guardar la empresa.");
      return;
    }

    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo id="nombre" label="Nombre *" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo id="cuit" label="CUIT" value={cuit ?? ""} onChange={(e) => setCuit(e.target.value)} />
      <Campo id="telefono" label="Teléfono" value={telefono ?? ""} onChange={(e) => setTelefono(e.target.value)} />
      <Campo id="email" label="Email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
      <Campo id="direccion" label="Dirección" value={direccion ?? ""} onChange={(e) => setDireccion(e.target.value)} />
      <CampoTextarea id="notas" label="Notas" value={notas ?? ""} onChange={(e) => setNotas(e.target.value)} />

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
