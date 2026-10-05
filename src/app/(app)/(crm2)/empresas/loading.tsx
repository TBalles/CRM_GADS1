import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";

/**
 * Carga de Empresas con la forma de la pantalla: barra de página, toolbar y la grilla con sus cabeceras reales y filas
 * de esqueleto. `TableSkeleton` trae el `role="status"` "Cargando empresas…" (contrato de §13.2); la tabla, `aria-busy`.
 */
export default function CargandoEmpresas() {
  return (
    <ListSkeleton
      title="Empresas"
      label="Cargando empresas…"
      columns={7}
      chips={["w-20", "w-16", "w-28", "w-20", "w-36"]}
      head={
        <>
          <Th>Empresa</Th>
          <Th width={168} hideBelow="lg">
            Tipo
          </Th>
          <Th width={120} hideBelow="sm">
            Estado
          </Th>
          <Th width={160} hideBelow="sm">
            Responsable
          </Th>
          <Th width={152} hideBelow="lg">
            Origen
          </Th>
          <Th width={88} align="right" hideBelow="md">
            Contactos
          </Th>
          <Th width={72}>
            <span className="sr-only">Acciones</span>
          </Th>
        </>
      }
    />
  );
}
