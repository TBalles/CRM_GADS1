"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function crearContacto(formData: FormData) {
  const supabase = await createClient();

  const nombre = str(formData, "nombre");
  if (!nombre) {
    redirect("/contactos/nuevo?error=" + encodeURIComponent("El nombre es obligatorio."));
  }

  const { data, error } = await supabase
    .from("contactos")
    .insert({
      nombre,
      apellido: str(formData, "apellido"),
      empresa_id: str(formData, "empresa_id"),
      email: str(formData, "email"),
      telefono: str(formData, "telefono"),
      cargo: str(formData, "cargo"),
      notas: str(formData, "notas"),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/contactos/nuevo?error=" + encodeURIComponent("No se pudo crear el contacto."));
  }

  revalidatePath("/contactos");
  redirect(`/contactos/${data.id}`);
}

export async function actualizarContacto(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = str(formData, "nombre");
  if (!nombre) {
    redirect(`/contactos/${id}?error=` + encodeURIComponent("El nombre es obligatorio."));
  }

  const { error } = await supabase
    .from("contactos")
    .update({
      nombre,
      apellido: str(formData, "apellido"),
      empresa_id: str(formData, "empresa_id"),
      email: str(formData, "email"),
      telefono: str(formData, "telefono"),
      cargo: str(formData, "cargo"),
      notas: str(formData, "notas"),
    })
    .eq("id", id);

  if (error) {
    redirect(`/contactos/${id}?error=` + encodeURIComponent("No se pudo guardar los cambios."));
  }

  revalidatePath("/contactos");
  revalidatePath(`/contactos/${id}`);
  redirect(`/contactos/${id}?saved=1`);
}
