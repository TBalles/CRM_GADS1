import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";

/**
 * Carga de Usuarios con la forma de la pantalla: barra (con su primaria: esta pantalla es solo para
 * `usuarios.gestionar`), las tabs Usuarios / Roles, la toolbar, la grilla de usuarios y "Cargando usuarios…".
 */
export default function CargandoUsuarios() {
  return (
    <ListSkeleton
      title="Usuarios"
      label="Cargando usuarios…"
      columns={5}
      tabs={["w-16", "w-12"]}
      chips={["w-16", "w-20"]}
      head={
        <>
          <Th>Usuario</Th>
          <Th hideBelow="lg">Email</Th>
          <Th width={200} hideBelow="sm">
            Rol
          </Th>
          <Th width={184} hideBelow="md">
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
