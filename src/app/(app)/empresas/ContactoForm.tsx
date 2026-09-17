"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
type Empresa = Tables<"empresas">;

export default function ContactoForm({
  contacto,
  empresaId,
  empresas,
  onSaved,
}: {
  contacto?: Contacto;
  empresaId?: string;
  empresas: Pick<Empresa, "id" | "nombre">[];
  onSaved: (contacto: Contacto) => void;
}) {
  const [nombre, setNombre] = useState(contacto?.nombre ?? "");
  const [apellido, setApellido] = useState(contacto?.apellido ?? "");
  const [empresaIdValue, setEmpresaIdValue] = useState(contacto?.empresa_id ?? empresaId ?? "");
  const [cargo, setCargo] = useState(contacto?.cargo ?? "");
  const [email, setEmail] = useState(contacto?.email ?? "");
  const [telefono, setTelefono] = useState(contacto?.telefono ?? "");
  const [notas, setNotas] = useState(contacto?.notas ?? "");
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
      setError("No se pudo guardar el contacto.");
      return;
    }

    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Campo id="nombre" label="Nombre *" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo id="apellido" label="Apellido" value={apellido ?? ""} onChange={(e) => setApellido(e.target.value)} />
      </div>
      <CampoSelect
        id="empresa_id"
        label="Empresa"
        placeholder="Sin empresa asociada"
        value={empresaIdValue ?? ""}
        onChange={(e) => setEmpresaIdValue(e.target.value)}
        options={empresas.map((emp) => ({ value: emp.id, label: emp.nombre }))}
      />
      <Campo id="cargo" label="Cargo" value={cargo ?? ""} onChange={(e) => setCargo(e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Campo id="email" label="Email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        <Campo id="telefono" label="Teléfono" value={telefono ?? ""} onChange={(e) => setTelefono(e.target.value)} />
      </div>
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
