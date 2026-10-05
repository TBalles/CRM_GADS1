import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";

/** Carga del catálogo con la forma de la pantalla (barra, toolbar, grilla con sus cabeceras) y "Cargando catálogo…". */
export default function CargandoProductos() {
  return (
    <ListSkeleton
      title="Productos"
      label="Cargando catálogo…"
      columns={6}
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
          <Th width={48}>
            <span className="sr-only">Acciones</span>
          </Th>
        </>
      }
    />
  );
}
