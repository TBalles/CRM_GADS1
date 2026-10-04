import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { leerPaginacion, opcionParam, urlConParams, uuidParam } from "@/lib/paginacion";
import { Button } from "@/components/crm/Button";
import { DefinitionList, Panel } from "@/components/crm/Panel";
import { Avatar, StatusBadge, StatusDot, Tag } from "@/components/crm/Status";
import { EmptyState, InlineBanner, Skeleton } from "@/components/crm/Feedback";
import { CellDate, CellNumber, CellPerson, CellStatus, CellText, DataTable, TBody, THead, Td, Th, Tr } from "@/components/crm/DataTable";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import CrmLab from "./CrmLab";

/** Las tabs de la demo de Tabs por URL (`?tab=`), con los nombres de la ficha de empresa. */
const LAB_TABS = ["resumen", "actividad", "oportunidades", "ventas"] as const;
const ETIQUETAS: Record<(typeof LAB_TABS)[number], string> = {
  resumen: "Resumen",
  actividad: "Actividad",
  oportunidades: "Oportunidades",
  ventas: "Ventas",
};

/**
 * Laboratorio del sistema de diseño CRM 2.0 (Etapa 1). SOLO en desarrollo: en producción es un 404. No está enlazado
 * desde ningún lado y se borra antes de lanzar la 2.0. Es el único consumidor de `components/crm` en esta etapa.
 *
 * Esta página es un server component a propósito: lo que dibuja directamente (Panel, DefinitionList, StatusDot,
 * Tag, Avatar, Skeleton, InlineBanner, EmptyState, Button con ícono y un DataTable con links y tooltips de
 * recorte) demuestra que esos primitivos no necesitan "use client". Lo interactivo está en CrmLab.
 */
const VENTAS = [
  { id: "00000000-0000-4000-8000-000000000101", cliente: "Complejo La Tablada", nota: "Recambio de césped, cancha 2", estado: "Entregada", tono: "success" as const, vendedor: "Lucía Ferreyra", items: 3, total: "12.480.300", fecha: "2026-09-30" },
  { id: "00000000-0000-4000-8000-000000000102", cliente: "Club Social y Deportivo Villa Ortúzar Juniors de la Comuna 15", nota: "Arcos reglamentarios y redes", estado: "Pendiente de entrega", tono: "warning" as const, vendedor: "Martín Ibarra", items: 12, total: "1.920.000", fecha: "2026-10-01" },
  { id: "00000000-0000-4000-8000-000000000103", cliente: "Polideportivo Municipal Merlo", nota: undefined, estado: "Anulada", tono: "danger" as const, vendedor: null, items: 1, total: "86.500", fecha: "2026-10-03" },
];

export const metadata: Metadata = { title: "Laboratorio CRM 2.0", robots: { index: false, follow: false } };

