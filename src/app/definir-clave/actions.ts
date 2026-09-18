"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoClave = { error?: string };

const MINIMO = 8;

/**
 * Define la contraseña de quien llego desde el link del mail (activacion o
 * recuperacion). La sesion la abrio /auth/confirm al canjear el token, asi que
 * aca no se pide la contraseña anterior: el link YA probo que la persona es
 * dueña del email.
 */
export async function definirClave(_prev: EstadoClave, formData: FormData): Promise<EstadoClave> {
  const clave = String(formData.get("clave") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  if (clave.length < MINIMO) return { error: `La contraseña tiene que tener al menos ${MINIMO} caracteres.` };
  if (clave !== repetida) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El link venció. Pedí uno nuevo desde la pantalla de ingreso." };

  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    // Supabase rechaza reusar la misma contraseña y las muy debiles.
    return {
      error:
        error.code === "same_password"
          ? "Esa ya es tu contraseña actual. Elegí una distinta."
          : error.code === "weak_password"
            ? "La contraseña es demasiado débil. Probá con una más larga o combinando letras y números."
            : "No se pudo guardar la contraseña. Probá de nuevo.",
    };
  }

  // La cuenta queda activada: tiene contraseña. Se marca con el cliente admin
  // porque perfiles no tiene politica de update (nadie toca su propio perfil),
  // y se confirma el email en Auth por si el link no lo hizo.
  const admin = createAdminClient();
  if (admin) {
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    await admin
      .from("perfiles")
      .update({ activado_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("activado_at", null);
  }

  redirect("/dashboard");
}
