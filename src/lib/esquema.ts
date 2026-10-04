/**
 * Detecta que a la base le falta una tabla o una columna que la app ya conoce.
 *
 * Las migraciones se aplican a mano en el SQL Editor y puede pasar un tiempo entre
 * desplegar la app y aplicar una migracion (hoy: la 0011, del rubro). Mientras tanto
 * las pantallas que leen las tablas nuevas no pueden romperse: la seccion se esconde
 * y listo. Esto reconoce ese caso (y solo ese) para no tragarse errores de verdad.
 *
 *  - PGRST205: PostgREST no encuentra la tabla en su cache de esquema.
 *  - PGRST200: no encuentra la relacion (embed) entre dos tablas.
 *  - PGRST204: no encuentra la columna que se quiso escribir.
 *  - 42P01 / 42703: Postgres, tabla o columna inexistente (al leer o filtrar una columna).
 *
 * Sin imports: se prueba con `node --test` (esquema.check.ts).
 */
export function esErrorDeEsquema(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (["PGRST205", "PGRST200", "PGRST204", "42P01", "42703"].includes(code)) return true;
  // Respaldo por texto SOLO si no hay codigo (por si una version de PostgREST lo omite). Con codigo mandan
  // las listas de arriba: por ejemplo 42883 ("function ... does not exist") NO es un esquema sin migrar.
  if (code) return false;
  return /could not find the (table|'[^']+' column)|schema cache|relation .* does not exist/i.test(error.message ?? "");
}
