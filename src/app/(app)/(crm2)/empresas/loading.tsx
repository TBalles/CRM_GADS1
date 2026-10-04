import { DataTable, TBody, THead, Th, TableSkeleton } from "@/components/crm/DataTable";
import { Skeleton } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga de Empresas con la forma de la pantalla: barra de página, toolbar y la grilla con sus cabeceras reales y filas
 * de esqueleto. `TableSkeleton` trae el `role="status"` "Cargando empresas…" (contrato de §13.2); la tabla, `aria-busy`.
 */
export default function CargandoEmpresas() {
  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">Empresas</h1>
          <Skeleton className="w-40" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex min-h-10 items-center gap-2 py-1.5">
        <Skeleton className="h-7 w-64" />
        {["w-20", "w-16", "w-28", "w-20", "w-36"].map((w, i) => (
          <Skeleton key={i} className={cn("h-7", w)} />
        ))}
      </div>
      <DataTable label="Empresas" busy className="min-h-0">
        <THead>
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
        </THead>
        <TBody>
          <TableSkeleton rows={10} columns={7} label="Cargando empresas…" />
        </TBody>
      </DataTable>
      <div className="-mx-4 mt-auto h-10 shrink-0 border-t border-(--crm-border) bg-(--crm-panel) xl:-mx-6" />
    </div>
  );
}
