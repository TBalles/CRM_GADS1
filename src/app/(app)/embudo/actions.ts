"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cambiarEtapa(oportunidadId: string, etapaId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("oportunidades")
    .update({ etapa_id: etapaId })
    .eq("id", oportunidadId);

  if (error) {
    throw new Error("No se pudo cambiar la etapa de la oportunidad.");
  }

  revalidatePath("/embudo");
  revalidatePath("/oportunidades");
  revalidatePath(`/oportunidades/${oportunidadId}`);
}
