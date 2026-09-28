/**
 * What kind of equipment a product is, for its icon. Pure, so it can be
 * checked without React (equipo.check.ts).
 *
 * The name decides first (it is the most specific thing we have, and the
 * alerts view carries no category), then the category, then "otro". It only
 * picks an icon: a wrong guess costs nothing, the name is always printed.
 */
export type Equipo =
  | "arco"
  | "red"
  | "pelota"
  | "cono"
  | "pechera"
  | "banderin"
  | "escalera"
  | "valla"
  | "mantenimiento"
  | "otro";

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Order matters: "Red para arco de fútbol 11" is a NET, so nets are checked
// before goals. Word boundaries keep "Redex" (a brand) from reading as "red".
const POR_NOMBRE: [RegExp, Equipo][] = [
  [/\bred(es)?\b/, "red"],
  [/\bpelotas?\b/, "pelota"],
  [/\bconos?\b/, "cono"],
  [/\b(pecheras?|camisetas?|casacas?)\b/, "pechera"],
  [/\bbanderin(es)?\b/, "banderin"],
  [/\bescaleras?\b/, "escalera"],
  [/\bvallas?\b/, "valla"],
  [/\barcos?\b/, "arco"],
];

const POR_CATEGORIA: Record<string, Equipo> = {
  arcos: "arco",
  redes: "red",
  pelotas: "pelota",
  indumentaria: "pechera",
  entrenamiento: "cono",
  accesorios: "banderin",
  mantenimiento: "mantenimiento",
};

export function tipoEquipo(nombre?: string | null, categoria?: string | null): Equipo {
  const n = quitarTildes(nombre ?? "");
  for (const [re, tipo] of POR_NOMBRE) if (re.test(n)) return tipo;
  return POR_CATEGORIA[quitarTildes(categoria ?? "")] ?? "otro";
}
