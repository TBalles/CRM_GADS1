import { DataTable, TBody, THead, Td, Th, Tr, CellDate, CellNumber } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { SectionBar } from "@/components/crm/PageBar";
import { StatusBadge, StatusDot, type Tone } from "@/components/crm/Status";
import { TYPE, cn } from "@/components/crm/cx";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { formatFecha } from "@/lib/clientes";
import { textoVidaUtil, type EstadoParque, type GrupoParque } from "@/lib/parque";

const TONO: Record<EstadoParque, Tone> = { vencido: "danger", por_vencer: "warning", vigente: "success", sin_seguimiento: "neutral" };

/**
 * Parque instalado: lo que la empresa nos compró, con la vida útil que le queda a cada equipo, agrupado por urgencia
 * (`agruparParque`, la misma cuenta que la vista `alertas_vida_util`). En CRM 2.0 es una tabla: una fila por equipo, el
 * grupo como separador y la vida útil en palabras (lo vencido como badge: es lo que tiene que saltar). Sin "use client".
 */
export function ParqueInstalado({ grupos, truncado }: { grupos: GrupoParque[]; truncado: boolean }) {
  const unidades = grupos.reduce((acc, g) => acc + g.unidades, 0);
  const vencidas = grupos.find((g) => g.estado === "vencido")?.unidades ?? 0;
  const porVencer = grupos.find((g) => g.estado === "por_vencer")?.unidades ?? 0;

  return (
    <section className="flex min-w-0 flex-col">
      <SectionBar
        title="Parque instalado"
        count={unidades}
        actions={
          (vencidas > 0 || porVencer > 0) && (
            <span className={cn(TYPE.meta, "flex items-center gap-3")}>
              {vencidas > 0 && <StatusDot tone="danger">{vencidas} para recambiar ya</StatusDot>}
              {porVencer > 0 && <StatusDot tone="warning">{porVencer} por vencer</StatusDot>}
            </span>
          )
        }
      />
      <DataTable label="Parque instalado">
        <THead>
          <Th>Equipo</Th>
          <Th width={56} align="right">
            Cant.
          </Th>
          <Th width={104} hideBelow="sm">
            Entregado
          </Th>
          <Th width={104} hideBelow="md">
            Vence
          </Th>
          <Th width={176}>Vida útil</Th>
        </THead>
        <TBody>
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-0">
                <EmptyState
                  compact
                  title="Todavía no hay equipamiento instalado."
                  description="Cuando cargues una venta con entrega, acá se ve lo que tiene este cliente y cuándo le toca el recambio."
                />
              </td>
            </tr>
          ) : (
            grupos.map((g) => [
              <tr key={`g-${g.estado}`}>
                <th
                  colSpan={5}
                  scope="colgroup"
                  className={cn(TYPE.th, "h-7 border-b border-(--crm-border) bg-(--crm-panel-2) px-3 text-left")}
                >
                  {g.titulo} <span className={TYPE.mono}>· {g.unidades}</span>
                </th>
              </tr>,
              ...g.filas.map((f) => (
                <Tr key={f.id}>
                  <Td>
                    <span className="flex min-w-0 items-center gap-2">
                      <IconoEquipoSimple nombre={f.producto} categoria={f.categoria} className="size-4 text-(--crm-text-2)" />
                      <span className="truncate">{f.producto}</span>
                      {f.vidaUtilMeses ? (
                        <span className="hidden shrink-[2] truncate text-(--crm-text-2) @[45rem]:inline">vida útil {f.vidaUtilMeses} meses</span>
                      ) : null}
                    </span>
                  </Td>
                  <Td align="right">
                    <CellNumber>{f.cantidad}</CellNumber>
                  </Td>
                  <Td hideBelow="sm">{f.fechaEntrega ? <CellDate dateTime={f.fechaEntrega}>{formatFecha(f.fechaEntrega)}</CellDate> : "—"}</Td>
                  <Td hideBelow="md">{f.venceEl ? <CellDate dateTime={f.venceEl}>{formatFecha(f.venceEl)}</CellDate> : "—"}</Td>
                  <Td>
                    {f.estado === "vencido" ? (
                      <StatusBadge tone="danger">{textoVidaUtil(f)}</StatusBadge>
                    ) : (
                      <StatusDot tone={TONO[f.estado]}>{textoVidaUtil(f)}</StatusDot>
                    )}
                  </Td>
                </Tr>
              )),
            ])
          )}
        </TBody>
      </DataTable>
      {truncado && (
        <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>
          Se leyeron los 1000 equipos entregados más recientes: el parque puede estar incompleto.
        </p>
      )}
    </section>
  );
}
