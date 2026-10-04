"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_RE, estaDeBaja, mensajeErrorGuardado } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

/**
 * Lógica del alta/edición de un contacto: estado, validación, payload y guardado. Sin UI: la usan el formulario legacy
 * (`(legacy)/contactos/ContactoForm.tsx`) y el drawer de CRM 2.0 (`components/crm/cuenta/ContactoDrawer.tsx`). Cada uno
 * dibuja los campos con sus primitivos y pasa su toast (`notificar`).
 */
type Contacto = Tables<"contactos">;
export type EmpresaOpcion = { id: string; nombre: string; estado: string };
type Errores = Partial<Record<"nombre" | "email", string>>;
type Notificar = (mensaje: string, tipo: "success") => void;

export function useContactoForm({
  contacto,
  empresaId,
  puedeAsignar,
  yoId,
  notificar,
  onSaved,
}: {
  contacto?: Contacto;
  empresaId?: string;
  puedeAsignar: boolean;
  yoId: string;
  notificar: Notificar;
  onSaved: (contacto: Contacto) => void;
}) {
  const [v, setV] = useState({
    nombre: contacto?.nombre ?? "",
    apellido: contacto?.apellido ?? "",
    documento: contacto?.documento ?? "",
    empresaId: contacto?.empresa_id ?? empresaId ?? "",
    cargo: contacto?.cargo ?? "",
    email: contacto?.email ?? "",
    telefono: contacto?.telefono ?? "",
    estado: contacto?.estado ?? "potencial",
    responsableId: contacto ? (contacto.responsable_id ?? "") : yoId,
    origenId: contacto?.origen_id ?? "",
    notas: contacto?.notas ?? "",
  });
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Cambia un campo y borra su error (si tenía). */
  function set(campo: keyof typeof v, valor: string) {
    setV((prev) => ({ ...prev, [campo]: valor }));
    if (campo in errores && errores[campo as keyof Errores]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const nuevos: Errores = {};
    if (!v.nombre.trim()) nuevos.nombre = "El nombre es obligatorio.";
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) nuevos.email = "Ese mail no parece válido.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      nombre: v.nombre.trim(),
      apellido: v.apellido.trim() || null,
      documento: v.documento.trim() || null,
      empresa_id: v.empresaId || null,
      cargo: v.cargo.trim() || null,
      email: v.email.trim() || null,
      telefono: v.telefono.trim() || null,
      estado: v.estado,
      origen_id: v.origenId || null,
      notas: v.notas.trim() || null,
      ...(puedeAsignar ? { responsable_id: v.responsableId || null } : {}),
    };

    const { data, error: dbError } = contacto
      ? await supabase.from("contactos").update(payload).eq("id", contacto.id).select().single()
      : await supabase.from("contactos").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError(mensajeErrorGuardado(dbError, "No se pudo guardar el contacto. Revisá los datos e intentá de nuevo."));
      return;
    }

    notificar(contacto ? "Contacto actualizado." : "Contacto creado.", "success");
    onSaved(data);
  }

  return { v, set, errores, error, saving, submit };
}

/**
 * Opciones del campo "Empresa": las dadas de baja no se ofrecen, salvo la que el contacto ya tiene. La empresa actual
 * puede ser de otra cartera (la RLS no la devuelve): sin esa opción el selector mostraría "Sin empresa" y guardar la
 * desvincularía sin querer.
 */
export function opcionesEmpresa(empresas: readonly EmpresaOpcion[], actual: string) {
  return [
    { value: "", label: "Sin empresa (cliente individual)" },
    ...empresas.filter((emp) => !estaDeBaja(emp.estado) || emp.id === actual).map((emp) => ({ value: emp.id, label: emp.nombre })),
    ...(actual && !empresas.some((emp) => emp.id === actual) ? [{ value: actual, label: "Empresa de otra cartera" }] : []),
  ];
}
