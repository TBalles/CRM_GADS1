import { PantallaCarga } from "@/components/ui/PantallaCarga";

/**
 * Pantalla de carga al cambiar de modulo (la de respaldo: cada modulo tiene la
 * suya con su propio texto).
 *
 * Sin estos archivos, Next deja la pantalla ANTERIOR congelada hasta que la
 * nueva termina de consultar la base (todas las paginas del CRM leen datos en
 * el servidor). Con ellos la navegacion es instantanea: el menu queda y en el
 * contenido aparece el loader de marca (DESIGN.md §3.12).
 */
export default function Cargando() {
  return <PantallaCarga texto="Cargando…" modulo="Tuco & Nito" />;
}
