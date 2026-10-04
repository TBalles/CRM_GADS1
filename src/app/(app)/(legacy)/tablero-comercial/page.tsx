import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, CircleX, Hourglass, Users2, XOctagon } from "lucide-react";
import { MarcasCancha } from "@/components/Cancha";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, PageHeader, Pill, SectionTitle } from "@/components/ui/UIComponents";
import { formatFecha } from "@/lib/clientes";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { hoyAR } from "@/lib/oportunidades";
import { rutaInicial } from "@/lib/permisos";
import { exigirPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import {
  OPCIONES_DIAS,
  VENTANA_ACTIVIDADES_DIAS,
  coberturaActividades,
  diasParam,
  mesParam,
  pipelinePorResponsable,
  rangoMes,
  rankingMotivos,
  resumenCierres,
  sinActividad,
  sumarDias,
  type BaseActividad,
  type OportunidadSinActividad,
} from "@/lib/tablero";
import { diaAR, etiquetaMes } from "@/lib/timeline360";
import { cn } from "@/lib/utils";
import { MagnitudeBars, type Row } from "../dashboard/charts";

export const metadata = { title: "Tablero comercial" };

/** PostgREST corta en `max_rows` (1000 en Supabase) sin avisar: cada lectura se pide con ese tope y se avisa si lo toca. */
const TOPE = 1000;
/** Cuántas oportunidades quietas se listan; el resto se resume. */
const FILAS_QUIETAS = 20;

const BASE_TEXTO: Record<BaseActividad, string> = {
  oportunidad: "de la oportunidad",
  cliente: "del cliente",
  alta: "desde el alta",
};

const enlace =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default async function TableroComercialPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  // Es para quien ve la cartera de todos Y las oportunidades: sin lo segundo no habría nada que contar.
  const sesion = await exigirPermiso("clientes.ver_todos");
  if (!sesion.puede("oportunidades.ver")) redirect(rutaInicial(sesion.permisos));
  const verBitacora = sesion.puede("bitacora.ver");

  const sp = await searchParams;
  const hoy = hoyAR();
  const dias = diasParam(sp.dias);
  const mes = mesParam(sp.mes, hoy);
  const { desde, hasta } = rangoMes(mes);
  const inicioActividades = sumarDias(hoy, -VENTANA_ACTIVIDADES_DIAS);

  const supabase = await createClient();
  const [abiertasRes, cerradasRes, perfilesRes, motivosRes, actividadesRes] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id, titulo, monto, responsable_id, empresa_id, contacto_id, created_at, empresa:empresas(nombre), contacto:contactos(nombre, apellido)", {
        count: "exact",
      })
      .eq("estado", "abierta")
      // Si hay más que el tope, que queden las MÁS ANTIGUAS: son las que más probablemente se enfriaron.
      .order("created_at", { ascending: true })
      .order("id")
      .limit(TOPE),
    supabase
      .from("oportunidades")
      .select("id, estado, monto, motivo_perdida_id", { count: "exact" })
      .in("estado", ["ganada", "perdida"])
      .gte("fecha_cierre", desde)
      .lt("fecha_cierre", hasta)
      .order("fecha_cierre", { ascending: false })
      .order("id")
      .limit(TOPE),
    supabase.from("perfiles").select("id, nombre, email").eq("es_superadmin", false),
    supabase.from("motivos_perdida").select("id, nombre"),
    verBitacora
      ? supabase
          .from("bitacora_entradas")
          .select("oportunidad_id, empresa_id, contacto_id, ocurrido_en")
          .gte("ocurrido_en", `${inicioActividades}T00:00:00-03:00`)
          .order("ocurrido_en", { ascending: false })
          .limit(TOPE + 1)
      : Promise.resolve({ data: null, error: null }),
  ]);
  // Un error de lectura se propaga (error.tsx ofrece "Reintentar"): un tablero en cero "de mentira" sería peor.
  for (const [r, que] of [
    [abiertasRes, "las oportunidades abiertas"],
    [cerradasRes, "los cierres del mes"],
    [perfilesRes, "el equipo"],
    [motivosRes, "los motivos de pérdida"],
    [actividadesRes, "las actividades"],
  ] as const) {
    if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  }

  const abiertas = abiertasRes.data ?? [];
  const cerradas = cerradasRes.data ?? [];
  // Se piden TOPE + 1 para saber de verdad si hay más (exactamente TOPE no es truncado).
  const actividadesLeidas = actividadesRes.data ?? [];
  const actividadesTruncadas = actividadesLeidas.length > TOPE;
  const actividades = actividadesLeidas.slice(0, TOPE);
  const abiertasTruncadas = (abiertasRes.count ?? abiertas.length) > TOPE;
  const cerradasTruncadas = (cerradasRes.count ?? cerradas.length) > TOPE;
  const nombrePorId = new Map((perfilesRes.data ?? []).map((p) => [p.id, p.nombre ?? p.email ?? "Usuario"]));
  const motivoPorId = new Map((motivosRes.data ?? []).map((m) => [m.id, m.nombre]));

  const totalEnJuego = abiertas.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
  const porVendedor = pipelinePorResponsable(abiertas, nombrePorId);
  const filasVendedor: Row[] = porVendedor.map((v) => ({
    key: v.key,
    label: v.label,
    value: v.cantidad,
    detail: formatMoneyCompact(v.monto),
    bar: v.monto,
  }));

  // Si la lectura se cortó en el tope, el último día leído puede estar incompleto: la cobertura empieza al día siguiente.
  const masViejaCompleta = actividadesTruncadas ? sumarDias(diaAR(actividades[actividades.length - 1].ocurrido_en), 1) : null;
  const cobertura = coberturaActividades(hoy, actividadesTruncadas, masViejaCompleta);
  const todasQuietas = verBitacora ? sinActividad(abiertas, actividades, hoy, dias, cobertura) : [];
  const quietas = todasQuietas.filter((q) => !q.incierta);
  const inciertas = todasQuietas.filter((q) => q.incierta);
  const clientePorOportunidad = new Map(
    abiertas.map((o) => [o.id, o.empresa?.nombre ?? (o.contacto ? [o.contacto.nombre, o.contacto.apellido].filter(Boolean).join(" ") : null)]),
  );

  const cierres = resumenCierres(cerradas);
  const motivos = rankingMotivos(
    cerradas.filter((o) => o.estado === "perdida"),
    motivoPorId,
  );
  const filasMotivos: Row[] = motivos.map((m) => ({
    key: m.key,
    label: m.label,
    value: m.cantidad,
    detail: m.monto ? formatMoneyCompact(m.monto) : undefined,
  }));

  const hrefDias = (n: number) => urlConParams("/tablero-comercial", sp, { dias: n === 14 ? null : String(n) });
  const hrefMes = (m: string) => urlConParams("/tablero-comercial", sp, { mes: m === hoy.slice(0, 7) ? null : m });
  const [anio, nroMes] = mes.split("-").map(Number);
  const anterior = nroMes === 1 ? `${anio - 1}-12` : `${anio}-${String(nroMes - 1).padStart(2, "0")}`;
  const siguiente = nroMes === 12 ? `${anio + 1}-01` : `${anio}-${String(nroMes + 1).padStart(2, "0")}`;
  const esMesActual = mes === hoy.slice(0, 7);
  const responsablesConPipeline = new Set(abiertas.map((o) => o.responsable_id).filter(Boolean)).size;

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        titulo="Tablero comercial"
        eyebrow="El equipo en la cancha"
        bajada="Dónde está la plata del equipo, qué oportunidades se enfriaron y cómo cerró el mes. Es lo que ve quien supervisa la cartera de todos."
      />

      {/* EL MARCADOR DEL EQUIPO: la misma pieza que el inicio, con el valor en juego de todos. */}
      <header className="cesped relative isolate overflow-hidden rounded-2xl px-6 py-7 shadow-lg [--cesped-angulo:90deg] sm:px-8 sm:py-8">
        <MarcasCancha orientacion="horizontal" className="-z-10 text-white/[0.07]" />
        <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
          <span className="h-px w-6 bg-pitch-line" aria-hidden="true" />
          Valor en juego del equipo
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="font-mono text-[2.75rem] font-bold leading-none tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            {formatMoneyCompact(totalEnJuego)}
          </span>
          <span className="pb-1 font-display text-lg text-pitch-line">en juego</span>
        </div>
        <p className="mt-3 text-sm text-white/75">
          <span className="font-mono tabular-nums">{formatMoney(totalEnJuego)}</span> en{" "}
          <Link
            href="/oportunidades"
            className="rounded-sm font-semibold text-white underline-offset-4 hover:text-pitch-line hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-line"
          >
            {abiertas.length} {abiertas.length === 1 ? "oportunidad abierta" : "oportunidades abiertas"}
          </Link>
          {responsablesConPipeline > 0 && <> de {responsablesConPipeline} {responsablesConPipeline === 1 ? "responsable" : "responsables"}</>}
          {abiertasTruncadas && <> (se leyeron las {TOPE} más antiguas de {abiertasRes.count}: el total puede quedar corto)</>}.
        </p>
        <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/15 pt-4 sm:gap-x-12">
          <Cifra icon={Hourglass} valor={verBitacora ? quietas.length : null} etiqueta={`quietas hace ${dias} días o más`} />
          <Cifra icon={CircleCheck} valor={cierres.ganadas.cantidad} etiqueta={`ganadas en ${etiquetaMes(mes)}`} />
          <Cifra icon={CircleX} valor={cierres.perdidas.cantidad} etiqueta={`perdidas en ${etiquetaMes(mes)}`} />
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* PIPELINE POR VENDEDOR */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle
              icon={Users2}
              right={
                <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {abiertas.length} abiertas
                </span>
              }
            >
              Pipeline por responsable
            </SectionTitle>
            {filasVendedor.length ? (
              <>
                <p className="-mt-2 mb-3 text-xs text-muted-foreground">La barra mide el valor; el número chico, la cantidad.</p>
                <MagnitudeBars rows={filasVendedor} />
                {abiertasTruncadas && (
                  <p className="mt-3 rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
                    Se leyeron las {TOPE} abiertas más antiguas de {abiertasRes.count}: las cifras de cada responsable pueden quedar cortas.
                  </p>
                )}
              </>
            ) : (
              <EmptyState compact text="No hay oportunidades abiertas" hint="Cuando el equipo cargue consultas, acá se ve cuánta plata tiene cada uno en juego." />
            )}
          </CardContent>
        </Card>

        {/* SIN ACTIVIDAD */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <SectionTitle icon={Hourglass}>Abiertas sin actividad</SectionTitle>
            <nav aria-label="Días sin actividad" className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Quietas hace</span>
              {OPCIONES_DIAS.map((n) => (
                <Link
                  key={n}
                  href={hrefDias(n)}
                  scroll={false}
                  aria-current={n === dias ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold transition-colors",
                    enlace,
                    n === dias ? "border-brand bg-brand/10 text-brand" : "border-input bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {n} días o más
                </Link>
              ))}
            </nav>

            {!verBitacora ? (
              <EmptyState compact text="Tu rol no ve la bitácora" hint="Sin las actividades no se puede saber qué oportunidades se enfriaron." />
            ) : quietas.length === 0 && inciertas.length === 0 ? (
              <EmptyState
                compact
                escena="al-dia"
                text="Ninguna oportunidad quieta"
                hint={`Todas las abiertas tuvieron movimiento en los últimos ${dias} días. Si alguna deja de hablarse, aparece acá.`}
              />
            ) : (
              <>
                <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                  Sin una actividad cargada hace {dias} días o más, en la oportunidad o en su cliente. Los cambios de etapa no cuentan.
                </p>
                {quietas.length === 0 && <p className="mb-3 text-sm font-medium">Ninguna con certeza, pero hay {inciertas.length} que no se pudieron comprobar.</p>}
                <ul className="divide-y divide-border">
                  {quietas.slice(0, FILAS_QUIETAS).map((q) => (
                    <FilaQuieta key={q.id} q={q} nombrePorId={nombrePorId} clientePorOportunidad={clientePorOportunidad} />
                  ))}
                </ul>
                {quietas.length > FILAS_QUIETAS && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Mostrando las {FILAS_QUIETAS} más quietas de {quietas.length}.
                  </p>
                )}
                {inciertas.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">No se pudo comprobar ({inciertas.length})</h4>
                    <p className="mb-2 mt-1 text-xs text-muted-foreground">
                      Las actividades leídas solo llegan hasta el {formatFecha(cobertura)} y estas no tienen ninguna desde entonces: pueden estar quietas o no.
                    </p>
                    <ul className="divide-y divide-border">
                      {inciertas.slice(0, FILAS_QUIETAS).map((q) => (
                        <FilaQuieta key={q.id} q={q} nombrePorId={nombrePorId} clientePorOportunidad={clientePorOportunidad} />
                      ))}
                    </ul>
                    {inciertas.length > FILAS_QUIETAS && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Mostrando {FILAS_QUIETAS} de {inciertas.length}.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {verBitacora && abiertasTruncadas && (
              <p className="mt-3 rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
                Se evaluaron las {TOPE} abiertas más antiguas de {abiertasRes.count}: las más nuevas no entran en esta lista.
              </p>
            )}
            {verBitacora && actividadesTruncadas && (
              <p className="mt-3 rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
                Se leyeron las {TOPE} actividades más recientes (desde el {formatFecha(cobertura)}). Las oportunidades sin actividad en ese tramo figuran con «más de» o «antes del».
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CIERRES DEL MES */}
      <section aria-labelledby="titulo-cierres" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <h2 id="titulo-cierres" className="font-display text-2xl leading-none">
            Cierres del mes
          </h2>
          <nav aria-label="Elegir el mes" className="flex items-center gap-1">
            <Link
              href={hrefMes(anterior)}
              scroll={false}
              aria-label={`Mes anterior: ${etiquetaMes(anterior)}`}
              className={cn("flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-accent", enlace)}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
            <span className="min-w-[10rem] px-2 text-center text-sm font-semibold first-letter:uppercase" aria-live="polite">
              {etiquetaMes(mes)}
            </span>
            {esMesActual ? (
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={hrefMes(siguiente)}
                scroll={false}
                aria-label={`Mes siguiente: ${etiquetaMes(siguiente)}`}
                className={cn("flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-accent", enlace)}
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-5">
              <SectionTitle icon={CircleCheck}>Ganadas y perdidas</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Resultado tono="ganada" cantidad={cierres.ganadas.cantidad} monto={cierres.ganadas.monto} />
                <Resultado tono="perdida" cantidad={cierres.perdidas.cantidad} monto={cierres.perdidas.monto} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Por fecha real de cierre dentro de {etiquetaMes(mes)}.{" "}
                {cierres.ganadas.cantidad + cierres.perdidas.cantidad > 0
                  ? `Se ganó ${Math.round((cierres.ganadas.cantidad / (cierres.ganadas.cantidad + cierres.perdidas.cantidad)) * 100)}% de lo que se cerró.`
                  : "Ese mes no hubo cierres."}
                {cerradasTruncadas && ` Se leyeron los ${TOPE} cierres más recientes de ${cerradasRes.count}: faltan los anteriores.`}
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <SectionTitle icon={XOctagon}>Por qué se pierde</SectionTitle>
              {filasMotivos.length ? (
                <MagnitudeBars rows={filasMotivos} />
              ) : (
                <EmptyState
                  compact
                  text={cierres.perdidas.cantidad ? "Sin motivos cargados" : "Ninguna perdida este mes"}
                  hint={cierres.perdidas.cantidad ? undefined : "Cuando se cierre una como perdida, el motivo se cuenta acá."}
                />
              )}
              {filasMotivos.length > 0 && (
                <Link
                  href="/oportunidades?vista=lista&estado=perdida"
                  className={cn("mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline", enlace)}
                >
                  Ver las perdidas <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

/** Una cifra de la tira del marcador. Sin dato (el rol no ve la bitácora) se dice, no se muestra un 0. */
function Cifra({ icon: Icon, valor, etiqueta }: { icon: React.ElementType; valor: number | null; etiqueta: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60" />
      <dd className="font-mono text-xl font-bold tabular-nums leading-none text-white">{valor ?? "—"}</dd>
      <dt className="text-sm text-white/75">{etiqueta}</dt>
    </div>
  );
}

/** Ganadas o perdidas del mes: cantidad grande y monto. El resultado va en texto, no solo en color. */
function Resultado({ tono, cantidad, monto }: { tono: "ganada" | "perdida"; cantidad: number; monto: number }) {
  const ganada = tono === "ganada";
  return (
    <div className="rounded-xl border border-border p-4">
      <Pill tono={ganada ? "verde" : "rojo"} className="gap-1">
        {ganada ? <CircleCheck aria-hidden="true" className="h-3 w-3" /> : <CircleX aria-hidden="true" className="h-3 w-3" />}
        {ganada ? "Ganadas" : "Perdidas"}
      </Pill>
      <p className="mt-3 font-mono text-4xl font-bold leading-none tabular-nums">{cantidad}</p>
      <p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">{monto ? formatMoney(monto) : "Sin monto"}</p>
    </div>
  );
}

type FilaQuietaProps = {
  q: OportunidadSinActividad;
  nombrePorId: Map<string, string>;
  clientePorOportunidad: Map<string, string | null>;
};

/** Una oportunidad quieta (o que no se pudo comprobar) de la lista. */
function FilaQuieta({ q, nombrePorId, clientePorOportunidad }: FilaQuietaProps) {
  const cliente = clientePorOportunidad.get(q.id);
  const responsable = q.responsableId ? nombrePorId.get(q.responsableId) : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Link href={`/oportunidades/${q.id}`} className={cn("block truncate text-sm font-medium hover:text-brand", enlace)}>
          {q.titulo}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{[responsable ?? "Sin responsable", cliente].filter(Boolean).join(" · ")}</p>
        <p className="text-xs text-muted-foreground">
          Última actividad {BASE_TEXTO[q.base]}:{" "}
          <span className="tabular-nums">{q.masDe ? `antes del ${formatFecha(q.ultima)}` : formatFecha(q.ultima)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {q.monto > 0 && <span className="font-mono text-xs font-semibold tabular-nums">{formatMoneyCompact(q.monto)}</span>}
        {q.incierta ? (
          <Pill tono="gris">Sin datos suficientes</Pill>
        ) : (
          <Pill tono="ambar">
            {q.masDe ? "Más de " : ""}
            {q.dias} días
          </Pill>
        )}
      </div>
    </li>
  );
}
