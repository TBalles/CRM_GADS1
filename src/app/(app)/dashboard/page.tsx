import Link from "next/link";
import { ArrowUpRight, Building2, Filter, Handshake, Layers, Users } from "lucide-react";
import { GoalMark } from "@/components/Logo";
import { MarcasCancha } from "@/components/Cancha";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { Card, CardContent, SectionTitle } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { MagnitudeBars, ShareBar, type Row } from "./charts";

/**
 * Una metrica de la tira del encabezado. El numero va primero y en
 * monoespaciada; la etiqueta lo acompaña. Es un <Link> entero -- el objetivo
 * tactil es toda la metrica, no un "Ver cartera" de 60px -- y la flecha
 * aparece al apuntarlo para que se lea como navegable sin ensuciar la tira.
 */
function Metrica({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-line focus-visible:ring-offset-4 focus-visible:ring-offset-pitch"
    >
      <Icon className="h-4 w-4 shrink-0 text-white/60 transition-colors group-hover:text-pitch-line" />
      <dd className="font-mono text-xl font-bold tabular-nums leading-none text-white">{value}</dd>
      <dt className="text-sm text-white/75 transition-colors group-hover:text-white">
        {label}
      </dt>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-pitch-line opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

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
    <div className="flex w-full flex-col gap-8">
      {/* ── MASTHEAD ──────────────────────────────────────────────────────
          Antes esto eran cuatro tarjetas de metrica del mismo tamaño en una
          fila. Es el patron mas reconocible de dashboard generado, y tiene un
          problema real antes que estetico: si todo pesa igual, nada pesa. Un
          proveedor de equipamiento no abre el CRM a preguntarse cuantos
          contactos tiene; lo abre a ver cuanta plata hay en juego. Esa cifra
          manda, en grande y en monoespaciada, y el resto la acompaña en una
          tira compacta. Los tres links a Empresas, Contactos y Oportunidades
          siguen estando: ahora la metrica entera es el link. */}
      {/* EL MARCADOR. El encabezado se dibuja sobre la cancha (.cesped, la
          misma superficie del sidebar y del login) con las marcas completas
          atras: la plata en juego se lee como el resultado de un partido. Es
          la pieza que dice de que rubro es este CRM antes de leer una palabra. */}
      <header className="cesped relative isolate overflow-hidden rounded-2xl px-6 py-7 shadow-lg [--cesped-angulo:90deg] sm:px-8 sm:py-8">
        <MarcasCancha orientacion="horizontal" className="-z-10 text-white/[0.07]" />
        <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
          <span className="h-px w-6 bg-pitch-line" aria-hidden="true" />
          Resumen comercial
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
          {/* Interletrado bien negativo: una monoespaciada reserva el mismo
              ancho para cada signo, asi que a tamaño de titular el espacio de
              "$5,4 M" mide un caracter entero y la cifra sale desparramada.
              -0.055em la vuelve a compactar sin perder la grilla de digitos. */}
          <span className="font-mono text-[2.75rem] font-bold leading-none tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            {formatMoneyCompact(totalPipeline)}
          </span>
          <span className="pb-1 font-display text-lg text-pitch-line">en juego</span>
        </div>

        <p className="mt-3 text-sm text-white/75">
          <span className="font-mono tabular-nums">{formatMoney(totalPipeline)}</span> repartidos en{" "}
          <Link
            href="/oportunidades"
            className="rounded-sm font-semibold text-white underline-offset-4 hover:text-pitch-line hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-line"
          >
            {items.length} oportunidades
          </Link>{" "}
          abiertas.
        </p>

        <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/15 pt-4 sm:gap-x-12">
          <Metrica href="/empresas" icon={Building2} label="Empresas" value={empresasCount ?? 0} />
          <Metrica href="/empresas" icon={Users} label="Contactos" value={contactosCount ?? 0} />
          <Metrica
            href="/oportunidades"
            icon={Handshake}
            label="Oportunidades"
            value={items.length}
          />
        </dl>
      </header>

      {/* Distribucion del embudo. SIN tarjeta a proposito: es una cinta de
          resumen, no un objeto de la aplicacion. Cuando todo va adentro de una
          tarjeta, la tarjeta deja de significar algo. */}
      <section>
        <SectionTitle
          icon={Layers}
          right={
            <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
              {items.length} en total
            </span>
          }
        >
          Distribución del embudo
        </SectionTitle>
        <ShareBar
          rows={porEtapa}
          total={items.length}
          emptyText="El embudo está vacío: todavía no hay oportunidades para repartir."
        />
      </section>

      {/* Dos rankings, en 3/2 y no en mitades. La asimetria dice cual de los
          dos es el operativo (por etapa: donde esta trabado el embudo) y cual
          es contexto. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <SectionTitle icon={Filter}>Oportunidades por etapa</SectionTitle>
            <MagnitudeBars
              rows={porEtapa}
              emptyText="Cuando cargues la primera consulta, acá se ve en qué etapa está."
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle icon={Building2}>Empresas con más valor en juego</SectionTitle>
            {topEmpresas.length ? (
              <MagnitudeBars rows={topEmpresas} />
            ) : (
              <EmptyState
                compact
                text="Ninguna oportunidad tiene cliente asignado"
                hint="Asignale una empresa a una oportunidad y aparece acá, ordenada por lo que hay en juego."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Onboarding de la demo */}
      <Card className="border-brand/20 bg-brand/[0.04]">
        <CardContent className="p-5">
          <SectionTitle icon={GoalMark}>De la venta al recambio</SectionTitle>
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
              <>
                Cuando se entrega, asentá la venta: la fecha de entrega arranca el reloj, y el aviso
                de recambio se arma solo.
              </>,
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
