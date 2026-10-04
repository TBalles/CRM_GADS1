"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import { mensajeErrorGuardado } from "@/lib/clientes";
import { FORMATOS, SUPERFICIES } from "@/lib/canchas";
import { esErrorDeEsquema } from "@/lib/esquema";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type Cancha = Tables<"canchas">;
type Errores = Partial<Record<"nombre" | "formato" | "cantidad", string>>;

/**
 * Alta y edición de una ficha de cancha (dentro de un Drawer). Una ficha puede
 * representar varias canchas iguales ("Canchas de F5": cantidad 4). La baja es
 * lógica y se hace desde la lista: nada se borra.
 */
export default function CanchaForm({
  cancha,
  empresaId,
  onSaved,
  onCancel,
}: {
  cancha?: Cancha;
  empresaId: string;
  onSaved: (cancha: Cancha) => void;
  onCancel: () => void;
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
  const { showToast } = useToast();

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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="cancha_nombre"
        label="Nombre"
        required
        autoFocus
        placeholder="Canchas de fútbol 5"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          limpiar("nombre");
        }}
        error={errores.nombre}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
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
        <Campo
          id="cancha_cantidad"
          label="Cantidad de canchas"
          required
          inputMode="numeric"
          placeholder="1"
          value={cantidad}
          onChange={(v) => {
            setCantidad(v);
            limpiar("cantidad");
          }}
          error={errores.cantidad}
        />
      </div>

      <CampoSelect
        id="cancha_superficie"
        label="Superficie"
        placeholder="Sin dato"
        value={superficie}
        onChange={setSuperficie}
        options={[{ value: "", label: "Sin dato" }, ...SUPERFICIES.map((s) => ({ value: s.value, label: s.label }))]}
      />

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent",
          iluminacion && "bg-secondary",
        )}
      >
        <input type="checkbox" checked={iluminacion} onChange={(e) => setIluminacion(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
            iluminacion ? "border-brand bg-brand text-brand-foreground" : "border-input bg-background",
          )}
        >
          {iluminacion && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Tiene iluminación</span>
          <span className="block text-xs text-muted-foreground">Para jugar de noche.</span>
        </span>
      </label>

      <CampoTextarea
        id="cancha_notas"
        label="Observaciones"
        placeholder="Estado de los arcos, medidas especiales, quién las mantiene…"
        value={notas}
        onChange={setNotas}
      />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
