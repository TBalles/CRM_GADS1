import { TableroSkeleton } from "@/components/crm/Skeletons";
import { getSesion } from "@/lib/sesion";

/**
 * Carga del Inicio con la forma de la pantalla: franja de 4 cifras, "Oportunidades por etapa", "Recambios que vienen"
 * (solo con `alertas.ver`, como la pantalla) y "Empresas con más valor en juego". La sesión ya está en `cache`.
 */
export default async function Cargando() {
  const recambios = (await getSesion())?.puede("alertas.ver") ?? false;
  return (
    <TableroSkeleton
      title="Inicio"
      label="Cargando tablero…"
      kpis={4}
      gridClassName="xl:grid-cols-12"
      secciones={
        recambios
          ? [
              { className: "xl:col-span-7", rows: 7 },
              { className: "xl:col-span-5 xl:row-span-2", rows: 4 },
              { className: "xl:col-span-7", rows: 6 },
            ]
          : [
              { className: "xl:col-span-7", rows: 7 },
              { className: "xl:col-span-5", rows: 6 },
            ]
      }
    />
  );
}
