/**
 * CUIT argentino: 11 digitos, el ultimo es un digito verificador (modulo 11).
 * Se valida en el formulario de datos de la empresa para no guardar un CUIT que
 * despues sale mal impreso en un presupuesto.
 *
 * Sin imports: este modulo se prueba con `node --test` (cuit.check.ts).
 */

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cuitValido(valor: string): boolean {
  const d = soloDigitos(valor);
  if (d.length !== 11) return false;
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  // 11 -> 0. 10 no se asigna a nadie: el CUIT no existe.
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(d[10]);
}

/** 20123456786 -> 20-12345678-6. Si no son 11 digitos devuelve lo que escribio la persona. */
export function formatearCuit(valor: string): string {
  const d = soloDigitos(valor);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : valor.trim();
}
