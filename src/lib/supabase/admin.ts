import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente con la SERVICE_ROLE key: saltea TODA la RLS y administra Auth
 * (crear usuarios, generar links de acceso, dar de baja).
 *
 * `import "server-only"` hace que el build FALLE si este modulo termina
 * importado desde un Client Component: la clave nunca puede llegar al
 * navegador. Y la variable no lleva el prefijo NEXT_PUBLIC_ por el mismo
 * motivo.
 *
 * Regla de uso: solo DESPUES de verificar en el servidor que quien pide la
 * accion tiene permiso (ver src/lib/sesion.ts). Este cliente no verifica nada:
 * para la base es el dueño de todo.
 *
 * Devuelve null si falta la variable, para que cada pantalla muestre un
 * mensaje claro en vez de romperse.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SIN_SERVICE_ROLE =
  "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Ver el README.";
