import { TableroSkeleton } from "@/components/crm/Skeletons";

/** Carga de la conversión con su forma: toolbar de filtros, 3 cifras y la tabla por etapa. */
export default function Cargando() {
  return <TableroSkeleton title="Conversión del embudo" label="Cargando la conversión…" kpis={3} toolbar secciones={[{ rows: 5 }]} />;
}
