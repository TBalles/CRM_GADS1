import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";
import { getSesion } from "@/lib/sesion";

/**
 * Carga de Ventas con la forma de la pantalla (barra, toolbar, grilla con sus cabeceras) y "Cargando ventas…". "Nueva
 * venta" solo con `ventas.editar`, como la lista (la sesión ya la leyó el layout en este pedido: `getSesion` está en `cache`).
 */
export default async function CargandoVentas() {
  const editar = (await getSesion())?.puede("ventas.editar") ?? false;
  return (
    <ListSkeleton
      title="Ventas"
      label="Cargando ventas…"
      columns={5}
      action={editar}
      chips={["w-52", "w-44", "w-44"]}
      head={
        <>
          <Th width={112} hideBelow="sm">
            Fecha
          </Th>
          <Th>Cliente</Th>
          <Th width={208} hideBelow="lg">
            Comprobante
          </Th>
          <Th width={168} hideBelow="md">
            Productos
          </Th>
          <Th align="right" className="w-28 @[30rem]:w-[136px]">
            Total
          </Th>
        </>
      }
    />
  );
}
