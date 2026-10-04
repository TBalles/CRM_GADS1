"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import type { Tables } from "@/lib/supabase/types";

type Actividad = Tables<"bitacora_entradas">;
type Opcion = { id: string; label: string };
type Errores = Partial<Record<"titulo" | "ocurrido_en" | "tipo", string>>;

/** Un `datetime-local` necesita `aaaa-mm-ddThh:mm` EN HORA LOCAL, no en UTC. */
function ahoraLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Margen para el reloj de la compu: una actividad es un hecho ya ocurrido, no una agenda. */
const MARGEN_FUTURO_MS = 5 * 60_000;

/**
 * Registrar una actividad: algo que YA pasó con un cliente (llamada, visita,
 * reclamo…). No es una tarea ni un recordatorio. Sirve desde la ficha de una
 * empresa, de un contacto y, más adelante, de una oportunidad: quien lo usa
 * decide a qué se cuelga con `empresaId`, `contactoId` y `oportunidadId`.
 *
 * El usuario lo completa la base (trigger `bitacora_defaults`): acá no se manda.
 * La actividad no se edita ni se borra después (es un registro).
 */
export default function ActividadForm({
  empresaId = null,
  contactoId = null,
  oportunidadId = null,
  tipos,
  contactos = [],
  oportunidades = [],
  avisoNoContactar = false,
  onSaved,
  onCancel,
}: {
  empresaId?: string | null;
  contactoId?: string | null;
  oportunidadId?: string | null;
  tipos: Pick<Tables<"tipos_actividad">, "id" | "nombre" | "activo" | "orden">[];
  /** "Con quién": solo se ofrece si la actividad es de una empresa y no trae contacto fijo. */
  contactos?: Opcion[];
  /** Oportunidad opcional a la que vincularla; si ya viene fija (`oportunidadId`) no se ofrece. */
  oportunidades?: Opcion[];
  /** El cliente está marcado como "No contactar": se avisa, no se bloquea. */
  avisoNoContactar?: boolean;
  onSaved: (actividad: Actividad) => void;
  onCancel: () => void;
}) {
  const activos = tipos.filter((t) => t.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  const [tipoId, setTipoId] = useState(activos[0]?.id ?? "");
  const [ocurridoEn, setOcurridoEn] = useState(ahoraLocal);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [resultado, setResultado] = useState("");
  const [contactoElegido, setContactoElegido] = useState("");
  const [oportunidadElegida, setOportunidadElegida] = useState("");
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
    if (!tipoId) nuevos.tipo = "Elegí el tipo de actividad.";
    if (!titulo.trim()) nuevos.titulo = "Escribí de qué se trató.";
    const cuando = new Date(ocurridoEn);
    if (!ocurridoEn || Number.isNaN(cuando.getTime())) {
      nuevos.ocurrido_en = "Indicá cuándo fue.";
    } else if (cuando.getTime() > Date.now() + MARGEN_FUTURO_MS) {
      nuevos.ocurrido_en = "Una actividad es algo que ya pasó: la fecha no puede ser futura.";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);

    const { data, error: dbError } = await createClient()
      .from("bitacora_entradas")
      .insert({
        empresa_id: empresaId,
        contacto_id: contactoId ?? (contactoElegido || null),
        oportunidad_id: oportunidadId ?? (oportunidadElegida || null),
        tipo_actividad_id: tipoId,
        titulo: titulo.trim(),
        detalle: detalle.trim() || null,
        resultado: resultado.trim() || null,
        // El input entrega hora local; toISOString la manda en UTC, que es lo
        // que espera una columna timestamptz.
        ocurrido_en: cuando.toISOString(),
        // `tipo` (columna vieja) no se manda: lo completa el trigger desde el tipo de catálogo.
      })
      .select()
      .single();

    setSaving(false);

    if (dbError || !data) {
      // La RLS no distingue la causa. Con una oportunidad elegida, la sospechosa es que sea de otra empresa.
      setError(
        dbError?.code === "42501"
          ? oportunidadId || oportunidadElegida
            ? "No se pudo registrar: esa oportunidad pertenece a otra empresa, o el cliente ya no está en tu cartera."
            : "No pudimos registrar la actividad: tu rol no puede escribir acá, o el cliente ya no es tuyo."
          : "No se pudo registrar la actividad. Revisá los datos e intentá de nuevo.",
      );
      return;
    }

    showToast("Actividad registrada.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      {avisoNoContactar && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-sm">
          <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <strong>Este cliente está marcado como «No contactar».</strong> Podés registrar lo que ya pasó, pero
            confirmá que corresponde antes de volver a escribirle o llamarlo.
          </span>
        </p>
      )}

      {!activos.length && (
        <FormBanner message="No hay tipos de actividad activos. Quien administra el CRM los carga en Configuración." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="tipo_actividad_id"
          label="Tipo"
          required
          searchable={activos.length > 8}
          value={tipoId}
          onChange={(v) => {
            setTipoId(v);
            limpiar("tipo");
          }}
          options={activos.map((t) => ({ value: t.id, label: t.nombre }))}
          error={errores.tipo}
        />
        <Campo
          id="ocurrido_en"
          label="Cuándo"
          required
          type="datetime-local"
          max={ahoraLocal()}
          value={ocurridoEn}
          onChange={(v) => {
            setOcurridoEn(v);
            limpiar("ocurrido_en");
          }}
          error={errores.ocurrido_en}
        />
      </div>

      <Campo
        id="titulo"
        label="Descripción"
        required
        autoFocus
        placeholder="Consultó por recambio de redes"
        value={titulo}
        onChange={(v) => {
          setTitulo(v);
          limpiar("titulo");
        }}
        error={errores.titulo}
      />

      {!contactoId && contactos.length > 0 && (
        <CampoSelect
          id="contacto_id"
          label="Con quién"
          placeholder="Opcional"
          searchable={contactos.length > 8}
          value={contactoElegido}
          onChange={setContactoElegido}
          options={[{ value: "", label: "Sin contacto puntual" }, ...contactos.map((c) => ({ value: c.id, label: c.label }))]}
        />
      )}

      {!oportunidadId && oportunidades.length > 0 && (
        <CampoSelect
          id="oportunidad_id"
          label="Oportunidad"
          placeholder="Opcional"
          searchable={oportunidades.length > 8}
          value={oportunidadElegida}
          onChange={setOportunidadElegida}
          options={[{ value: "", label: "Sin oportunidad" }, ...oportunidades.map((o) => ({ value: o.id, label: o.label }))]}
        />
      )}

      <CampoTextarea
        id="detalle"
        label="Detalle"
        rows={4}
        placeholder="Lo que se charló, lo que quedó pendiente, observaciones…"
        value={detalle}
        onChange={setDetalle}
      />

      <Campo
        id="resultado"
        label="Resultado"
        placeholder="Pidió presupuesto, no atendió, quedó en confirmar…"
        value={resultado}
        onChange={setResultado}
      />

      <FormActions saving={saving} onCancel={onCancel} submitLabel="Registrar" />
    </form>
  );
}
