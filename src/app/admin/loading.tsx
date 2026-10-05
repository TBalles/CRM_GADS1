import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";

/** Carga del panel de plataforma con la forma de la pantalla y "Cargando clientes…" (el texto de siempre). */
export default function CargandoClientes() {
  return (
    <ListSkeleton
      title="Clientes"
      label="Cargando clientes…"
      columns={5}
      footer={false}
      head={
        <>
          <Th>Cliente</Th>
          <Th hideBelow="md">Administradores</Th>
          <Th width={136} align="right" hideBelow="sm">
            Usuarios activos
          </Th>
          <Th width={128} hideBelow="sm">
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
