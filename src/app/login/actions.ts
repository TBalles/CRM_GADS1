"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enviarActivacion, estadoCuenta } from "@/lib/cuentas";

function volverAlLogin(params: Record<string, string>): never {
  redirect(`/login?${new URLSearchParams(params).toString()}`);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    volverAlLogin({ error: "Completá email y contraseña.", email });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Cuenta invitada que nunca se activo: no tiene contraseña, asi que el
    // login falla siempre. Se le reenvia la activacion EN SILENCIO.
    //
    // El mensaje es el MISMO para cualquier fallo (no existe, contraseña mal,
    // dado de baja o pendiente). Si el pendiente tuviera un mensaje propio,
    // cualquiera podria escribir emails en este formulario publico y saber
    // cuales tienen una invitacion abierta. La frase es condicional, asi que
    // es verdad en todos los casos.
    //
    // Si no hay SMTP, enviarActivacion devuelve `linkManual`: aca se descarta.
    // Esta pantalla es publica y mostrarlo le daria a cualquiera el link para
    // activar una cuenta ajena.
    const cuenta = await estadoCuenta(email);
    if (cuenta?.pendiente) {
      await enviarActivacion({
        email,
        nombre: cuenta.perfil.nombre,
        organizacionId: cuenta.perfil.organizacion_id,
        reenvio: true,
      });
    }
    volverAlLogin({
      error:
        "Email o contraseña incorrectos. Si tu cuenta todavía no está activada, te mandamos el link de activación a tu correo.",
      email,
    });
  }

  redirect("/dashboard");
}
