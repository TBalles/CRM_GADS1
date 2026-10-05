"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Checkbox } from "@/components/crm/Field";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoArea, CampoOpciones, CampoTexto, FormDrawer, Par } from "@/components/crm/cuenta/FormDrawer";
import { mensajeErrorGuardado } from "@/lib/clientes";
import { FORMATOS, SUPERFICIES } from "@/lib/canchas";
import { esErrorDeEsquema } from "@/lib/esquema";
import type { Tables } from "@/lib/supabase/types";
import { sinTrabarse } from "@/lib/guardar";

type Cancha = Tables<"canchas">;
type Errores = Partial<Record<"nombre" | "formato" | "cantidad", string>>;

/**
 * "Nueva cancha" / "Editar cancha" (drawer de CRM 2.0). Una ficha puede representar varias canchas iguales ("Canchas
 * de F5": cantidad 4). La baja es lógica y se hace desde la lista: nada se borra. Única implementación (solo la usa la
 * ficha de empresa); validación, payload y mensajes de siempre. `key` por apertura.
 */
export default function CanchaForm({
  open,
  onClose,
  cancha,
  empresaId,
  empresaNombre,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  cancha?: Cancha;
  empresaId: string;
  empresaNombre: string;
  onSaved: (cancha: Cancha) => void;
}) {
  const [nombre, setNombre] = useState(cancha?.nombre ?? "");
  const [formato, setFormato] = useState(cancha?.formato ?? "");
  const [superficie, setSuperficie] = useState(cancha?.superficie ?? "");
  const [cantidad, setCantidad] = useState(String(cancha?.cantidad ?? 1));
  const [iluminacion, setIluminacion] = useState(cancha?.iluminacion ?? false);
  const [notas, setNotas] = useState(cancha?.notas ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useCrmToast();

  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = "Poné un nombre: «Cancha 1», «Canchas de F5»…";
    if (!formato) nuevos.formato = "Elegí el formato: de eso salen las medidas de los arcos.";
    const n = Number(cantidad.trim());
    if (!/^\d{1,3}$/.test(cantidad.trim()) || n < 1) nuevos.cantidad = "Es un número entero de 1 en adelante.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const payload = {
      nombre: nombre.trim(),
      formato,
      superficie: superficie || null,
      cantidad: n,
      iluminacion,
      notas: notas.trim() || null,
    };
    const supabase = createClient();
    const { data, error: dbError } = cancha
      ? await supabase.from("canchas").update(payload).eq("id", cancha.id).select().single()
      : await supabase.from("canchas").insert({ ...payload, empresa_id: empresaId }).select().single();
    setSaving(false);

    if (dbError || !data) {
      setError(
        esErrorDeEsquema(dbError)
          ? "La ficha de canchas todavía no está activa en la base. Pedile a quien administra el sistema que aplique la migración 0011."
          : mensajeErrorGuardado(dbError, "No se pudo guardar la cancha. Revisá los datos e intentá de nuevo."),
      );
      return;
    }
    showToast(cancha ? "Cancha actualizada." : "Cancha agregada.", "success");
    onSaved(data);
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={cancha ? "Editar cancha" : "Nueva cancha"}
      description={empresaNombre}
      saving={saving}
      error={error}
      onSubmit={(e) => void sinTrabarse(() => handleSubmit(e), (m) => {
        setSaving(false);
        setError(m);
      })}
    >
      <CampoTexto
        id="cancha_nombre"
        label="Nombre"
        required
        placeholder="Canchas de fútbol 5"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          limpiar("nombre");
        }}
        error={errores.nombre}
      />
      <Par>
        <CampoOpciones
          id="cancha_formato"
          label="Formato"
          required
          placeholder="Elegí el formato"
          value={formato}
          onChange={(v) => {
            setFormato(v);
            limpiar("formato");
          }}
          options={FORMATOS.map((f) => ({ value: f.value, label: f.label }))}
          error={errores.formato}
        />
        <CampoTexto
          id="cancha_cantidad"
          label="Cantidad de canchas"
          required
          inputMode="numeric"
          placeholder="1"
          className="[&_input]:font-(family-name:--crm-font-mono)"
          value={cantidad}
          onChange={(v) => {
            setCantidad(v);
            limpiar("cantidad");
          }}
          error={errores.cantidad}
        />
      </Par>
      <CampoOpciones
        id="cancha_superficie"
        label="Superficie"
        placeholder="Sin dato"
        value={superficie}
        onChange={setSuperficie}
        options={[{ value: "", label: "Sin dato" }, ...SUPERFICIES.map((s) => ({ value: s.value, label: s.label }))]}
      />
      <Checkbox
        id="cancha_iluminacion"
        label="Tiene iluminación"
        description="Para jugar de noche."
        checked={iluminacion}
        onChange={(e) => setIluminacion(e.target.checked)}
      />
      <CampoArea
        id="cancha_notas"
        label="Observaciones"
        placeholder="Estado de los arcos, medidas especiales, quién las mantiene…"
        value={notas}
        onChange={setNotas}
      />
    </FormDrawer>
  );
}