export default async function CrmLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const tab = opcionParam(params.tab, LAB_TABS) || "resumen";
  // Los href los arma el servidor: al cliente le llegan strings (serializables), no funciones.
  const tabs = LAB_TABS.map((v) => ({
    value: v,
    label: ETIQUETAS[v],
    count: v === "oportunidades" ? 3 : v === "ventas" ? 12 : undefined,
    href: urlConParams("/crm-lab", params, { tab: v === "resumen" ? null : v, page: null }),
  }));
  const { page } = leerPaginacion(params);
  const sel = uuidParam(params.sel);

  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col gap-6 bg-(--crm-canvas) p-4 xl:p-6")}>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className={TYPE.title}>Laboratorio de CRM 2.0</h1>
            <p className="text-(--crm-text-2)">Todos los primitivos de <code>components/crm</code> en todos sus estados, en el tema actual.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button icon={Download} disabled>
              Exportar
            </Button>
            <Button variant="primary" icon={Plus}>
              Nueva empresa
            </Button>
          </div>
        </div>
        <InlineBanner tone="info" title="Página interna de desarrollo">
          Existe solo para revisar el sistema de diseño (design-system/crm-2/MASTER.md). No está enlazada, en producción
          da 404 y se elimina antes de lanzar la 2.0. Para ver el tema oscuro, usá el botón de tema.
        </InlineBanner>
      </header>

      <CrmLab tab={tab} tabs={tabs} page={page} sel={sel} params={params} />

      <section aria-labelledby="lab-servidor" className="flex flex-col gap-3">
        <h2 id="lab-servidor" className={TYPE.section}>
          Dibujado por el servidor
        </h2>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Panel title="Datos de la cuenta" actions={<Button size="sm">Editar</Button>}>
            <DefinitionList
              items={[
                { term: "Razón social", value: "Complejo La Tablada S.R.L." },
                { term: "CUIT", value: "30-71234567-9", mono: true },
                { term: "Estado", value: <StatusDot tone="success">Cliente activo</StatusDot> },
                { term: "Responsable", value: <span className="inline-flex items-center gap-2"><Avatar name="Lucía Ferreyra" size="xs" />Lucía Ferreyra</span> },
                { term: "Teléfono", value: "+54 11 4567-8901", mono: true },
                { term: "Origen", value: <Tag>Licitación</Tag> },
                { term: "Sitio web", value: null },
                { term: "Alta", value: "04/10/2026", mono: true },
              ]}
            />
          </Panel>
          <Panel title="Estados y etiquetas">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <StatusDot tone="neutral">Potencial</StatusDot>
                <StatusDot tone="success">Cliente</StatusDot>
                <StatusDot tone="warning">Por vencer</StatusDot>
                <StatusDot tone="danger">Vencida</StatusDot>
                <StatusDot tone="info">En evaluación</StatusDot>
                <StatusDot color="#7c3aed">Negociación (color de la org.)</StatusDot>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="danger">Vencida hace 12 d</StatusBadge>
                <StatusBadge tone="warning">Vence en 9 d</StatusBadge>
                <StatusBadge tone="success">Ganada</StatusBadge>
                <StatusBadge tone="info">Nueva</StatusBadge>
                <StatusBadge tone="neutral">Sin avisar</StatusBadge>
                <StatusBadge color="#0ea5e9">Propuesta enviada</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag>Club</Tag>
                <Tag>Césped sintético</Tag>
                <Tag>Municipio</Tag>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name="Lucía Ferreyra" size="xs" />
                <Avatar name="Martín Ibarra" size="sm" />
                <Avatar name="Sofía Benítez" size="md" />
              </div>
            </div>
          </Panel>
        </div>
        <DataTable label="Ventas recientes">
          <THead>
            <Th>Cliente</Th>
            <Th width={160}>Estado</Th>
            <Th width={180} hideBelow="md">Vendedor</Th>
            <Th width={96} align="right" hideBelow="sm">Ítems</Th>
            <Th width={160} align="right">Total</Th>
            <Th width={112} hideBelow="lg">Fecha</Th>
          </THead>
          <TBody>
            {VENTAS.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <CellText href={urlConParams("/crm-lab", params, { sel: v.id })} secondary={v.nota}>
                    {v.cliente}
                  </CellText>
                </Td>
                <Td>
                  <CellStatus tone={v.tono}>{v.estado}</CellStatus>
                </Td>
                <Td hideBelow="md">
                  <CellPerson name={v.vendedor} />
                </Td>
                <Td align="right" hideBelow="sm">
                  <CellNumber unit="u.">{v.items}</CellNumber>
                </Td>
                <Td align="right">
                  <CellNumber unit="$" unitPosition="before">
                    {v.total}
                  </CellNumber>
                </Td>
                <Td hideBelow="lg">
                  <CellDate dateTime={v.fecha}>{v.fecha.split("-").reverse().join("/")}</CellDate>
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <InlineBanner tone="danger" title="No se pudo cargar la lista." action={<Button size="sm">Reintentar</Button>}>
              Revisá la conexión y volvé a intentar.
            </InlineBanner>
            <InlineBanner tone="warning" title="Hay 3 alertas sin avisar.">
              Las alertas vencidas se avisan desde Alertas.
            </InlineBanner>
            <InlineBanner tone="success">Los cambios se guardaron.</InlineBanner>
          </div>
          <div className="flex flex-col gap-3 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
            <EmptyState
              title="Todavía no cargaste empresas."
              description="Cargá la primera para empezar a registrar actividad y oportunidades."
              action={
                <Button variant="primary" icon={Plus}>
                  Nueva empresa
                </Button>
              }
            />
            {/* Esqueleto estático de muestra: SIN LoadingStatus, porque un status "Cargando…" que nunca se va rompe el
                contrato de carga (las guardas lo esperan hasta que desaparece). El contrato completo está en la grilla
                (control "Cargando"). */}
            <div aria-hidden="true" className="flex flex-col gap-2 border-t border-(--crm-border) p-3">
              <Skeleton className="w-1/3" />
              <Skeleton className="w-2/3" />
              <Skeleton className="w-1/2" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
