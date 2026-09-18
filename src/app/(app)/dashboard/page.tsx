import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Handshake,
  Layers,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { Card, CardContent, SectionTitle } from "@/components/ui/UIComponents";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { MagnitudeBars, ShareBar, type Row } from "./charts";

export default async function DashboardPage() {
  await exigirPermiso("tablero.ver");
  const supabase = await createClient();

  const [{ count: empresasCount }, { count: contactosCount }, { data: etapas }, { data: oportunidades }] =
    await Promise.all([
      supabase.from("empresas").select("*", { count: "exact", head: true }),
      supabase.from("contactos").select("*", { count: "exact", head: true }),
      supabase.from("etapas").select("id, nombre, orden, color").order("orden"),
      supabase
        .from("oportunidades")
        .select("id, monto, etapa_id, empresa:empresas(id, nombre)"),
    ]);

  const items = oportunidades ?? [];
  const stages = etapas ?? [];
  const totalPipeline = items.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);

  // Funnel: one row per stage, in stage order, with its count and amount.
  const porEtapa: Row[] = stages.map((etapa) => {
    const ofStage = items.filter((o) => o.etapa_id === etapa.id);
    const monto = ofStage.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
    return {
      key: etapa.id,
      label: etapa.nombre,
      value: ofStage.length,
      detail: monto ? formatMoneyCompact(monto) : undefined,
      color: etapa.color,
    };
  });

  // Ranking: the companies carrying the most pipeline value. Magnitude, so a
  // single hue and top-6 to keep the list readable.
  const porEmpresa = new Map<string, { label: string; monto: number; count: number }>();
  for (const o of items) {
    const key = o.empresa?.id ?? "__none__";
    const label = o.empresa?.nombre ?? "Sin empresa asignada";
    const prev = porEmpresa.get(key) ?? { label, monto: 0, count: 0 };
    porEmpresa.set(key, {
      label,
      monto: prev.monto + (Number(o.monto) || 0),
      count: prev.count + 1,
    });
  }
  const topEmpresas: Row[] = [...porEmpresa.entries()]
    .map(([key, v]) => ({ key, label: v.label, value: v.count, detail: formatMoneyCompact(v.monto), monto: v.monto }))
    .sort((a, b) => b.monto - a.monto || b.value - a.value)
    .slice(0, 6);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* HEADER — hidden on mobile: the module name lives in the mobile header */}
      <div className="hidden shrink-0 md:block">
        <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen general del CRM: cartera, embudo comercial y valor en juego.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Building2}
          label="Empresas"
          value={empresasCount ?? 0}
          sub={
            <Link href="/empresas" className="inline-flex items-center gap-1 hover:text-foreground">
              Ver cartera <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <KpiCard
          icon={Users}
          label="Contactos"
          value={contactosCount ?? 0}
          sub={
            <Link href="/empresas" className="inline-flex items-center gap-1 hover:text-foreground">
              Ver contactos <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <KpiCard
          icon={Handshake}
          label="Oportunidades"
          value={items.length}
          sub={
            <Link
              href="/oportunidades"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Ver embudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <KpiCard
          icon={CircleDollarSign}
          label="Valor del embudo"
          value={formatMoneyCompact(totalPipeline)}
          accent
          sub={<span className="tabular-nums">{formatMoney(totalPipeline)}</span>}
        />
      </div>

      {/* Distribución del embudo (part-to-whole) */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle icon={Layers} right={
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {items.length} en total
            </span>
          }>
            Distribución del embudo
          </SectionTitle>
          <ShareBar
            rows={porEtapa}
            total={items.length}
            emptyText="Todavía no hay oportunidades para distribuir."
          />
        </CardContent>
      </Card>

      {/* Dos rankings de magnitud, lado a lado en desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <SectionTitle icon={Trophy}>Oportunidades por etapa</SectionTitle>
            <MagnitudeBars
              rows={porEtapa}
              emptyText="Todavía no hay oportunidades registradas."
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <SectionTitle icon={Building2}>Empresas con más valor en juego</SectionTitle>
            {topEmpresas.length ? (
              <MagnitudeBars rows={topEmpresas} />
            ) : (
              <EmptyState
                compact
                icon={Building2}
                text="Sin oportunidades asociadas a empresas"
                hint="Creá una oportunidad y asignale una empresa para verla acá."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Onboarding de la demo */}
      <Card className="border-brand/20 bg-brand/[0.04]">
        <CardContent className="p-5">
          <SectionTitle icon={Sparkles}>Próximos pasos</SectionTitle>
          <ol className="space-y-2.5">
            {[
              <>
                Registrá una empresa en{" "}
                <Link href="/empresas" className="font-medium text-brand hover:underline">
                  Empresas
                </Link>{" "}
                y, desplegándola, cargale un contacto.
              </>,
              <>
                Creá una oportunidad en{" "}
                <Link href="/oportunidades" className="font-medium text-brand hover:underline">
                  Oportunidades
                </Link>
                , con responsable y producto asignados.
              </>,
              <>Visualizala en el embudo y cambiala de etapa desde la tarjeta.</>,
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                  {i + 1}
                </span>
                <span className="min-w-0">{text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
