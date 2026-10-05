import { Th } from "@/components/crm/DataTable";
import { Skeleton } from "@/components/crm/Feedback";
import { ListSkeleton } from "@/components/crm/Skeletons";
import { getSesion } from "@/lib/sesion";

/**
 * Carga de Alertas con la forma de la pantalla: barra, el segmentado del filtro a la izquierda y la búsqueda a la
 * derecha, la tabla con sus cabeceras y "Cargando alertas…". Sin banda de pie (la lista no pagina). La columna de
 * acciones, solo si el rol puede mandar avisos o crear oportunidades (la sesión ya está en `cache`).
 */
export default async function CargandoAlertas() {
  const sesion = await getSesion();
  const acciones = Boolean(sesion?.puede("alertas.enviar") || sesion?.puede("oportunidades.editar"));
  return (
    <ListSkeleton
      title="Alertas de recambio"
      label="Cargando alertas…"
      columns={acciones ? 5 : 4}
      action={false}
      footer={false}
      toolbar={
        <>
          <Skeleton className="h-7 w-80" />
          <Skeleton className="ml-auto h-7 w-64" />
        </>
      }
      head={
        <>
          <Th>Equipo</Th>
          <Th width={208} hideBelow="md">
            Cliente
          </Th>
          <Th width={160} hideBelow="sm">
            Vencimiento
          </Th>
          <Th width={152} hideBelow="lg">
            Aviso
          </Th>
          {acciones && (
            <Th hideBelow="sm" className="w-[132px] @[45rem]:w-[244px]">
              <span className="sr-only">Acciones</span>
            </Th>
          )}
        </>
      }
    />
  );
}
