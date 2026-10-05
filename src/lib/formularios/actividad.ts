"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

/**
 * Lógica de "Registrar actividad": estado, validación y alta. Sin UI: la usa el drawer de CRM 2.0
 * (`components/crm/cuenta/ActividadDrawer.tsx`) en las fichas de empresa, contacto y oportunidad.
 *
 * Una actividad es algo que YA pasó con un cliente (llamada, visita, reclamo…), no una tarea. El usuario lo completa la
 * base (trigger `bitacora_defaults`): acá no se manda. No se edita ni se borra después (es un registro).
 */
type Actividad = Tables<"bitacora_entradas">;
export type TipoActividadOpcion = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "activo" | "orden">;
type Errores = Partial<Record<"titulo" | "ocurrido_en" | "tipo", string>>;

/** Un `datetime-local` necesita `aaaa-mm-ddThh:mm` EN HORA LOCAL, no en UTC. */
export function ahoraLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Margen para el reloj de la compu: una actividad es un hecho ya ocurrido, no una agenda. */
const MARGEN_FUTURO_MS = 5 * 60_000;

/** Los tipos activos, en el orden del catálogo. */
export function tiposActivos<T extends TipoActividadOpcion>(tipos: readonly T[]): T[] {
  return tipos.filter((t) => t.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

export function useActividadForm({
  empresaId = null,
  contactoId = null,
  oportunidadId = null,
  tipos,
  notificar,
  onSaved,
}: {
  empresaId?: string | null;
  contactoId?: string | null;
  oportunidadId?: string | null;
  tipos: TipoActividadOpcion[];
  notificar: (mensaje: string, tipo: "success") => void;
  onSaved: (actividad: Actividad) => void;
}) {
  const activos = tiposActivos(tipos);
  const [v, setV] = useState(() => ({
    tipoId: activos[0]?.id ?? "",
    ocurridoEn: ahoraLocal(),
    titulo: "",
    detalle: "",
    resultado: "",
    contacto: "",
    oportunidad: "",
  }));
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ERROR_DE: Partial<Record<keyof typeof v, keyof Errores>> = { tipoId: "tipo", ocurridoEn: "ocurrido_en", titulo: "titulo" };

  /** Cambia un campo y borra su error (si tenía). */
  function set(campo: keyof typeof v, valor: string) {
    setV((prev) => ({ ...prev, [campo]: valor }));
    const clave = ERROR_DE[campo];
    if (clave && errores[clave]) setErrores((prev) => ({ ...prev, [clave]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const nuevos: Errores = {};
    if (!v.tipoId) nuevos.tipo = "Elegí el tipo de actividad.";
    if (!v.titulo.trim()) nuevos.titulo = "Escribí de qué se trató.";
    const cuando = new Date(v.ocurridoEn);
    if (!v.ocurridoEn || Number.isNaN(cuando.getTime())) {
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
        contacto_id: contactoId ?? (v.contacto || null),
        oportunidad_id: oportunidadId ?? (v.oportunidad || null),
        tipo_actividad_id: v.tipoId,
        titulo: v.titulo.trim(),
        detalle: v.detalle.trim() || null,
        resultado: v.resultado.trim() || null,
        // El input entrega hora local; toISOString la manda en UTC, que es lo que espera una columna timestamptz.
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
          ? oportunidadId || v.oportunidad
            ? "No se pudo registrar: esa oportunidad pertenece a otra empresa, o el cliente ya no está en tu cartera."
            : "No pudimos registrar la actividad: tu rol no puede escribir acá, o el cliente ya no es tuyo."
          : "No se pudo registrar la actividad. Revisá los datos e intentá de nuevo.",
      );
      return;
    }

    notificar("Actividad registrada.", "success");
    onSaved(data);
  }

  return { v, set, activos, errores, error, saving, submit };
}
