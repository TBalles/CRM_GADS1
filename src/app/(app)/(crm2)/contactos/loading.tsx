import { Th } from "@/components/crm/DataTable";
import { ListSkeleton } from "@/components/crm/Skeletons";

/** Carga de Contactos con la forma de la pantalla (barra, toolbar, grilla con sus cabeceras) y "Cargando contactos…". */
export default function CargandoContactos() {
  return (
    <ListSkeleton
      title="Contactos"
      label="Cargando contactos…"
      columns={5}
      chips={["w-20", "w-20", "w-28", "w-20", "w-24"]}
      head={
        <>
          <Th>Contacto</Th>
          <Th width={184} hideBelow="sm">
            Empresa
          </Th>
          <Th width={120} hideBelow="sm">
            Estado
          </Th>
          <Th width={160} hideBelow="lg">
            Responsable
          </Th>
          <Th width={72}>
            <span className="sr-only">Acciones</span>
          </Th>
        </>
      }
    />
  );
}
