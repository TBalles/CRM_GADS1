"use server";

import { pedirRecuperacion } from "@/lib/cuentas";

export type EstadoRecuperar = { enviado?: boolean; error?: string };

/**
 * La respuesta es SIEMPRE la misma, exista o no la cuenta: si fuera distinta,
 * esta pantalla publica serviria para averiguar que emails estan registrados.
 * Lo que efectivamente se manda (recuperacion, activacion o nada) lo decide
 * pedirRecuperacion() sin que el que pide se entere.
 */
export async function recuperar(_prev: EstadoRecuperar, formData: FormData): Promise<EstadoRecuperar> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ingresá un email válido." };

  await pedirRecuperacion(email);
  return { enviado: true };
}
