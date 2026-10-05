import { TableroSkeleton } from "@/components/crm/Skeletons";

/** Carga del Tablero comercial con su forma: 5 cifras, pipeline | sin actividad, y los cierres del mes debajo. */
export default function Cargando() {
  return (
    <TableroSkeleton
      title="Tablero comercial"
      label="Cargando el tablero del equipo…"
      kpis={5}
      gridClassName="xl:grid-cols-12"
      secciones={[
        { className: "xl:col-span-5", rows: 3 },
        { className: "xl:col-span-7", rows: 6 },
        { className: "xl:col-span-7", rows: 2 },
        { className: "xl:col-span-5", rows: 2 },
      ]}
    />
  );
}
