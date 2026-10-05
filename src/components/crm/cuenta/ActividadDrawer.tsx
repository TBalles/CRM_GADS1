"use client";

import { useCrmToast } from "../Toast";
import { InlineBanner } from "../Feedback";
import { CampoArea, CampoFecha, CampoOpciones, CampoTexto, FormDrawer, Par } from "./FormDrawer";
import { ahoraLocal, useActividadForm, type TipoActividadOpcion } from "@/lib/formularios/actividad";
import type { Tables } from "@/lib/supabase/types";

type Actividad = Tables<"bitacora_entradas">;
type Opcion = { id: string; label: string };

/**
 * "Registrar actividad" en un drawer de CRM 2.0. Misma lógica que `ActividadForm` legacy (`useActividadForm`): mismos
 * campos e ids (`#tipo_actividad_id`, `#ocurrido_en`, `#titulo`…), validaciones y mensajes. `key` por apertura.
 */
export function ActividadDrawer({
  open,
  onClose,
  empresaId = null,
  contactoId = null,
  oportunidadId = null,
  tipos,
  contactos = [],
  oportunidades = [],
  avisoNoContactar = false,
  description,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empresaId?: string | null;
  contactoId?: string | null;
  oportunidadId?: string | null;
  tipos: TipoActividadOpcion[];
  contactos?: Opcion[];
  oportunidades?: Opcion[];
  avisoNoContactar?: boolean;
  description?: string;
  onSaved: (actividad: Actividad) => void;
}) {
  const { showToast } = useCrmToast();
  const { v, set, activos, errores, error, saving, submit } = useActividadForm({
    empresaId,
    contactoId,
    oportunidadId,
    tipos,
    notificar: showToast,
    onSaved,
  });
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Registrar actividad"
      description={description}
      saving={saving}
      error={error}
      submitLabel="Registrar"
      onSubmit={submit}
    >
      {avisoNoContactar && (
        <InlineBanner tone="warning" title="Este cliente está marcado como «No contactar».">
          Podés registrar lo que ya pasó, pero confirmá que corresponde antes de volver a escribirle o llamarlo.
        </InlineBanner>
      )}
      {!activos.length && (
        <InlineBanner tone="danger">No hay tipos de actividad activos. Quien administra el CRM los carga en Configuración.</InlineBanner>
      )}
      <CampoTexto
        id="titulo"
        label="Descripción"
        required
        placeholder="Consultó por recambio de redes"
        value={v.titulo}
        onChange={(x) => set("titulo", x)}
        error={errores.titulo}
      />
      <Par>
        <CampoOpciones
          id="tipo_actividad_id"
          label="Tipo"
          required
          searchable={activos.length > 8}
          value={v.tipoId}
          onChange={(x) => set("tipoId", x)}
          options={activos.map((t) => ({ value: t.id, label: t.nombre }))}
          error={errores.tipo}
        />
        <CampoFecha
          id="ocurrido_en"
          label="Cuándo"
          required
          time
          max={ahoraLocal()}
          value={v.ocurridoEn}
          onChange={(x) => set("ocurridoEn", x)}
          error={errores.ocurrido_en}
        />
      </Par>
      {!contactoId && contactos.length > 0 && (
        <CampoOpciones
          id="contacto_id"
          label="Con quién"
          placeholder="Opcional"
          searchable={contactos.length > 8}
          value={v.contacto}
          onChange={(x) => set("contacto", x)}
          options={[{ value: "", label: "Sin contacto puntual" }, ...contactos.map((c) => ({ value: c.id, label: c.label }))]}
        />
      )}
      {!oportunidadId && oportunidades.length > 0 && (
        <CampoOpciones
          id="oportunidad_id"
          label="Oportunidad"
          placeholder="Opcional"
          searchable={oportunidades.length > 8}
          value={v.oportunidad}
          onChange={(x) => set("oportunidad", x)}
          options={[{ value: "", label: "Sin oportunidad" }, ...oportunidades.map((o) => ({ value: o.id, label: o.label }))]}
        />
      )}
      <CampoArea
        id="detalle"
        label="Detalle"
        rows={4}
        placeholder="Lo que se charló, lo que quedó pendiente, observaciones…"
        value={v.detalle}
        onChange={(x) => set("detalle", x)}
      />
      <CampoTexto
        id="resultado"
        label="Resultado"
        placeholder="Pidió presupuesto, no atendió, quedó en confirmar…"
        value={v.resultado}
        onChange={(x) => set("resultado", x)}
      />
    </FormDrawer>
  );
}
