"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function crearEmpresa(formData: FormData) {
  const supabase = await createClient();

  const nombre = str(formData, "nombre");
  if (!nombre) {
    redirect("/empresas/nueva?error=" + encodeURIComponent("El nombre es obligatorio."));
  }

  const { data, error } = await supabase
    .from("empresas")
    .insert({
      nombre,
      cuit: str(formData, "cuit"),
      telefono: str(formData, "telefono"),
      email: str(formData, "email"),
      direccion: str(formData, "direccion"),
      notas: str(formData, "notas"),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/empresas/nueva?error=" + encodeURIComponent("No se pudo crear la empresa."));
  }

  revalidatePath("/empresas");
  redirect(`/empresas/${data.id}`);
}

export async function actualizarEmpresa(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = str(formData, "nombre");
  if (!nombre) {
    redirect(`/empresas/${id}?error=` + encodeURIComponent("El nombre es obligatorio."));
  }

  const { error } = await supabase
    .from("empresas")
    .update({
      nombre,
      cuit: str(formData, "cuit"),
      telefono: str(formData, "telefono"),
      email: str(formData, "email"),
      direccion: str(formData, "direccion"),
      notas: str(formData, "notas"),
    })
    .eq("id", id);

  if (error) {
    redirect(`/empresas/${id}?error=` + encodeURIComponent("No se pudo guardar los cambios."));
  }

  revalidatePath("/empresas");
  revalidatePath(`/empresas/${id}`);
  redirect(`/empresas/${id}?saved=1`);
}
