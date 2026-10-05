import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";
import { getSesion } from "@/lib/sesion";

/**
 * Carga del catálogo con la forma de la pantalla (barra, toolbar, grilla con sus cabeceras) y "Cargando catálogo…".
 * La columna de acciones y "Nuevo producto" solo con `productos.editar`, como la lista: así no salta el layout al
 * llegar. La sesión ya la leyó el layout en este mismo pedido (`getSesion` está en `cache`): no es otra consulta.
 */
export default async function CargandoProductos() {
  const editar = (await getSesion())?.puede("productos.editar") ?? false;
  return (
    <ListSkeleton
      title="Productos"
      label="Cargando catálogo…"
      columns={editar ? 6 : 5}
      action={editar}
      chips={["w-24", "w-20"]}
      head={
        <>
          <Th>Producto</Th>
          <Th width={168} hideBelow="md">
            Categoría
          </Th>
          <Th width={128} align="right" hideBelow="sm">
            Precio
          </Th>
          <Th width={152} hideBelow="md">
            Vida útil
          </Th>
          <Th width={112} hideBelow="sm">
            Estado
          </Th>
          {editar && (
            <Th width={48}>
              <span className="sr-only">Acciones</span>
            </Th>
          )}
        </>
      }
    />
  );
}
