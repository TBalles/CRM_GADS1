import { createClient } from "@/lib/supabase/server";
import { getRemitente } from "@/lib/contacto";
import AlertasView from "./AlertasView";

export const metadata = { title: "Alertas" };

/**
 * Las alertas no se guardan: se calculan. `alertas_vida_util` es una vista que
 * cruza los equipos entregados con su vida util y devuelve los que vencieron o
 * vencen dentro de 60 dias, siempre con los datos de hoy y sin ningun job
 * corriendo de fondo.
 */
export default async function AlertasPage() {
  const supabase = await createClient();
  const { data: alertas } = await supabase
    .from("alertas_vida_util")
    .select("*")
    // Lo mas urgente primero: lo que hace mas tiempo que vencio.
    .order("dias_restantes", { ascending: true });

  // Solo viaja el booleano al cliente, nunca las credenciales.
  return <AlertasView alertas={alertas ?? []} enviaDesdeServidor={getRemitente() !== null} />;
}
