/**
 * Sitio web de la empresa: una URL http(s) o un dominio pelado ("www.club.com.ar").
 * Cualquier otro esquema (javascript:, data:, ftp:…) se rechaza: el valor termina
 * impreso en presupuestos y, mas adelante, puede terminar en un href.
 *
 * Sin imports: este modulo se prueba con `node --test` (sitioweb.check.ts).
 */
export function sitioWebValido(valor: string): boolean {
  const v = valor.trim();
  if (!v || /\s/.test(v)) return false;
  // Con esquema: solo http(s). "javascript:x" no tiene "//", asi que el chequeo
  // es por "algo seguido de :" y no por "://".
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}
