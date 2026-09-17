"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(formData: FormData, key: string) {
  const value = str(formData, key);
  return value ? Number(value) : null;
}

export async function crearOportunidad(formData: FormData) {
  const supabase = await createClient();

  const titulo = str(formData, "titulo");
  const etapaId = str(formData, "etapa_id");

  if (!titulo || !etapaId) {
    redirect("/oportunidades/nueva?error=" + encodeURIComponent("Completá el título y la etapa."));
  }

  const { data, error } = await supabase
    .from("oportunidades")
    .insert({
      titulo,
      etapa_id: etapaId,
      empresa_id: str(formData, "empresa_id"),
      contacto_id: str(formData, "contacto_id"),
      producto_id: str(formData, "producto_id"),
      responsable_id: str(formData, "responsable_id"),
      monto: num(formData, "monto"),
      notas: str(formData, "notas"),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/oportunidades/nueva?error=" + encodeURIComponent("No se pudo crear la oportunidad."));
  }

  revalidatePath("/oportunidades");
  revalidatePath("/embudo");
  redirect(`/oportunidades/${data.id}`);
}

export async function actualizarOportunidad(id: string, formData: FormData) {
  const supabase = await createClient();

  const titulo = str(formData, "titulo");
  const etapaId = str(formData, "etapa_id");

  if (!titulo || !etapaId) {
    redirect(`/oportunidades/${id}?error=` + encodeURIComponent("Completá el título y la etapa."));
  }

  const { error } = await supabase
    .from("oportunidades")
    .update({
      titulo,
      etapa_id: etapaId,
      empresa_id: str(formData, "empresa_id"),
      contacto_id: str(formData, "contacto_id"),
      producto_id: str(formData, "producto_id"),
      responsable_id: str(formData, "responsable_id"),
      monto: num(formData, "monto"),
      notas: str(formData, "notas"),
    })
    .eq("id", id);

  if (error) {
    redirect(`/oportunidades/${id}?error=` + encodeURIComponent("No se pudo guardar los cambios."));
  }

  revalidatePath("/oportunidades");
  revalidatePath("/embudo");
  revalidatePath(`/oportunidades/${id}`);
  redirect(`/oportunidades/${id}?saved=1`);
}
