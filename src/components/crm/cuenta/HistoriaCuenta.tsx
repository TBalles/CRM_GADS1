"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  BellRing,
  CircleCheck,
  CircleDot,
  CircleX,
  Copy,
  Handshake,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "../Button";
import { EmptyState, InlineBanner } from "../Feedback";
import { StatusDot, Tag } from "../Status";
import { useCrmToast } from "../Toast";
import { FOCUS, TYPE, cn } from "../cx";
import { ICONO_POR_CODIGO } from "@/components/ActividadesTimeline";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { ComoUsamosIA } from "@/components/IaAviso";
import { useResumenIA } from "@/components/ResumenIA";
import { formatFecha, formatMomento } from "@/lib/clientes";
import { TOPES, type AvisoCuenta, type CambioEtapaFila, type EtapaCuenta, type OportunidadCuenta, type VentaCuenta } from "@/lib/cuenta360";
import { formatMoney } from "@/lib/money";
import {
  FILTROS_360,
  TAMANIO_TRAMO_360,
  agruparPorMes,
  armarEventos360,
  contarPorFiltro,
  filtrarEventos,
  tramo,
  type Evento360,
  type Filtro360,
} from "@/lib/timeline360";
import type { Tables } from "@/lib/supabase/types";

/**
 * Historia de la cuenta en CRM 2.0 (fichas de empresa y de contacto): la línea de tiempo que antes dibujaba
 * `Cuenta360.HistoriaCuenta` (legacy, retirado en el Lote A), armada con la misma lógica pura de `lib/timeline360.ts`.
 * Filas densas con hairline, ícono de 16 sin caja, meta en 12 secundario, fechas en mono.
 */

type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo">;

export type FuentesHistoria = {
  actividades: Actividad[];
  cambios: CambioEtapaFila[];
  oportunidades: OportunidadCuenta[];
  ventas: VentaCuenta[];
  avisos: AvisoCuenta[];
  etapas: EtapaCuenta[];
  tipos: Tipo[];
  perfiles: { id: string; nombre: string }[];
  /** Para nombrar el contacto de cada actividad (ficha de la empresa). */
  contactos?: { id: string; label: string }[];
  /** Qué partes puede ver el rol; el resto ni se pide ni se ofrece. */
  ver: { actividades: boolean; etapas: boolean; ventas: boolean; avisos: boolean };
};

const ETIQUETA_FILTRO: Record<Filtro360, string> = { todo: "Todo", actividades: "Actividades", etapas: "Etapas", ventas: "Ventas", avisos: "Avisos" };

/** Eventos ordenados y los mapas para dibujarlos. */
export function useEventos360(f: FuentesHistoria) {
  const { actividades, cambios, oportunidades, ventas, avisos, etapas, tipos, perfiles, contactos, ver } = f;
  const eventos = React.useMemo(
    () =>
      armarEventos360({
        actividades: ver.actividades ? actividades : [],
        cambios: ver.etapas ? cambios : [],
        oportunidades: ver.etapas ? oportunidades : [],
        ventas: ver.ventas ? ventas : [],
        avisos: ver.avisos ? avisos : [],
        tipoDeEtapa: new Map(etapas.map((e) => [e.id, e.tipo])),
      }),
    [actividades, cambios, oportunidades, ventas, avisos, etapas, ver.actividades, ver.etapas, ver.ventas, ver.avisos],
  );
  const mapas = React.useMemo<Mapas>(
    () => ({
      actividad: new Map(actividades.map((a) => [a.id, a])),
      cambio: new Map(cambios.map((c) => [c.id, c])),
      oportunidad: new Map(oportunidades.map((o) => [o.id, o])),
      venta: new Map(ventas.map((v) => [v.id, v])),
      aviso: new Map(avisos.map((a) => [a.id, a])),
      etapa: new Map(etapas.map((e) => [e.id, e.nombre])),
      tipo: new Map(tipos.map((t) => [t.id, t])),
      autor: new Map(perfiles.map((p) => [p.id, p.nombre])),
      contacto: new Map((contactos ?? []).map((c) => [c.id, c.label])),
    }),
    [actividades, cambios, oportunidades, ventas, avisos, etapas, tipos, perfiles, contactos],
  );
  return { eventos, mapas };
}

