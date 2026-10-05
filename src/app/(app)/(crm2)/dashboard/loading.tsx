import { TableroSkeleton } from "@/components/crm/Skeletons";
import { getSesion } from "@/lib/sesion";

/**
 * Carga del Inicio con la forma de la pantalla: franja de 4 cifras (5 con "Recambios vencidos"), "Recambios que vienen" (solo con
 * `alertas.ver`, como la pantalla), "Oportunidades por etapa" y "Empresas con más valor en juego". La sesión ya está en `cache`.
 */
export default async function Cargando() {
  const recambios = (await getSesion())?.puede("alertas.ver") ?? false;
  return (
    <TableroSkeleton
      title="Inicio"
      label="Cargando tablero…"
      kpis={recambios ? 5 : 4}
      gridClassName="xl:grid-cols-12"
      secciones={
        recambios
          ? [
              // Mismo orden que la pantalla: recambios primero (arriba en el celular), a la derecha desde 1280.
              { className: "xl:col-span-5 xl:col-start-8 xl:row-span-2 xl:row-start-1", rows: 4 },
              { className: "xl:col-span-7 xl:col-start-1 xl:row-start-1", rows: 7 },
              { className: "xl:col-span-7 xl:col-start-1 xl:row-start-2", rows: 6 },
            ]
          : [
              { className: "xl:col-span-7", rows: 7 },
              { className: "xl:col-span-5", rows: 6 },
            ]
      }
    />
  );
}
