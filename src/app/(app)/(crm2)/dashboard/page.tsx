import Link from "next/link";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { CellBar, CellNumber, DataTable, TBody, TFoot, THead, Td, Th, Tr } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { PageBar, SectionBar } from "@/components/crm/PageBar";
import { StatStrip } from "@/components/crm/StatStrip";
import { StatusBadge, StatusDot } from "@/components/crm/Status";
import { porcentajeDe } from "@/components/crm/barra";
import { buttonClass } from "@/components/crm/Button";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { textoVencimiento } from "../alertas/logica";

/**
 * Inicio (MASTER.md §10.21). Mismas lecturas, permisos y cuentas que el tablero legacy; cambia la presentación: sin el
 * marcador sobre la cancha ni la tarjeta "De la venta al recambio". Una franja de cifras y tablas (la barra repite el
 * número de su fila).
 */

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);

/** Cifra de dinero de una tabla: "$" en gris + la cifra exacta en mono; sin valor, "—". */
function Monto({ valor }: { valor: number }) {
  if (!valor) return <span className="text-(--crm-text-2)">—</span>;
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

export default async function DashboardPage() {
  const sesion = await exigirPermiso("tablero.ver");
  const supabase = await createClient();
  // Los recambios solo se muestran a quien puede ver Alertas. La vista igual
  // lo filtra por RLS; esto evita pedirla y dibujar una sección vacía.
  const verRecambios = sesion.puede("alertas.ver");

  const [
    { count: empresasCount },
    { count: contactosCount },
    { data: etapas },
    { data: oportunidades },
    { data: alertas, error: errorAlertas },
  ] = await Promise.all([
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase.from("contactos").select("*", { count: "exact", head: true }),
    supabase.from("etapas").select("id, nombre, orden, color").order("orden"),
    supabase.from("oportunidades").select("id, monto, estado, etapa_id, empresa:empresas(id, nombre)"),
    verRecambios
      ? supabase
          .from("alertas_vida_util")
          .select("venta_item_id, producto_nombre, empresa_nombre, estado, dias_restantes")
          .order("dias_restantes", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Si la vista falla, la sección no se dibuja: mostrar "Todo el equipamiento está al día" sobre un error sería
  // afirmar algo que no sabemos.
  const mostrarRecambios = verRecambios && !errorAlertas;
  const recambios = alertas ?? [];
  const vencidos = recambios.filter((a) => a.estado === "vencido").length;

  const items = oportunidades ?? [];
  const stages = etapas ?? [];
  // "En juego" y "abiertas" cuentan SOLO las abiertas: una ganada o una perdida ya no está en juego. La tabla por
  // etapa sí las muestra (cada una en su etapa).
  const abiertas = items.filter((o) => o.estado === "abierta");
  const totalPipeline = abiertas.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);

  // Una fila por etapa, en su orden, con cantidad, parte del total y valor (todas las oportunidades, como antes).
  const porEtapa = stages.map((etapa) => {
    const deLaEtapa = items.filter((o) => o.etapa_id === etapa.id);
    return {
      id: etapa.id,
      nombre: etapa.nombre,
      color: etapa.color,
      cantidad: deLaEtapa.length,
      monto: deLaEtapa.reduce((acc, o) => acc + (Number(o.monto) || 0), 0),
    };
  });
  const maxEtapa = Math.max(0, ...porEtapa.map((e) => e.cantidad));

  // Las empresas con más valor en juego (abiertas), las 6 primeras. Sin empresa no entra al ranking: "Sin empresa
  // asignada" no es un cliente. Igual cuenta en la cifra de arriba.
  const porEmpresa = new Map<string, { nombre: string; monto: number; cantidad: number }>();
  for (const o of abiertas) {
    if (!o.empresa) continue;
    const prev = porEmpresa.get(o.empresa.id) ?? { nombre: o.empresa.nombre, monto: 0, cantidad: 0 };
    porEmpresa.set(o.empresa.id, { nombre: prev.nombre, monto: prev.monto + (Number(o.monto) || 0), cantidad: prev.cantidad + 1 });
  }
  const topEmpresas = [...porEmpresa.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.monto - a.monto || b.cantidad - a.cantidad)
    .slice(0, 6);
  const maxEmpresa = Math.max(0, ...topEmpresas.map((e) => e.monto));

  return (
    <div className={cn(UI_ROOT, "min-h-full bg-(--crm-canvas) px-4 pb-6 xl:px-6")}>
      <PageBar title="Inicio" />
      <div className="flex flex-col gap-6 pt-2">
        <StatStrip
          size="lg"
          label="Resumen comercial"
          items={[
            {
              label: "En juego",
              value: formatMoneyCompact(totalPipeline).replace(/^\$/, ""),
              unit: "$",
              unitPosition: "before",
              detail: <span className="tabular-nums">{formatMoney(totalPipeline)}</span>,
            },
            { label: "Empresas", value: empresasCount ?? 0, href: "/empresas" },
            // ponytail: "Contactos" lleva a /empresas como en el Inicio legacy. Es un bug conocido que se corrige aparte
            // (decisión del Lote E: no se arregla dentro del rediseño); el destino correcto sería /contactos.
            { label: "Contactos", value: contactosCount ?? 0, href: "/empresas" },
            { label: "Oportunidades abiertas", value: abiertas.length, href: "/oportunidades" },
          ]}
        />

        <div className="grid items-start gap-6 xl:grid-cols-12">
          <section className="flex min-w-0 flex-col xl:col-span-7">
            <SectionBar title="Oportunidades por etapa" />
            {items.length ? (
              <DataTable label="Oportunidades por etapa">
                <THead>
                  <Th>Etapa</Th>
                  <Th hideBelow="sm" className="w-[22%]">
                    <span className="sr-only">Distribución</span>
                  </Th>
                  <Th width={88} align="right">
                    Cantidad
                  </Th>
                  <Th width={80} align="right" hideBelow="sm">
                    Del total
                  </Th>
                  <Th width={128} align="right">
                    Valor
                  </Th>
                </THead>
                <TBody>
                  {porEtapa.map((e) => (
                    <Tr key={e.id}>
                      <Td className="py-1.5">
                        <StatusDot wrap color={e.color}>
                          {e.nombre}
                        </StatusDot>
                        <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[30rem]:hidden")}>
                          {porcentajeDe(e.cantidad, items.length)}% del total
                        </span>
                      </Td>
                      <Td hideBelow="sm">
                        <CellBar value={e.cantidad} max={maxEtapa} />
                      </Td>
                      <Td align="right">
                        <CellNumber>{e.cantidad}</CellNumber>
                      </Td>
                      <Td align="right" hideBelow="sm">
                        <CellNumber unit="%">{porcentajeDe(e.cantidad, items.length)}</CellNumber>
                      </Td>
                      <Td align="right">
                        <Monto valor={e.monto} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
                <TFoot>
                  <Td>Total</Td>
                  <Td hideBelow="sm" />
                  <Td align="right">
                    <CellNumber>{items.length}</CellNumber>
                  </Td>
                  <Td align="right" hideBelow="sm">
                    <CellNumber unit="%">100</CellNumber>
                  </Td>
                  <Td />
                </TFoot>
              </DataTable>
            ) : (
              <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
                <EmptyState
                  compact
                  title="El embudo está vacío"
                  description="Cuando cargues la primera consulta, acá se ve en qué etapa está."
                  action={
                    <Link href="/oportunidades" className={buttonClass({ size: "sm" })}>
                      Ir a Oportunidades
                    </Link>
                  }
                />
              </div>
            )}
          </section>

          {mostrarRecambios && (
            <section className="flex min-w-0 flex-col xl:col-span-5 xl:row-span-2">
              <SectionBar
                title="Recambios que vienen"
                count={recambios.length}
                actions={
                  <Link href="/alertas" className={cn(TYPE.table, LINK)}>
                    Ver alertas
                  </Link>
                }
              />
              {recambios.length ? (
                <>
                  <DataTable label="Recambios que vienen">
                    <THead>
                      <Th>Equipo y cliente</Th>
                      <Th width={140}>Vencimiento</Th>
                    </THead>
                    <TBody>
                      {recambios.slice(0, 4).map((a) => {
                        const vencido = a.estado === "vencido";
                        const texto = textoVencimiento(a.dias_restantes ?? 0, vencido);
                        return (
                          <Tr key={a.venta_item_id}>
                            <Td className="whitespace-normal py-1.5">
                              <span className="flex items-start gap-2">
                                <IconoEquipoSimple nombre={a.producto_nombre} className="mt-px size-4 shrink-0 text-(--crm-text-2)" />
                                <span className="min-w-0">
                                  <span className="block font-medium">{a.producto_nombre}</span>
                                  <span className="block text-(--crm-text-2)">{a.empresa_nombre}</span>
                                </span>
                              </span>
                            </Td>
                            <Td className="align-top py-2">
                              {vencido ? <StatusBadge tone="danger">{texto}</StatusBadge> : <StatusDot tone="warning">{texto}</StatusDot>}
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </DataTable>
                  <p className={cn(TYPE.meta, "mt-2 tabular-nums text-(--crm-text-2)")}>
                    {vencidos} vencidos · {recambios.length - vencidos} por vencer
                  </p>
                </>
              ) : (
                <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
                  <EmptyState compact title="Todo el equipamiento está al día" description="Nada vence en los próximos 60 días." />
                </div>
              )}
            </section>
          )}

          <section className={cn("flex min-w-0 flex-col", mostrarRecambios ? "xl:col-span-7" : "xl:col-span-5")}>
            <SectionBar title="Empresas con más valor en juego" count={topEmpresas.length} />
            {topEmpresas.length ? (
              <DataTable label="Empresas con más valor en juego">
                <THead>
                  <Th>Empresa</Th>
                  <Th hideBelow="sm" className="w-[24%]">
                    <span className="sr-only">Proporción del valor</span>
                  </Th>
                  <Th width={128} align="right">
                    En juego
                  </Th>
                  <Th width={80} align="right">
                    Abiertas
                  </Th>
                </THead>
                <TBody>
                  {topEmpresas.map((e) => (
                    <Tr key={e.id}>
                      <Td className="whitespace-normal py-1.5">{e.nombre}</Td>
                      <Td hideBelow="sm">
                        <CellBar value={e.monto} max={maxEmpresa} />
                      </Td>
                      <Td align="right">
                        <Monto valor={e.monto} />
                      </Td>
                      <Td align="right">
                        <CellNumber>{e.cantidad}</CellNumber>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>
            ) : (
              <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
                <EmptyState
                  compact
                  title="Ninguna oportunidad tiene cliente asignado"
                  description="Asignale una empresa a una oportunidad y aparece acá, ordenada por lo que hay en juego."
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