export function HistoriaCuenta({
  truncado,
  accion,
  ia,
  ...fuentes
}: FuentesHistoria & {
  truncado: { actividades: boolean; ventas: boolean; oportunidades: boolean; cambios: boolean; avisos: boolean };
  /** "Registrar actividad" (si el rol puede). */
  accion?: React.ReactNode;
  /** "Resumir con IA" (solo si el servidor tiene la IA activada). */
  ia?: React.ReactNode;
}) {
  const { eventos, mapas } = useEventos360(fuentes);
  const { ver } = fuentes;
  const [filtro, setFiltro] = React.useState<Filtro360>("todo");
  const [visibles, setVisibles] = React.useState(TAMANIO_TRAMO_360);
  const lista = React.useRef<HTMLDivElement>(null);

  const cuentas = contarPorFiltro(eventos);
  const chips = FILTROS_360.filter(
    (f) => f === "todo" || (f === "actividades" ? ver.actividades : f === "etapas" ? ver.etapas : f === "ventas" ? ver.ventas : ver.avisos),
  );
  const filtrados = filtrarEventos(eventos, filtro);
  const { items, quedan } = tramo(filtrados, visibles);
  const grupos = agruparPorMes(items);

  const avisosTope = [
    truncado.actividades && `${TOPES.actividades} actividades`,
    truncado.ventas && `${TOPES.ventas} compras`,
    truncado.cambios && `${TOPES.cambios} cambios de etapa`,
    truncado.avisos && `${TOPES.avisos} avisos`,
    truncado.oportunidades && `${TOPES.oportunidades} oportunidades`,
  ].filter(Boolean) as string[];

  function verMas() {
    // Si este era el último tramo el botón desaparece: el foco pasa a la lista en vez de perderse.
    if (quedan <= TAMANIO_TRAMO_360) lista.current?.focus();
    setVisibles((v) => v + TAMANIO_TRAMO_360);
  }

  return (
    <section aria-labelledby="historia-titulo" className="flex min-w-0 flex-col">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1">
        <div className="flex items-baseline gap-2">
          <h2 id="historia-titulo" className="text-[14px] font-semibold leading-5">
            Historia de la cuenta
          </h2>
          <span className={cn(TYPE.meta, TYPE.mono, "text-(--crm-text-2)")}>{cuentas.todo}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chips.length > 1 && (
            <div role="group" aria-label="Filtrar la historia por tipo" className="inline-flex flex-wrap rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) p-0.5">
              {chips.map((f) => {
                const activo = filtro === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      setFiltro(f);
                      setVisibles(TAMANIO_TRAMO_360);
                    }}
                    className={cn(
                      "inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-[3px] px-2 text-[13px] font-medium transition-colors duration-(--crm-dur-fast)",
                      activo ? "bg-(--crm-panel) text-(--crm-accent-text) ring-1 ring-(--crm-accent)" : "text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
                      FOCUS,
                    )}
                  >
                    {ETIQUETA_FILTRO[f]}
                    <span className={cn(TYPE.mono, "text-[12px] font-normal text-(--crm-text-2)")}>{cuentas[f]}</span>
                  </button>
                );
              })}
            </div>
          )}
          {accion}
        </div>
      </div>

      {ia}

      {/* Filas de libro mayor sobre el canvas (sin caja): una regla arriba, hairline entre filas, el mes como cabecera. */}
      <div ref={lista} tabIndex={-1} className="@container border-t border-(--crm-border) outline-none">
        {grupos.length === 0 ? (
          <EmptyState
            compact
            title={filtro === "todo" ? "Todavía no hay historia" : `Nada en «${ETIQUETA_FILTRO[filtro]}» todavía`}
            description={
              filtro === "todo"
                ? "Cada llamada, cambio de etapa, entrega y aviso de recambio va a quedar acá, mes por mes."
                : "Probá con «Todo» para ver el resto de la historia."
            }
          />
        ) : (
          grupos.map((g) => (
            <section key={g.mes} aria-labelledby={`mes-${g.mes}`}>
              <h3
                id={`mes-${g.mes}`}
                className={cn(TYPE.th, "border-b border-(--crm-border-strong) px-3 pb-2 pt-4 first-letter:uppercase")}
              >
                {g.etiqueta}
              </h3>
              <ol>
                {g.eventos.map((e) => (
                  <FilaEvento key={e.id} evento={e} mapas={mapas} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <p role="status" className={cn(TYPE.meta, "tabular-nums text-(--crm-text-2)")}>
          {filtrados.length > 0 && `Mostrando ${items.length} de ${filtrados.length}`}
        </p>
        {quedan > 0 && (
          <Button size="sm" onClick={verMas}>
            Ver {Math.min(quedan, TAMANIO_TRAMO_360)} más
          </Button>
        )}
      </div>
      {avisosTope.length > 0 && (
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          Se muestran solo los más recientes de cada tipo ({avisosTope.join(", ")}). Lo anterior no entra en esta línea de tiempo.
        </p>
      )}
    </section>
  );
}

/** Los últimos `limite` movimientos de la cuenta, en una lista compacta (panel de vista previa, resumen de la ficha). */
export function MovimientosRecientes({ limite = 5, vacio, ...fuentes }: FuentesHistoria & { limite?: number; vacio?: string }) {
  const { eventos, mapas } = useEventos360(fuentes);
  const items = eventos.slice(0, limite);
  if (items.length === 0) return <p className={cn(TYPE.table, "py-2 text-(--crm-text-2)")}>{vacio ?? "Todavía no hay movimientos."}</p>;
  return (
    <ol className="-mx-3">
      {items.map((e) => (
        <FilaEvento key={e.id} evento={e} mapas={mapas} compacta />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------ */

type Mapas = {
  actividad: Map<string, Actividad>;
  cambio: Map<string, CambioEtapaFila>;
  oportunidad: Map<string, OportunidadCuenta>;
  venta: Map<string, VentaCuenta>;
  aviso: Map<string, AvisoCuenta>;
  etapa: Map<string, string>;
  tipo: Map<string, Tipo>;
  autor: Map<string, string>;
  contacto: Map<string, string>;
};

const LINK = cn("rounded-[2px] font-medium text-(--crm-text) underline-offset-2 hover:underline", FOCUS);

/**
 * Una fila de la historia. Angosta (o `compacta`): ícono + título + una línea de meta (cuándo · quién · dato) + cuerpo.
 * Desde 48rem de contenedor es una fila de libro mayor: la fecha en su columna (mono), el hecho al medio y quién a la
 * derecha; así la tab de Actividad usa el ancho en vez de dejar media pantalla vacía. `compacta` omite el cuerpo.
 */
function Fila({
  icono,
  peligro,
  titulo,
  extra,
  cuando,
  quien = [],
  dato,
  cuerpo,
  compacta,
}: {
  icono: React.ReactNode;
  peligro?: boolean;
  titulo: React.ReactNode;
  extra?: React.ReactNode;
  cuando: React.ReactNode;
  /** Autor, contacto, oportunidad: la columna de la derecha (en angosto, la línea de meta). */
  quien?: React.ReactNode[];
  /** Cifra o dato corto junto a la meta (monto; "De X a Y" en compacta). */
  dato?: React.ReactNode;
  cuerpo?: React.ReactNode;
  compacta?: boolean;
}) {
  const personas = quien.filter(Boolean);
  const icon = (
    <span aria-hidden="true" className={cn("mt-px flex size-4 shrink-0 [&_svg]:size-4", peligro ? "text-(--crm-danger)" : "text-(--crm-text-2)")}>
      {icono}
    </span>
  );
  const cabeza = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <p className={cn(TYPE.table, "min-w-0 font-medium", compacta && "truncate")}>{titulo}</p>
      {extra}
    </div>
  );
  const meta = (soloAngosto: boolean) => (
    <p className={cn(TYPE.meta, "mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-(--crm-text-2)")}>
      <span className={cn(soloAngosto && "@[48rem]:hidden")}>{cuando}</span>
      {personas.map((p, i) => (
        <span key={i} className={cn(soloAngosto && "@[48rem]:hidden")}>
          {p}
        </span>
      ))}
      {dato}
    </p>
  );
  if (compacta) {
    return (
      <li className="flex gap-3 border-b border-(--crm-border) px-3 py-2 last:border-b-0">
        {icon}
        <div className="min-w-0 flex-1">
          {cabeza}
          {meta(false)}
        </div>
      </li>
    );
  }
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border-b border-(--crm-border) px-3 py-2.5 @[48rem]:grid-cols-[11rem_1rem_minmax(0,1fr)_minmax(0,13rem)]">
      <p className={cn(TYPE.meta, "hidden whitespace-nowrap pt-px text-(--crm-text-2) @[48rem]:block")}>{cuando}</p>
      {icon}
      <div className="min-w-0">
        {cabeza}
        {meta(true)}
        {cuerpo}
      </div>
      <div className={cn(TYPE.meta, "hidden min-w-0 flex-col gap-0.5 pt-px text-(--crm-text-2) @[48rem]:flex")}>
        {personas.map((p, i) => (
          <span key={i} className="truncate">
            {p}
          </span>
        ))}
      </div>
    </li>
  );
}

function Cuando({ iso, fecha }: { iso: string; fecha?: string }) {
  return (
    <time dateTime={iso} className={TYPE.mono}>
      {fecha ? formatFecha(fecha) : formatMomento(iso)}
    </time>
  );
}

const PROSA = cn(TYPE.table, "mt-1 max-w-prose whitespace-pre-line break-words text-(--crm-text-2) leading-[1.55]");

function FilaEvento({ evento: e, mapas: m, compacta }: { evento: Evento360; mapas: Mapas; compacta?: boolean }) {
  if (e.tipo === "actividad") {
    const a = m.actividad.get(e.refId);
    if (!a) return null;
    const tipo = m.tipo.get(a.tipo_actividad_id);
    const Icono = (tipo?.codigo && ICONO_POR_CODIGO[tipo.codigo]) || CircleDot;
    const autor = a.autor_id ? m.autor.get(a.autor_id) : null;
    const contacto = a.contacto_id ? m.contacto.get(a.contacto_id) : null;
    const oportunidad = a.oportunidad_id ? m.oportunidad.get(a.oportunidad_id)?.titulo : null;
    return (
      <Fila
        compacta={compacta}
        icono={<Icono strokeWidth={1.75} />}
        peligro={tipo?.codigo === "queja"}
        titulo={a.titulo}
        extra={<Tag>{tipo?.nombre ?? "Actividad"}</Tag>}
        cuando={<Cuando iso={a.ocurrido_en} />}
        quien={[
          autor && (
            <>
              <span className="sr-only">Registró </span>
              {autor}
            </>
          ),
          contacto && `con ${contacto}`,
          !compacta && oportunidad && (
            <>
              <span className="sr-only">Oportunidad: </span>
              {oportunidad}
            </>
          ),
        ]}
        cuerpo={
          <>
            {a.detalle && <p className={PROSA}>{a.detalle}</p>}
            {a.resultado && (
              <p className={cn(TYPE.table, "mt-1")}>
                <span className="font-medium">Resultado: </span>
                {a.resultado}
              </p>
            )}
          </>
        }
      />
    );
  }

  if (e.tipo === "oportunidad") {
    const o = m.oportunidad.get(e.refId);
    if (!o) return null;
    return (
      <Fila
        compacta={compacta}
        icono={<Handshake strokeWidth={1.75} />}
        titulo={
          <>
            Oportunidad abierta:{" "}
            <Link href={`/oportunidades/${o.id}`} className={LINK}>
              {o.titulo}
            </Link>
          </>
        }
        cuando={<Cuando iso={e.cuando} />}
        dato={o.monto ? <span className={cn(TYPE.mono, "text-(--crm-text)")}>{formatMoney(Number(o.monto))}</span> : null}
      />
    );
  }

  if (e.tipo === "etapa") {
    const c = m.cambio.get(e.refId);
    const o = e.oportunidadId ? m.oportunidad.get(e.oportunidadId) : undefined;
    if (!c) return null;
    const desde = c.etapa_anterior_id ? m.etapa.get(c.etapa_anterior_id) : null;
    const hacia = m.etapa.get(c.etapa_nueva_id);
    const Icono = e.resultado === "ganada" ? CircleCheck : e.resultado === "perdida" ? CircleX : e.titulo === "Reapertura" ? RotateCcw : ArrowRightLeft;
    const autor = c.usuario_id ? m.autor.get(c.usuario_id) : null;
    return (
      <Fila
        compacta={compacta}
        icono={<Icono strokeWidth={1.75} />}
        peligro={e.resultado === "perdida"}
        titulo={
          <>
            {e.titulo}
            {o && (
              <>
                {": "}
                <Link href={`/oportunidades/${o.id}`} className={LINK}>
                  {o.titulo}
                </Link>
              </>
            )}
          </>
        }
        extra={
          e.resultado === "ganada" ? (
            <StatusDot tone="success">Ganada</StatusDot>
          ) : e.resultado === "perdida" ? (
            <StatusDot tone="danger">Perdida</StatusDot>
          ) : undefined
        }
        cuando={<Cuando iso={e.cuando} />}
        quien={[autor]}
        dato={compacta && hacia ? <span>{desde ? `De ${desde} a ${hacia}` : `En ${hacia}`}</span> : null}
        cuerpo={
          <>
            {hacia && <p className={cn(TYPE.table, "mt-1 text-(--crm-text-2)")}>{desde ? `De ${desde} a ${hacia}` : `En ${hacia}`}</p>}
            {c.observacion && <p className={PROSA}>{c.observacion}</p>}
          </>
        }
      />
    );
  }

  if (e.tipo === "venta") {
    const v = m.venta.get(e.refId);
    if (!v) return null;
    const primero = v.items[0];
    const resumen = v.items
      .slice(0, 3)
      .map((i) => `${i.cantidad} × ${i.producto?.nombre ?? "producto"}`)
      .join(", ");
    const mas = v.items.length - 3;
    return (
      <Fila
        compacta={compacta}
        icono={primero ? <IconoEquipoSimple nombre={primero.producto?.nombre} categoria={primero.producto?.categoria} className="size-4" /> : <ArrowRightLeft strokeWidth={1.75} />}
        titulo={`Compra${v.comprobante ? ` · ${v.comprobante}` : ""}`}
        extra={<Tag>Venta</Tag>}
        cuando={<Cuando iso={e.cuando} fecha={v.fecha} />}
        dato={v.total > 0 ? <span className={cn(TYPE.mono, "text-(--crm-text)")}>{formatMoney(v.total)}</span> : null}
        cuerpo={
          resumen ? (
            <p className={cn(TYPE.table, "mt-1 text-(--crm-text-2)")}>
              {resumen}
              {mas > 0 ? ` y ${mas} más` : ""}
            </p>
          ) : undefined
        }
      />
    );
  }

  const av = m.aviso.get(e.refId);
  if (!av) return null;
  const autor = av.enviado_por ? m.autor.get(av.enviado_por) : null;
  return (
    <Fila
      compacta={compacta}
      icono={<BellRing strokeWidth={1.75} />}
      titulo="Aviso de recambio"
      extra={<Tag>{av.canal === "email" ? "Mail" : "WhatsApp"}</Tag>}
      cuando={<Cuando iso={e.cuando} />}
      quien={[autor]}
      cuerpo={
        <p className={cn(TYPE.table, "mt-1 break-words text-(--crm-text-2)")}>
          {av.producto} · a {av.destinatario}
        </p>
      }
    />
  );
}

/**
 * "Resumir con IA" con primitivos de CRM 2.0. La lógica y la Server Action son las de `ResumenIA` (`useResumenIA`): el
 * resumen no se guarda ni se envía. Solo se monta si el servidor tiene la IA activada.
 */
export function ResumenIACrm({ tipo, id }: { tipo: "empresa" | "contacto"; id: string }) {
  const { showToast } = useCrmToast();
  const { cargando, texto, error, resumir, copiar, cerrar } = useResumenIA(tipo, id, showToast);
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button size="sm" icon={Sparkles} loading={cargando} onClick={resumir}>
          {cargando ? "Resumiendo…" : texto ? "Volver a resumir" : "Resumir con IA"}
        </Button>
        <ComoUsamosIA />
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {cargando ? "Armando el resumen con IA…" : texto ? "Resumen generado con IA listo para revisar." : ""}
      </div>
      {error && <InlineBanner tone="danger">{error}</InlineBanner>}
      {texto && (
        <section aria-label="Resumen generado con IA" className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={cn(TYPE.meta, "inline-flex items-center gap-1.5 font-medium text-(--crm-accent-text)")}>
              <Sparkles aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
              Generado con IA: revisalo antes de usarlo, puede tener errores
            </p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={Copy} onClick={copiar}>
                Copiar
              </Button>
              <Button variant="ghost" size="sm" icon={RefreshCw} disabled={cargando} onClick={resumir}>
                Regenerar
              </Button>
              <Button variant="ghost" size="sm" icon={X} onClick={cerrar}>
                Cerrar
              </Button>
            </div>
          </div>
          <p className="max-w-prose whitespace-pre-line text-[14px] leading-[1.55]">{texto}</p>
          <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>No se guarda en el CRM: si lo querés conservar, copialo o registralo como una actividad.</p>
        </section>
      )}
    </div>
  );
}
