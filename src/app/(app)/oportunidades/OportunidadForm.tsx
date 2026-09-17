"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";
import type { Tables } from "@/lib/supabase/types";

type Oportunidad = Tables<"oportunidades">;

type Opcion = { id: string; label: string };

export default function OportunidadForm({
  oportunidad,
  empresas,
  contactos,
  productos,
  etapas,
  perfiles,
  onSaved,
}: {
  oportunidad?: Oportunidad;
  empresas: Opcion[];
  contactos: Opcion[];
  productos: Opcion[];
  etapas: Opcion[];
  perfiles: Opcion[];
  onSaved: (oportunidad: Oportunidad) => void;
}) {
  const [titulo, setTitulo] = useState(oportunidad?.titulo ?? "");
  const [empresaId, setEmpresaId] = useState(oportunidad?.empresa_id ?? "");
  const [contactoId, setContactoId] = useState(oportunidad?.contacto_id ?? "");
  const [productoId, setProductoId] = useState(oportunidad?.producto_id ?? "");
  const [responsableId, setResponsableId] = useState(oportunidad?.responsable_id ?? "");
  const [etapaId, setEtapaId] = useState(oportunidad?.etapa_id ?? etapas[0]?.id ?? "");
  const [monto, setMonto] = useState(oportunidad?.monto != null ? String(oportunidad.monto) : "");
  const [notas, setNotas] = useState(oportunidad?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !etapaId) {
      setError("Completá el título y la etapa.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      titulo: titulo.trim(),
      empresa_id: empresaId || null,
      contacto_id: contactoId || null,
      producto_id: productoId || null,
      responsable_id: responsableId || null,
      etapa_id: etapaId,
      monto: monto ? Number(monto) : null,
      notas: notas.trim() || null,
    };

    const { data, error: dbError } = oportunidad
      ? await supabase.from("oportunidades").update(payload).eq("id", oportunidad.id).select().single()
      : await supabase.from("oportunidades").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar la oportunidad.");
      return;
    }

    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo id="titulo" label="Título *" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />

      <div className="grid grid-cols-2 gap-4">
        <CampoSelect
          id="empresa_id"
          label="Empresa"
          placeholder="Sin empresa"
          value={empresaId ?? ""}
          onChange={(e) => setEmpresaId(e.target.value)}
          options={empresas.map((o) => ({ value: o.id, label: o.label }))}
        />
        <CampoSelect
          id="contacto_id"
          label="Contacto"
          placeholder="Sin contacto"
          value={contactoId ?? ""}
          onChange={(e) => setContactoId(e.target.value)}
          options={contactos.map((o) => ({ value: o.id, label: o.label }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CampoSelect
          id="producto_id"
          label="Producto / servicio"
          placeholder="Sin producto"
          value={productoId ?? ""}
          onChange={(e) => setProductoId(e.target.value)}
          options={productos.map((o) => ({ value: o.id, label: o.label }))}
        />
        <CampoSelect
          id="responsable_id"
          label="Responsable"
          placeholder="Sin asignar"
          value={responsableId ?? ""}
          onChange={(e) => setResponsableId(e.target.value)}
          options={perfiles.map((o) => ({ value: o.id, label: o.label }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CampoSelect
          id="etapa_id"
          label="Etapa *"
          required
          value={etapaId ?? ""}
          onChange={(e) => setEtapaId(e.target.value)}
          options={etapas.map((o) => ({ value: o.id, label: o.label }))}
        />
        <Campo id="monto" label="Monto estimado" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
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
