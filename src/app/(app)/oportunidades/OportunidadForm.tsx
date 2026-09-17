"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Campo,
  CampoMoney,
  CampoSelect,
  CampoTextarea,
  CampoGrupo,
  FormActions,
  FormBanner,
} from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import { maskFromNumber, parseMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";

type Oportunidad = Tables<"oportunidades">;
type Opcion = { id: string; label: string; color?: string | null };

export default function OportunidadForm({
  oportunidad,
  empresas,
  contactos,
  productos,
  etapas,
  perfiles,
  onSaved,
  onCancel,
}: {
  oportunidad?: Oportunidad;
  empresas: Opcion[];
  contactos: Opcion[];
  productos: Opcion[];
  etapas: Opcion[];
  perfiles: Opcion[];
  onSaved: (oportunidad: Oportunidad) => void;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState(oportunidad?.titulo ?? "");
  const [empresaId, setEmpresaId] = useState(oportunidad?.empresa_id ?? "");
  const [contactoId, setContactoId] = useState(oportunidad?.contacto_id ?? "");
  const [productoId, setProductoId] = useState(oportunidad?.producto_id ?? "");
  const [responsableId, setResponsableId] = useState(oportunidad?.responsable_id ?? "");
  const [etapaId, setEtapaId] = useState(oportunidad?.etapa_id ?? etapas[0]?.id ?? "");
  // Money is held as the masked string and parsed at submit (golden rule #4).
  const [monto, setMonto] = useState(maskFromNumber(oportunidad?.monto));
  const [notas, setNotas] = useState(oportunidad?.notas ?? "");
  const [tituloError, setTituloError] = useState<string | null>(null);
  const [etapaError, setEtapaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const toOptions = (list: Opcion[]) =>
    list.map((o) => ({ value: o.id, label: o.label, color: o.color }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missingTitulo = !titulo.trim();
    const missingEtapa = !etapaId;
    setTituloError(missingTitulo ? "El título es obligatorio." : null);
    setEtapaError(missingEtapa ? "Elegí una etapa del embudo." : null);
    if (missingTitulo || missingEtapa) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const parsed = parseMoney(monto);
    const payload = {
      titulo: titulo.trim(),
      empresa_id: empresaId || null,
      contacto_id: contactoId || null,
      producto_id: productoId || null,
      responsable_id: responsableId || null,
      etapa_id: etapaId,
      monto: monto.trim() ? parsed : null,
      notas: notas.trim() || null,
    };

    const { data, error: dbError } = oportunidad
      ? await supabase
          .from("oportunidades")
          .update(payload)
          .eq("id", oportunidad.id)
          .select()
          .single()
      : await supabase.from("oportunidades").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar la oportunidad. Revisá los datos e intentá de nuevo.");
      return;
    }

    showToast(oportunidad ? "Oportunidad actualizada." : "Oportunidad creada.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="titulo"
        label="Título"
        required
        autoFocus
        placeholder="Provisión de arcos y redes"
        value={titulo}
        onChange={(v) => {
          setTitulo(v);
          if (tituloError) setTituloError(null);
        }}
        error={tituloError ?? undefined}
      />

      <CampoGrupo title="Estado comercial">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelect
            id="etapa_id"
            label="Etapa"
            required
            value={etapaId}
            onChange={(v) => {
              setEtapaId(v);
              if (etapaError) setEtapaError(null);
            }}
            options={toOptions(etapas)}
            error={etapaError ?? undefined}
          />
          <CampoMoney id="monto" label="Monto estimado" value={monto} onChange={setMonto} />
        </div>
        <CampoSelect
          id="responsable_id"
          label="Responsable"
          placeholder="Sin asignar"
          value={responsableId}
          onChange={setResponsableId}
          options={toOptions(perfiles)}
        />
      </CampoGrupo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="empresa_id"
          label="Empresa"
          placeholder="Sin empresa"
          value={empresaId}
          onChange={setEmpresaId}
          options={toOptions(empresas)}
        />
        <CampoSelect
          id="contacto_id"
          label="Contacto"
          placeholder="Sin contacto"
          value={contactoId}
          onChange={setContactoId}
          options={toOptions(contactos)}
        />
      </div>

      <CampoSelect
        id="producto_id"
        label="Producto / servicio"
        placeholder="Sin producto"
        value={productoId}
        onChange={setProductoId}
        options={toOptions(productos)}
      />

      <CampoTextarea
        id="notas"
        label="Notas"
        placeholder="Detalle del pedido, condiciones, seguimiento…"
        value={notas}
        onChange={setNotas}
      />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
