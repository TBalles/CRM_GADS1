import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/crm/Button";
import { CellBar, CellNumber, DataTable, TBody, TFoot, THead, Td, Th, Tr } from "@/components/crm/DataTable";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { PageBar, SectionBar } from "@/components/crm/PageBar";
import { StatStrip } from "@/components/crm/StatStrip";
import { Avatar, StatusDot } from "@/components/crm/Status";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { formatFecha } from "@/lib/clientes";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { hoyAR } from "@/lib/oportunidades";
import { rutaInicial } from "@/lib/permisos";
import { exigirPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import {
  OPCIONES_DIAS,
  SIN_RESPONSABLE,
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

/**
 * Tablero comercial (MASTER.md §10.22). Mismas lecturas, topes, permisos, parámetros (`?dias=`, `?mes=`) y cuentas
 * (`lib/tablero.ts`) que el legacy; cambia la presentación: sin el marcador sobre la cancha, una franja de cifras y
 * cada sección como tabla (la barra repite el número de su fila).
 */

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

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);
const NOTA = cn(TYPE.meta, "mt-2 max-w-prose tabular-nums text-(--crm-text-2)");

/** Cifra de dinero de una tabla: "$" en gris + la cifra exacta en mono; sin valor, el texto que diga quien llama. */
function Monto({ valor, vacio = "—" }: { valor: number; vacio?: string }) {
  if (!valor) return <span className="text-(--crm-text-2)">{vacio}</span>;
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

/** Un vacío dentro del lugar de la tabla (con su borde), para que la sección no cambie de forma. */
function Vacio({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
      <EmptyState compact title={title} description={description} />
    </div>
  );
}

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
  const maxVendedor = Math.max(0, ...porVendedor.map((v) => v.monto));

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
  const maxMotivo = Math.max(0, ...motivos.map((m) => m.cantidad));

  const hrefDias = (n: number) => urlConParams("/tablero-comercial", sp, { dias: n === 14 ? null : String(n) });
  const hrefMes = (m: string) => urlConParams("/tablero-comercial", sp, { mes: m === hoy.slice(0, 7) ? null : m });
  const [anio, nroMes] = mes.split("-").map(Number);
  const anterior = nroMes === 1 ? `${anio - 1}-12` : `${anio}-${String(nroMes - 1).padStart(2, "0")}`;
  const siguiente = nroMes === 12 ? `${anio + 1}-01` : `${anio}-${String(nroMes + 1).padStart(2, "0")}`;
  const esMesActual = mes === hoy.slice(0, 7);
  const responsablesConPipeline = new Set(abiertas.map((o) => o.responsable_id).filter(Boolean)).size;

  const mesTexto = etiquetaMes(mes);
  const cerradasMes = cierres.ganadas.cantidad + cierres.perdidas.cantidad;

  return (
    <div className={cn(UI_ROOT, "min-h-full bg-(--crm-canvas) px-4 pb-6 xl:px-6")}>
      <PageBar title="Tablero comercial" />
      <div className="flex flex-col gap-6 pt-2">
        <StatStrip
          size="lg"
          label="Resumen del equipo"
          items={[
            {
              label: "Valor en juego del equipo",
              value: formatMoneyCompact(totalEnJuego).replace(/^\$/, ""),
              unit: "$",
              unitPosition: "before",
              detail: <span className="tabular-nums">{formatMoney(totalEnJuego)}</span>,
            },
            {
              label: "Oportunidades abiertas",
              value: abiertas.length,
              href: "/oportunidades",
              detail:
                responsablesConPipeline > 0
                  ? `de ${responsablesConPipeline} ${responsablesConPipeline === 1 ? "responsable" : "responsables"}`
                  : undefined,
            },
            // Sin bitácora no se sabe: se dice "—", no se muestra un 0.
            { label: `Quietas hace ${dias} días o más`, value: verBitacora ? quietas.length : undefined },
            { label: "Ganadas", value: cierres.ganadas.cantidad, detail: `en ${mesTexto}` },
            { label: "Perdidas", value: cierres.perdidas.cantidad, detail: `en ${mesTexto}` },
          ]}
        />
        {abiertasTruncadas && (
          <InlineBanner tone="warning">
            Se leyeron las {TOPE} oportunidades abiertas más antiguas de {abiertasRes.count}: el total puede quedar corto.
          </InlineBanner>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-12">
          {/* PIPELINE POR RESPONSABLE */}
          <section className="flex min-w-0 flex-col xl:col-span-6">
            <SectionBar title="Pipeline por responsable" count={porVendedor.length} />
            {porVendedor.length ? (
              <>
                <DataTable label="Pipeline por responsable">
                  <THead>
                    <Th>Responsable</Th>
                    <Th hideBelow="sm" className="w-[24%]">
                      <span className="sr-only">Proporción del valor</span>
                    </Th>
                    <Th width={128} align="right">
                      Valor
                    </Th>
                    <Th width={80} align="right">
                      Abiertas
                    </Th>
                  </THead>
                  <TBody>
                    {porVendedor.map((v) => (
                      <Tr key={v.key}>
                        <Td rowHeader className="whitespace-normal py-1.5">
                          {v.key === SIN_RESPONSABLE ? (
                            <span className="text-(--crm-text-2)">{v.label}</span>
                          ) : (
                            // El nombre baja de renglón en vez de recortarse (en el celular no hay tooltip).
                            <span className="flex min-w-0 items-start gap-2">
                              <Avatar name={v.label} size="xs" className="mt-px" />
                              <span className="min-w-0 break-words">{v.label}</span>
                            </span>
                          )}
                        </Td>
                        <Td hideBelow="sm">
                          <CellBar value={v.monto} max={maxVendedor} />
                        </Td>
                        <Td align="right">
                          <Monto valor={v.monto} />
                        </Td>
                        <Td align="right">
                          <CellNumber>{v.cantidad}</CellNumber>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                  <TFoot>
                    <Td rowHeader>Total</Td>
                    <Td hideBelow="sm" />
                    <Td align="right">
                      <Monto valor={totalEnJuego} />
                    </Td>
                    <Td align="right">
                      <CellNumber>{abiertas.length}</CellNumber>
                    </Td>
                  </TFoot>
                </DataTable>
                {abiertasTruncadas && (
                  <p className={NOTA}>
                    Se leyeron las {TOPE} abiertas más antiguas de {abiertasRes.count}: las cifras de cada responsable pueden quedar cortas.
                  </p>
                )}
              </>
            ) : (
              <Vacio title="No hay oportunidades abiertas" description="Cuando el equipo cargue consultas, acá se ve cuánta plata tiene cada uno en juego." />
            )}
          </section>

          {/* SIN ACTIVIDAD */}
          <section className="flex min-w-0 flex-col xl:col-span-6">
            <SectionBar title="Abiertas sin actividad" count={verBitacora ? quietas.length : undefined} />
            <nav aria-label="Días sin actividad" className="flex flex-wrap items-center gap-2 pb-2">
              <span className={cn(TYPE.table, "text-(--crm-text-2)")}>Quietas hace</span>
              <span className="inline-flex h-7 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) p-0.5">
                {OPCIONES_DIAS.map((n) => (
                  <Link
                    key={n}
                    href={hrefDias(n)}
                    scroll={false}
                    aria-current={n === dias ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center whitespace-nowrap rounded-[3px] px-2 text-[13px] font-medium transition-colors duration-(--crm-dur-fast)",
                      n === dias
                        ? "bg-(--crm-panel) text-(--crm-accent-text) ring-1 ring-(--crm-accent)"
                        : "text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
                      FOCUS,
                    )}
                  >
                    {n} días o más
                  </Link>
                ))}
              </span>
            </nav>

            {!verBitacora ? (
              <Vacio title="Tu rol no ve la bitácora" description="Sin las actividades no se puede saber qué oportunidades se enfriaron." />
            ) : quietas.length === 0 && inciertas.length === 0 ? (
              <Vacio
                title="Ninguna oportunidad quieta"
                description={`Todas las abiertas tuvieron movimiento en los últimos ${dias} días. Si alguna deja de hablarse, aparece acá.`}
              />
            ) : (
              <>
                <p className={cn(TYPE.meta, "max-w-prose pb-2 text-(--crm-text-2)")}>
                  Sin una actividad cargada hace {dias} días o más, en la oportunidad o en su cliente. Los cambios de etapa no cuentan.
                </p>
                {quietas.length === 0 ? (
                  <p className={cn(TYPE.table, "pb-2 font-medium")}>Ninguna con certeza, pero hay {inciertas.length} que no se pudieron comprobar.</p>
                ) : (
                  <TablaQuietas label="Abiertas sin actividad" filas={quietas.slice(0, FILAS_QUIETAS)} nombrePorId={nombrePorId} clientePorOportunidad={clientePorOportunidad} />
                )}
                {quietas.length > FILAS_QUIETAS && (
                  <p className={NOTA}>
                    Mostrando las {FILAS_QUIETAS} más quietas de {quietas.length}.
                  </p>
                )}
                {inciertas.length > 0 && (
                  <div className="mt-4 flex flex-col">
                    <SectionBar as="h3" title="No se pudo comprobar" count={inciertas.length} />
                    <p className={cn(TYPE.meta, "max-w-prose pb-2 text-(--crm-text-2)")}>
                      Las actividades leídas solo llegan hasta el {formatFecha(cobertura)} y estas no tienen ninguna desde entonces: pueden estar quietas o no.
                    </p>
                    <TablaQuietas label="No se pudo comprobar" filas={inciertas.slice(0, FILAS_QUIETAS)} nombrePorId={nombrePorId} clientePorOportunidad={clientePorOportunidad} />
                    {inciertas.length > FILAS_QUIETAS && (
                      <p className={NOTA}>
                        Mostrando {FILAS_QUIETAS} de {inciertas.length}.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {verBitacora && abiertasTruncadas && (
              <p className={NOTA}>
                Se evaluaron las {TOPE} abiertas más antiguas de {abiertasRes.count}: las más nuevas no entran en esta lista.
              </p>
            )}
            {verBitacora && actividadesTruncadas && (
              <p className={NOTA}>
                Se leyeron las {TOPE} actividades más recientes (desde el {formatFecha(cobertura)}). Las oportunidades sin actividad en ese tramo
                figuran con «más de» o «antes del».
              </p>
            )}
          </section>

          {/* CIERRES DEL MES */}
          <section aria-labelledby="titulo-cierres" className="flex min-w-0 flex-col xl:col-span-12">
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-(--crm-border)">
              <h2 id="titulo-cierres" className={TYPE.section}>
                Cierres del mes
              </h2>
              <nav aria-label="Elegir el mes" className="flex items-center gap-1">
                <Link
                  href={hrefMes(anterior)}
                  scroll={false}
                  aria-label={`Mes anterior: ${etiquetaMes(anterior)}`}
                  className={buttonClass({ size: "sm", className: "w-7 px-0" })}
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
                </Link>
                <span className="min-w-40 px-2 text-center text-[14px] font-medium tabular-nums first-letter:uppercase" aria-live="polite">
                  {mesTexto}
                </span>
                {esMesActual ? (
                  <span aria-hidden="true" className={buttonClass({ size: "sm", className: "pointer-events-none w-7 px-0 opacity-45" })}>
                    <ChevronRight strokeWidth={1.75} />
                  </span>
                ) : (
                  <Link
                    href={hrefMes(siguiente)}
                    scroll={false}
                    aria-label={`Mes siguiente: ${etiquetaMes(siguiente)}`}
                    className={buttonClass({ size: "sm", className: "w-7 px-0" })}
                  >
                    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                  </Link>
                )}
              </nav>
            </div>

            <div className="grid items-start gap-6 pt-2 xl:grid-cols-12">
              <section className="flex min-w-0 flex-col xl:col-span-6">
                <SectionBar as="h3" title="Ganadas y perdidas" count={cerradasMes} />
                <DataTable label="Ganadas y perdidas">
                  <THead>
                    <Th>Resultado</Th>
                    <Th width={96} align="right">
                      Cantidad
                    </Th>
                    <Th width={144} align="right">
                      Monto
                    </Th>
                  </THead>
                  <TBody>
                    <Tr>
                      <Td rowHeader>
                        <StatusDot tone="success">Ganadas</StatusDot>
                      </Td>
                      <Td align="right">
                        <CellNumber>{cierres.ganadas.cantidad}</CellNumber>
                      </Td>
                      <Td align="right">
                        <Monto valor={cierres.ganadas.monto} vacio="Sin monto" />
                      </Td>
                    </Tr>
                    <Tr>
                      <Td rowHeader>
                        <StatusDot tone="danger">Perdidas</StatusDot>
                      </Td>
                      <Td align="right">
                        <CellNumber>{cierres.perdidas.cantidad}</CellNumber>
                      </Td>
                      <Td align="right">
                        <Monto valor={cierres.perdidas.monto} vacio="Sin monto" />
                      </Td>
                    </Tr>
                  </TBody>
                </DataTable>
                <p className={NOTA}>
                  Por fecha real de cierre dentro de {mesTexto}.{" "}
                  {cerradasMes > 0 ? `Se ganó ${Math.round((cierres.ganadas.cantidad / cerradasMes) * 100)}% de lo que se cerró.` : "Ese mes no hubo cierres."}
                  {cerradasTruncadas && ` Se leyeron los ${TOPE} cierres más recientes de ${cerradasRes.count}: faltan los anteriores.`}
                </p>
              </section>

              <section className="flex min-w-0 flex-col xl:col-span-6">
                <SectionBar
                  as="h3"
                  title="Por qué se pierde"
                  count={motivos.length ? motivos.length : undefined}
                  actions={
                    motivos.length > 0 && (
                      <Link href="/oportunidades?vista=lista&estado=perdida" className={cn(TYPE.table, LINK)}>
                        Ver las perdidas
                      </Link>
                    )
                  }
                />
                {motivos.length ? (
                  <DataTable label="Por qué se pierde">
                    <THead>
                      <Th>Motivo</Th>
                      <Th hideBelow="sm" className="w-[24%]">
                        <span className="sr-only">Proporción de las perdidas</span>
                      </Th>
                      <Th width={88} align="right">
                        Perdidas
                      </Th>
                      <Th width={128} align="right">
                        Monto
                      </Th>
                    </THead>
                    <TBody>
                      {motivos.map((m) => (
                        <Tr key={m.key}>
                          <Td rowHeader className="whitespace-normal py-1.5">
                            {m.label}
                          </Td>
                          <Td hideBelow="sm">
                            <CellBar value={m.cantidad} max={maxMotivo} />
                          </Td>
                          <Td align="right">
                            <CellNumber>{m.cantidad}</CellNumber>
                          </Td>
                          <Td align="right">
                            <Monto valor={m.monto} />
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </DataTable>
                ) : (
                  <Vacio
                    title={cierres.perdidas.cantidad ? "Sin motivos cargados" : "Ninguna perdida este mes"}
                    description={cierres.perdidas.cantidad ? undefined : "Cuando se cierre una como perdida, el motivo se cuenta acá."}
                  />
                )}
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

type TablaQuietasProps = {
  label: string;
  filas: OportunidadSinActividad[];
  nombrePorId: Map<string, string>;
  clientePorOportunidad: Map<string, string | null>;
};

/**
 * Oportunidades quietas (o que no se pudieron comprobar). Con menos de 45rem de tabla la última actividad pasa a una
 * línea bajo el título, y con menos de 30rem también el valor: mismos datos en todo ancho, sin recortar cifras.
 */
function TablaQuietas({ label, filas, nombrePorId, clientePorOportunidad }: TablaQuietasProps) {
  return (
    <DataTable label={label}>
      <THead>
        <Th>Oportunidad</Th>
        <Th width={168} hideBelow="md">
          Última actividad
        </Th>
        <Th width={120} align="right" hideBelow="sm">
          Valor
        </Th>
        <Th width={136}>Quieta</Th>
      </THead>
      <TBody>
        {filas.map((q) => {
          const cliente = clientePorOportunidad.get(q.id);
          const responsable = q.responsableId ? nombrePorId.get(q.responsableId) : null;
          const fecha = q.masDe ? `antes del ${formatFecha(q.ultima)}` : formatFecha(q.ultima);
          return (
            <Tr key={q.id}>
              <Td className="whitespace-normal py-1.5">
                <Link href={`/oportunidades/${q.id}`} className={cn("rounded-[2px] font-medium text-(--crm-text) hover:underline", FOCUS)}>
                  {q.titulo}
                </Link>
                <span className={cn(TYPE.meta, "block text-(--crm-text-2)")}>{[responsable ?? "Sin responsable", cliente].filter(Boolean).join(" · ")}</span>
                <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[45rem]:hidden")}>
                  Última actividad {BASE_TEXTO[q.base]}: {fecha}
                  {q.monto > 0 && <span className="@[30rem]:hidden"> · {formatMoney(q.monto)}</span>}
                </span>
              </Td>
              <Td hideBelow="md" className="whitespace-normal py-1.5">
                <span className={cn(TYPE.mono, "block")}>{fecha}</span>
                <span className={cn(TYPE.meta, "block text-(--crm-text-2)")}>{BASE_TEXTO[q.base]}</span>
              </Td>
              <Td align="right" hideBelow="sm">
                <Monto valor={q.monto} />
              </Td>
              <Td>{q.incierta ? <StatusDot>Sin datos suficientes</StatusDot> : <StatusDot tone="warning">{`${q.masDe ? "Más de " : ""}${q.dias} días`}</StatusDot>}</Td>
            </Tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
