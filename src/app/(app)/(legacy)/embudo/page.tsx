import { redirect } from "next/navigation";
import { CircleCheck, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, PageHeader, SectionTitle } from "@/components/ui/UIComponents";
import {
  ORIGEN_SIN,
  calcularEmbudo,
  filtrarCohorte,
  formatDias,
  formatPorcentaje,
  type CambioEmbudo,
  type FilaEtapa,
} from "@/lib/embudo";
import { fechaParam, uuidParam, type ParamsUrl } from "@/lib/paginacion";
import { rutaInicial } from "@/lib/permisos";
import { exigirPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { sumarDias } from "@/lib/tablero";
import EmbudoFiltros from "./EmbudoFiltros";

export const metadata = { title: "Conversión del embudo" };

/** PostgREST corta en `max_rows` (1000 en Supabase) sin avisar: se pide con ese tope y se avisa si lo toca. */
const TOPE = 1000;

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

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        titulo="Conversión del embudo"
        eyebrow="De la consulta a la entrega"
        bajada="Cuántas oportunidades llegan a cada etapa, cuántas siguen adelante y cuánto tiempo se quedan. Se cuenta sobre las que se dieron de alta en el período."
      />

      <EmbudoFiltros origenes={origenesRes.data ?? []} hayFiltro={hayFiltro} />

      {r.total === 0 ? (
        <EmptyState
          escena={hayFiltro ? "afuera" : "cancha"}
          text={hayFiltro ? "Ninguna oportunidad con esos filtros" : "Todavía no hay oportunidades para medir"}
          hint={
            hayFiltro
              ? "Probá con otro período o con todos los orígenes: la cohorte son las oportunidades dadas de alta en ese rango."
              : "Cuando el equipo cargue oportunidades y las mueva de etapa, acá se ve cuántas llegan a cada paso."
          }
        />
      ) : (
        <>
          {(opsRes.count ?? crudas.length) > TOPE && (
            <p role="status" className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
              Se midieron las {r.total} oportunidades más recientes del filtro (hay más). Acotá el período para medir las anteriores.
            </p>
          )}

          {/* El resultado va primero: ¿cuánto de lo que entra se cierra bien? Una cifra manda, el resto la acompaña. */}
          <Card>
            <CardContent className="p-5">
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tasa de éxito</dt>
                  <dd className="mt-1 flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-5xl font-bold leading-none tracking-[-0.04em] tabular-nums">{formatPorcentaje(r.tasaExito)}</span>
                    <span className="text-sm text-muted-foreground">
                      {cerradas > 0
                        ? `${r.ganadas} ${r.ganadas === 1 ? "ganada" : "ganadas"} de ${cerradas} ${cerradas === 1 ? "cerrada" : "cerradas"}`
                        : "Todavía no se cerró ninguna"}
                    </span>
                  </dd>
                </div>
                <Dato titulo="Ciclo hasta ganar" valor={formatDias(r.cicloGanadasDias)} nota="del alta al cierre, en promedio" />
                <Dato titulo="Ciclo hasta perder" valor={formatDias(r.cicloPerdidasDias)} nota="del alta al cierre, en promedio" />
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                {r.total} {r.total === 1 ? "oportunidad" : "oportunidades"} en la cohorte: {r.abiertas} {r.abiertas === 1 ? "abierta" : "abiertas"}, {r.ganadas} {r.ganadas === 1 ? "ganada" : "ganadas"} y {r.perdidas}{" "}
                {r.perdidas === 1 ? "perdida" : "perdidas"}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionTitle icon={Filter}>Embudo por etapa</SectionTitle>
              <ol className="space-y-5">
                {r.etapas.map((f, i) => (
                  <Etapa key={f.etapa.id} fila={f} numero={i + 1} maximo={maximo} />
                ))}
                <li>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <CircleCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 self-center text-brand" />
                      <span className="text-sm font-semibold">Ganadas</span>
                    </span>
                    <span className="text-sm">
                      <b className="font-mono tabular-nums">{r.ganadas}</b> {r.ganadas === 1 ? "oportunidad" : "oportunidades"}
                    </span>
                  </div>
                  <Barra porcentaje={(r.ganadas / maximo) * 100} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Las {r.perdidas} {r.perdidas === 1 ? "perdida" : "perdidas"} y las {r.abiertas} {r.abiertas === 1 ? "abierta" : "abiertas"} no suman a esta barra.
                  </p>
                </li>
              </ol>
              {r.sinHistorial > 0 && (
                <p className="mt-5 rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
                  {r.sinHistorial} {r.sinHistorial === 1 ? "oportunidad no tiene" : "oportunidades no tienen"} historial de etapas: se contó como si hubiera estado en su etapa actual desde el alta.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <details className="group rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          Cómo se calcula
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Cohorte.</strong> Las oportunidades dadas de alta entre las fechas elegidas (día argentino, ambas inclusive) y del origen elegido. Todas se miran hasta hoy.
          </p>
          <p>
            <strong className="text-foreground">Entraron.</strong> Las que pasaron alguna vez por la etapa, según el historial de cambios. Una que vuelve a entrar cuenta una sola vez, y una que se salteó la etapa no cuenta en ella.
          </p>
          <p>
            <strong className="text-foreground">Avanzaron.</strong> De las que entraron, las que después llegaron a una etapa abierta más adelante o a una ganada. Perder o volver atrás no es avanzar. El porcentaje es avanzaron ÷ entraron.
          </p>
          <p>
            <strong className="text-foreground">Mediana en la etapa.</strong> Días entre entrar a la etapa y salir de ella (cada estadía cuenta; si se reabre y vuelve, son dos). Las que siguen ahí todavía no terminaron: se muestran aparte, contadas «hasta hoy», y son un piso, no un dato final.
          </p>
          <p>
            <strong className="text-foreground">Tasa de éxito.</strong> Ganadas ÷ (ganadas + perdidas), por el estado actual. Las abiertas no entran en la cuenta.
          </p>
          <p>
            <strong className="text-foreground">Ciclo.</strong> Días del alta a la fecha real de cierre vigente, en promedio, por separado para ganadas y perdidas.
          </p>
          <p>
            Los datos son los del historial de etapas que escribe el sistema; las oportunidades anteriores a que existiera ese historial arrancan en su etapa de ese momento.
          </p>
        </div>
      </details>
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted-foreground">{nota}</dd>
    </div>
  );
}

/** La barra del embudo: centrada, de un solo tono, con el ancho proporcional. El número va siempre escrito al lado. */
function Barra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="mt-1.5 h-6 rounded-md bg-muted" aria-hidden="true">
      <div
        className="mx-auto h-full rounded-md bg-brand transition-all duration-500 motion-reduce:transition-none"
        style={{ width: `${Math.min(100, Math.max(porcentaje, porcentaje > 0 ? 2 : 0))}%` }}
      />
    </div>
  );
}

function Etapa({ fila: f, numero, maximo }: { fila: FilaEtapa; numero: number; maximo: number }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">{String(numero).padStart(2, "0")}</span>
          <span className="truncate text-sm font-semibold">{f.etapa.nombre}</span>
        </span>
        <span className="shrink-0 text-sm">
          <b className="font-mono tabular-nums">{f.entraron}</b> {f.entraron === 1 ? "entró" : "entraron"}
        </span>
      </div>
      <Barra porcentaje={(f.entraron / maximo) * 100} />
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Avanzaron</dt>
          <dd className="font-semibold tabular-nums">
            {f.avanzaron} de {f.entraron} <span className="font-normal text-muted-foreground">({formatPorcentaje(f.conversion)})</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mediana en la etapa</dt>
          <dd className="font-semibold tabular-nums">{f.medianaDias === null ? (f.enEtapaAhora > 0 ? "Ninguna terminó" : "—") : formatDias(f.medianaDias)}</dd>
        </div>
        {f.enEtapaAhora > 0 && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-muted-foreground">Siguen ahí ahora</dt>
            <dd className="font-semibold tabular-nums">
              {f.enEtapaAhora} <span className="font-normal text-muted-foreground">· mediana hasta hoy {formatDias(f.medianaHastaHoyDias)}</span>
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
