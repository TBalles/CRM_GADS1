import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/crm/Button";
import { CellBar, CellNumber, DataTable, TBody, TFoot, THead, Td, Th, Tr } from "@/components/crm/DataTable";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { PageBar, SectionBar } from "@/components/crm/PageBar";
import { StatStrip, type Stat } from "@/components/crm/StatStrip";
import { StatusDot } from "@/components/crm/Status";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { ORIGEN_SIN, calcularEmbudo, filtrarCohorte, formatDias, formatPorcentaje, type CambioEmbudo } from "@/lib/embudo";
import { fechaParam, uuidParam, type ParamsUrl } from "@/lib/paginacion";
import { rutaInicial } from "@/lib/permisos";
import { exigirPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { sumarDias } from "@/lib/tablero";
import EmbudoFiltros from "./EmbudoFiltros";

/**
 * Conversión del embudo (MASTER.md §10.23). Misma consulta, cohorte, cuentas (`lib/embudo.ts`), permisos y filtros por
 * URL que el legacy; cambia la presentación: una franja de cifras y una tabla por etapa con la barra del embudo (el
 * número siempre escrito en su columna), y el método en «Cómo se calcula».
 */

export const metadata = { title: "Conversión del embudo" };

/** PostgREST corta en `max_rows` (1000 en Supabase) sin avisar: se pide con ese tope y se avisa si lo toca. */
const TOPE = 1000;

/** "21,5 días" → cifra en mono + unidad en gris; "menos de 1 día" o "—" quedan como texto. */
function cifra(texto: string, unidad: RegExp): Pick<Stat, "value" | "unit" | "text"> {
  const m = new RegExp(`^([\\d.,]+)\\s?(${unidad.source})$`).exec(texto);
  if (m) return { value: m[1], unit: m[2] };
  return texto === "—" ? { value: undefined } : { value: texto, text: true };
}

/** "85,7%" → 85,7 con "%" en gris; "—" tal cual. */
function Porcentaje({ razon }: { razon: number | null }) {
  const t = formatPorcentaje(razon);
  if (razon === null) return <span className="text-(--crm-text-2)">{t}</span>;
  return <CellNumber unit="%">{t.replace("%", "")}</CellNumber>;
}

export default async function EmbudoPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  // Mide a todo el equipo: hace falta ver las oportunidades Y la cartera de todos (con cartera propia daría la mitad del cuadro).
  const sesion = await exigirPermiso("oportunidades.ver");
  if (!sesion.puede("clientes.ver_todos")) redirect(rutaInicial(sesion.permisos));

  const sp = await searchParams;
  const desde = fechaParam(sp.desde);
  const hasta = fechaParam(sp.hasta);
  const crudoOrigen = Array.isArray(sp.origen) ? sp.origen[0] : sp.origen;
  const origen = crudoOrigen === ORIGEN_SIN ? ORIGEN_SIN : uuidParam(sp.origen);
  const hayFiltro = Boolean(desde || hasta || origen);

  const supabase = await createClient();
  // La base acota con un día de margen a cada lado; el recorte exacto por día argentino lo hace `filtrarCohorte`.
  let consulta = supabase
    .from("oportunidades")
    .select("id, estado, etapa_id, created_at, fecha_cierre, origen_id, historial:oportunidad_etapas_historial(oportunidad_id, etapa_nueva_id, cambiado_en)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .limit(TOPE);
  if (desde) consulta = consulta.gte("created_at", `${sumarDias(desde, -1)}T00:00:00-03:00`);
  if (hasta) consulta = consulta.lt("created_at", `${sumarDias(hasta, 2)}T00:00:00-03:00`);
  if (origen === ORIGEN_SIN) consulta = consulta.is("origen_id", null);
  else if (origen) consulta = consulta.eq("origen_id", origen);

  const [opsRes, etapasRes, origenesRes] = await Promise.all([
    consulta,
    supabase.from("etapas").select("id, nombre, tipo, orden"),
    supabase.from("origenes").select("id, nombre").order("orden").order("nombre"),
  ]);
  for (const [r, que] of [
    [opsRes, "las oportunidades"],
    [etapasRes, "las etapas"],
    [origenesRes, "los orígenes"],
  ] as const) {
    if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  }

  const crudas = opsRes.data ?? [];
  const cohorte = filtrarCohorte(crudas, { desde, hasta, origen });
  const cambios: CambioEmbudo[] = cohorte.flatMap((o) => o.historial ?? []);
  const r = calcularEmbudo({
    etapas: etapasRes.data ?? [],
    oportunidades: cohorte,
    cambios,
    ahora: new Date().toISOString(),
  });
  const maximo = Math.max(1, ...r.etapas.map((f) => f.entraron), r.ganadas);
  const cerradas = r.ganadas + r.perdidas;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  return (
    <div className={cn(UI_ROOT, "min-h-full bg-(--crm-canvas) px-4 pb-6 xl:px-6")}>
      <PageBar
        title="Conversión del embudo"
        count={
          r.total > 0
            ? `${plural(r.total, "oportunidad", "oportunidades")} en la cohorte: ${plural(r.abiertas, "abierta", "abiertas")}, ${plural(r.ganadas, "ganada", "ganadas")} y ${plural(r.perdidas, "perdida", "perdidas")}.`
            : undefined
        }
      />
      <EmbudoFiltros origenes={origenesRes.data ?? []} hayFiltro={hayFiltro}>
        <div className="flex flex-col gap-6 pt-2">
          {r.total === 0 ? (
            <EmptyState
              title={hayFiltro ? "Ninguna oportunidad con esos filtros" : "Todavía no hay oportunidades para medir"}
              description={
                hayFiltro
                  ? "Probá con otro período o con todos los orígenes: la cohorte son las oportunidades dadas de alta en ese rango."
                  : "Cuando el equipo cargue oportunidades y las mueva de etapa, acá se ve cuántas llegan a cada paso."
              }
              action={
                !hayFiltro && (
                  <Link href="/oportunidades" className={buttonClass({ size: "sm" })}>
                    Ir a Oportunidades
                  </Link>
                )
              }
            />
          ) : (
            <>
              {(opsRes.count ?? crudas.length) > TOPE && (
                <InlineBanner tone="info">
                  Se midieron las {r.total} oportunidades más recientes del filtro (hay más). Acotá el período para medir las anteriores.
                </InlineBanner>
              )}

              {/* El resultado va primero: ¿cuánto de lo que entra se cierra bien? */}
              <StatStrip
                size="lg"
                label="Resultado de la cohorte"
                items={[
                  {
                    label: "Tasa de éxito",
                    ...cifra(formatPorcentaje(r.tasaExito), /%/),
                    detail:
                      cerradas > 0
                        ? `${plural(r.ganadas, "ganada", "ganadas")} de ${plural(cerradas, "cerrada", "cerradas")}`
                        : "Todavía no se cerró ninguna",
                  },
                  { label: "Ciclo hasta ganar", ...cifra(formatDias(r.cicloGanadasDias), /días?/), detail: "del alta al cierre, en promedio" },
                  { label: "Ciclo hasta perder", ...cifra(formatDias(r.cicloPerdidasDias), /días?/), detail: "del alta al cierre, en promedio" },
                ]}
              />

              <section className="flex min-w-0 flex-col">
                <SectionBar title="Embudo por etapa" count={r.etapas.length} />
                <DataTable label="Embudo por etapa">
                  <THead>
                    <Th>Etapa</Th>
                    <Th className="w-[22%] @[60rem]:w-[26%]">
                      <span className="sr-only">Forma del embudo</span>
                    </Th>
                    <Th width={88} align="right">
                      Entraron
                    </Th>
                    <Th width={104} align="right" hideBelow="md">
                      Avanzaron
                    </Th>
                    <Th width={96} align="right" hideBelow="md">
                      Conversión
                    </Th>
                    <Th width={152} align="right" hideBelow="md">
                      Mediana en la etapa
                    </Th>
                    <Th width={232} hideBelow="lg">
                      Siguen ahí ahora
                    </Th>
                  </THead>
                  <TBody>
                    {r.etapas.map((f) => {
                      const mediana = f.medianaDias === null ? (f.enEtapaAhora > 0 ? "Ninguna terminó" : "—") : formatDias(f.medianaDias);
                      const siguen = f.enEtapaAhora > 0 ? `${f.enEtapaAhora} · mediana hasta hoy ${formatDias(f.medianaHastaHoyDias)}` : null;
                      return (
                        <Tr key={f.etapa.id}>
                          <Td className="whitespace-normal py-1.5">
                            <span className="block font-medium">{f.etapa.nombre}</span>
                            {/* Con menos ancho, lo de las columnas escondidas va acá abajo: un dato por renglón, sin recortar. */}
                            <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[45rem]:hidden")}>
                              Avanzaron {f.avanzaron} de {f.entraron} ({formatPorcentaje(f.conversion)})
                            </span>
                            <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[45rem]:hidden")}>Mediana en la etapa: {mediana}</span>
                            {siguen && (
                              <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[60rem]:hidden")}>Siguen ahí ahora: {siguen}</span>
                            )}
                          </Td>
                          <Td>
                            <CellBar value={f.entraron} max={maximo} center />
                          </Td>
                          <Td align="right">
                            <CellNumber>{f.entraron}</CellNumber>
                          </Td>
                          <Td align="right" hideBelow="md">
                            <CellNumber>
                              {f.avanzaron} <span className={TYPE.unit}>de</span> {f.entraron}
                            </CellNumber>
                          </Td>
                          <Td align="right" hideBelow="md">
                            <Porcentaje razon={f.conversion} />
                          </Td>
                          <Td align="right" hideBelow="md" className="tabular-nums">
                            {f.medianaDias === null ? <span className="text-(--crm-text-2)">{mediana}</span> : mediana}
                          </Td>
                          <Td hideBelow="lg" className="tabular-nums">
                            {siguen ?? <span className="text-(--crm-text-2)">—</span>}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                  <TFoot>
                    <Td>
                      <StatusDot tone="success">Ganadas</StatusDot>
                    </Td>
                    <Td>
                      <CellBar value={r.ganadas} max={maximo} center />
                    </Td>
                    <Td align="right">
                      <CellNumber>{r.ganadas}</CellNumber>
                    </Td>
                    <Td hideBelow="md" />
                    <Td hideBelow="md" />
                    <Td hideBelow="md" />
                    <Td hideBelow="lg" />
                  </TFoot>
                </DataTable>
                <p className={cn(TYPE.meta, "mt-2 max-w-prose tabular-nums text-(--crm-text-2)")}>
                  Las {plural(r.perdidas, "perdida", "perdidas")} y las {plural(r.abiertas, "abierta", "abiertas")} no suman a la fila de ganadas.
                </p>
                {r.sinHistorial > 0 && (
                  <p className={cn(TYPE.meta, "mt-1 max-w-prose tabular-nums text-(--crm-text-2)")}>
                    {r.sinHistorial} {r.sinHistorial === 1 ? "oportunidad no tiene" : "oportunidades no tienen"} historial de etapas: se contó como si
                    hubiera estado en su etapa actual desde el alta.
                  </p>
                )}
              </section>
            </>
          )}

          <details className="group border-t border-(--crm-border) pt-3">
            <summary
              className={cn(
                "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[2px] text-[14px] font-semibold [&::-webkit-details-marker]:hidden",
                FOCUS,
              )}
            >
              <ChevronRight
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 text-(--crm-text-2) transition-transform duration-(--crm-dur-fast) group-open:rotate-90 motion-reduce:transition-none"
              />
              Cómo se calcula
            </summary>
            <div className="mt-3 flex max-w-prose flex-col gap-2 text-[13px] leading-[1.55] text-(--crm-text-2)">
              <p>
                <strong className="font-medium text-(--crm-text)">Cohorte.</strong> Las oportunidades dadas de alta entre las fechas elegidas (día argentino,
                ambas inclusive) y del origen elegido. Todas se miran hasta hoy.
              </p>
              <p>
                <strong className="font-medium text-(--crm-text)">Entraron.</strong> Las que pasaron alguna vez por la etapa, según el historial de cambios.
                Una que vuelve a entrar cuenta una sola vez, y una que se salteó la etapa no cuenta en ella.
              </p>
              <p>
                <strong className="font-medium text-(--crm-text)">Avanzaron.</strong> De las que entraron, las que después llegaron a una etapa abierta más
                adelante o a una ganada. Perder o volver atrás no es avanzar. El porcentaje es avanzaron ÷ entraron.
              </p>
              <p>
                <strong className="font-medium text-(--crm-text)">Mediana en la etapa.</strong> Días entre entrar a la etapa y salir de ella (cada estadía
                cuenta; si se reabre y vuelve, son dos). Las que siguen ahí todavía no terminaron: se muestran aparte, contadas «hasta hoy», y son un
                piso, no un dato final.
              </p>
              <p>
                <strong className="font-medium text-(--crm-text)">Tasa de éxito.</strong> Ganadas ÷ (ganadas + perdidas), por el estado actual. Las abiertas
                no entran en la cuenta.
              </p>
              <p>
                <strong className="font-medium text-(--crm-text)">Ciclo.</strong> Días del alta a la fecha real de cierre vigente, en promedio, por separado
                para ganadas y perdidas.
              </p>
              <p>
                Los datos son los del historial de etapas que escribe el sistema; las oportunidades anteriores a que existiera ese historial arrancan en
                su etapa de ese momento.
              </p>
              <p>La barra de cada fila es la misma cifra de «Entraron» (o de ganadas), proporcional a la mayor.</p>
            </div>
          </details>
        </div>
      </EmbudoFiltros>
    </div>
  );
}
