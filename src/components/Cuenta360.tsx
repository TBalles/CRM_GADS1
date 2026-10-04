"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  BellRing,
  CircleCheck,
  CircleX,
  Gauge,
  Handshake,
  History,
  Mail,
  MessageCircle,
  RotateCcw,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { ActividadFila } from "@/components/ActividadesTimeline";
import { Dato } from "@/components/cliente";
import { IconoEquipo } from "@/components/Equipamiento";
import { Button, Card, Pill, SectionTitle } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
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
  textoContacto,
  tramo,
  type Evento360,
  type Filtro360,
  type ResumenCuenta,
} from "@/lib/timeline360";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo">;

/* ------------------------------------------------------------------------ */
/* Resumen de la cuenta                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Las cifras de arriba de la ficha. Todo sale de las filas que la pantalla ya tiene: no hay
 * estimaciones ni IA, y lo que el rol no puede ver no se afirma (se esconde el dato, no se muestra 0).
 */
export function ResumenCuentaCard({
  resumen,
  mostrar,
  truncado,
}: {
  resumen: ResumenCuenta;
  mostrar: { ventas: boolean; oportunidades: boolean; contacto: boolean };
  truncado: { ventas: boolean; oportunidades: boolean };
}) {
  const { tonoContacto: tono } = resumen;
  const alerta = tono === "atencion" || tono === "frio";
  const frase = textoContacto(resumen.diasDesdeContacto, tono);

  return (
    <Card className="p-5">
      <SectionTitle icon={Gauge}>Resumen de la cuenta</SectionTitle>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        {mostrar.ventas && (
          <>
            <Dato label="Primera compra">
              {resumen.primeraCompra ? (
                <span className="tabular-nums">{formatFecha(resumen.primeraCompra)}</span>
              ) : (
                <span className="text-muted-foreground">Todavía no compró</span>
              )}
            </Dato>
            <Dato label="Total comprado">
              {resumen.cantidadCompras > 0 ? (
                <>
                  <span className="font-mono font-semibold tabular-nums">{formatMoney(resumen.totalComprado)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {truncado.ventas ? "sumando solo las últimas " : "en "}
                    {resumen.cantidadCompras} {resumen.cantidadCompras === 1 ? "compra" : "compras"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Sin compras</span>
              )}
            </Dato>
            <Dato label="Última compra">
              {resumen.ultimaCompra ? <span className="tabular-nums">{formatFecha(resumen.ultimaCompra)}</span> : null}
            </Dato>
          </>
        )}
        {mostrar.oportunidades && (
          <Dato label="Oportunidades abiertas">
            {resumen.abiertas.cantidad > 0 ? (
              <>
                <span className="font-semibold tabular-nums">
                  {resumen.abiertas.cantidad}
                  {truncado.oportunidades ? "+" : ""}
                </span>
                {resumen.abiertas.valor > 0 && (
                  <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                    {formatMoney(resumen.abiertas.valor)} en juego
                  </span>
                )}
                {truncado.oportunidades && (
                  <span className="block text-xs text-muted-foreground">entre las {TOPES.oportunidades} más recientes</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Ninguna abierta</span>
            )}
          </Dato>
        )}
        {mostrar.contacto && (
          <Dato label="Último contacto">
            <span
              className={cn(
                "flex items-start gap-1.5",
                // Ámbar AA (7.1:1 en claro, 8.9:1 en oscuro) y además ícono y frase: el aviso no depende del color.
                alerta ? "font-semibold text-amber-800 dark:text-amber-300" : tono === "sin-datos" ? "text-muted-foreground" : "",
              )}
            >
              {alerta && <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>{frase}</span>
            </span>
            {resumen.ultimoContacto && (
              <span className="block text-xs text-muted-foreground tabular-nums">el {formatFecha(resumen.ultimoContacto)}</span>
            )}
          </Dato>
        )}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Calculado con lo que está cargado en el CRM, sin estimaciones.</p>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Historia de la cuenta                                                     */
/* ------------------------------------------------------------------------ */

const ETIQUETA_FILTRO: Record<Filtro360, string> = {
  todo: "Todo",
  actividades: "Actividades",
  etapas: "Etapas",
  ventas: "Ventas",
  avisos: "Avisos",
};

type VerHistoria = { actividades: boolean; etapas: boolean; ventas: boolean; avisos: boolean };

export function HistoriaCuenta({
  actividades,
  cambios,
  oportunidades,
  ventas,
  avisos,
  etapas,
  tipos,
  perfiles,
  contactos = [],
  ver,
  truncado,
  accion,
  ia,
}: {
  actividades: Actividad[];
  cambios: CambioEtapaFila[];
  oportunidades: OportunidadCuenta[];
  ventas: VentaCuenta[];
  avisos: AvisoCuenta[];
  etapas: EtapaCuenta[];
  tipos: Tipo[];
  perfiles: { id: string; nombre: string }[];
  /** Para nombrar el contacto de cada actividad (solo en la ficha de la empresa). */
  contactos?: { id: string; label: string }[];
  /** Qué partes puede ver el rol; el resto ni se pide ni se ofrece. */
  ver: VerHistoria;
  truncado: { actividades: boolean; ventas: boolean; oportunidades: boolean; cambios: boolean; avisos: boolean };
  accion?: React.ReactNode;
  /** F7: el botón "Resumir con IA" y su panel. Solo llega si el servidor tiene la IA activada. */
  ia?: React.ReactNode;
}) {
  const [filtro, setFiltro] = useState<Filtro360>("todo");
  const [visibles, setVisibles] = useState(TAMANIO_TRAMO_360);
  const lista = useRef<HTMLDivElement>(null);

  const eventos = useMemo(
    () =>
      armarEventos360({
        actividades: ver.actividades ? actividades : [],
        cambios: ver.etapas ? cambios : [],
        oportunidades: ver.etapas ? oportunidades : [],
        ventas: ver.ventas ? ventas : [],
        avisos: ver.avisos ? avisos : [],
        tipoDeEtapa: new Map(etapas.map((e) => [e.id, e.tipo])),
      }),
    [actividades, cambios, oportunidades, ventas, avisos, etapas, ver],
  );

  const mapas = useMemo(
    () => ({
      actividad: new Map(actividades.map((a) => [a.id, a])),
      cambio: new Map(cambios.map((c) => [c.id, c])),
      oportunidad: new Map(oportunidades.map((o) => [o.id, o])),
      venta: new Map(ventas.map((v) => [v.id, v])),
      aviso: new Map(avisos.map((a) => [a.id, a])),
      etapa: new Map(etapas.map((e) => [e.id, e.nombre])),
      tipo: new Map(tipos.map((t) => [t.id, t])),
      autor: new Map(perfiles.map((p) => [p.id, p.nombre])),
      contacto: new Map(contactos.map((c) => [c.id, c.label])),
    }),
    [actividades, cambios, oportunidades, ventas, avisos, etapas, tipos, perfiles, contactos],
  );

  const cuentas = contarPorFiltro(eventos);
  const chips = FILTROS_360.filter(
    (f) => f === "todo" || (f === "actividades" ? ver.actividades : f === "etapas" ? ver.etapas : f === "ventas" ? ver.ventas : ver.avisos),
  );
  const filtrados = filtrarEventos(eventos, filtro);
  const { items, quedan } = tramo(filtrados, visibles);
  const grupos = agruparPorMes(items);

  // Cada tipo con su tope real: no todos son 200.
  const avisosTope = [
    truncado.actividades && `${TOPES.actividades} actividades`,
    truncado.ventas && `${TOPES.ventas} compras`,
    truncado.cambios && `${TOPES.cambios} cambios de etapa`,
    truncado.avisos && `${TOPES.avisos} avisos`,
    truncado.oportunidades && `${TOPES.oportunidades} oportunidades`,
  ].filter(Boolean) as string[];

  function elegir(f: Filtro360) {
    setFiltro(f);
    setVisibles(TAMANIO_TRAMO_360);
  }

  function verMas() {
    // Si este era el último tramo el botón desaparece: el foco pasa a la lista en vez de perderse.
    if (quedan <= TAMANIO_TRAMO_360) lista.current?.focus();
    setVisibles((v) => v + TAMANIO_TRAMO_360);
  }

  return (
    <Card className="p-5">
      <SectionTitle
        icon={History}
        right={
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">{cuentas.todo}</span>
            {accion}
          </div>
        }
      >
        Historia de la cuenta
      </SectionTitle>

      {ia}

      {chips.length > 1 && (
        <div role="group" aria-label="Filtrar la historia por tipo" className="mb-4 flex flex-wrap gap-2">
          {chips.map((f) => {
            const activo = filtro === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={activo}
                onClick={() => elegir(f)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  activo ? "border-brand bg-brand/10 text-brand" : "border-input bg-background text-foreground hover:bg-accent",
                )}
              >
                {ETIQUETA_FILTRO[f]}
                <span className="font-mono tabular-nums text-muted-foreground">{cuentas[f]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div ref={lista} tabIndex={-1} className="outline-none">
        {grupos.length === 0 ? (
          <EmptyState
            compact
            className="py-8"
            text={filtro === "todo" ? "Todavía no hay historia" : `Nada en «${ETIQUETA_FILTRO[filtro]}» todavía`}
            hint={
              filtro === "todo"
                ? "Cada llamada, cambio de etapa, entrega y aviso de recambio va a quedar acá, mes por mes."
                : "Probá con «Todo» para ver el resto de la historia."
            }
          />
        ) : (
          <div className="space-y-5">
            {grupos.map((g) => (
              <section key={g.mes} aria-labelledby={`mes-${g.mes}`}>
                <h4
                  id={`mes-${g.mes}`}
                  className="mb-3 border-b border-border pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {g.etiqueta}
                </h4>
                <ol className="space-y-3">
                  {g.eventos.map((e) => (
                    <Fila key={e.id} evento={e} mapas={mapas} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-muted-foreground tabular-nums">
          {filtrados.length > 0 && `Mostrando ${items.length} de ${filtrados.length}`}
        </p>
        {quedan > 0 && (
          <Button variant="outline" size="sm" onClick={verMas}>
            Ver {Math.min(quedan, TAMANIO_TRAMO_360)} más
          </Button>
        )}
      </div>

      {avisosTope.length > 0 && (
        <p className="mt-3 rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
          Se muestran solo los más recientes de cada tipo ({avisosTope.join(", ")}). Lo anterior no entra en esta línea de tiempo.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Una fila de la historia                                                   */
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

const claseFila = "flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0";

function Tile({ children, tono = "brand" }: { children: React.ReactNode; tono?: "brand" | "rojo" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        tono === "rojo" ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand",
      )}
    >
      {children}
    </span>
  );
}

function Autor({ nombre }: { nombre?: string | null }) {
  if (!nombre) return null;
  return (
    <span className="flex items-center gap-1">
      <UserRound aria-hidden="true" className="h-3 w-3 shrink-0" />
      {nombre}
    </span>
  );
}

const enlaceOportunidad =
  "rounded-sm hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Fila({ evento: e, mapas: m }: { evento: Evento360; mapas: Mapas }) {
  if (e.tipo === "actividad") {
    const a = m.actividad.get(e.refId);
    if (!a) return null;
    return (
      <ActividadFila
        actividad={a}
        tipo={m.tipo.get(a.tipo_actividad_id)}
        autor={a.autor_id ? m.autor.get(a.autor_id) : null}
        contacto={a.contacto_id ? m.contacto.get(a.contacto_id) : null}
        oportunidad={a.oportunidad_id ? m.oportunidad.get(a.oportunidad_id)?.titulo : null}
      />
    );
  }

  if (e.tipo === "oportunidad") {
    const o = m.oportunidad.get(e.refId);
    if (!o) return null;
    return (
      <li className={claseFila}>
        <Tile>
          <Handshake className="h-4 w-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">
              Oportunidad abierta:{" "}
              <Link href={`/oportunidades/${o.id}`} className={enlaceOportunidad}>
                {o.titulo}
              </Link>
            </p>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <time dateTime={e.cuando} className="tabular-nums">
              {formatMomento(e.cuando)}
            </time>
            {o.monto ? <span className="font-mono tabular-nums">{formatMoney(Number(o.monto))}</span> : null}
          </p>
        </div>
      </li>
    );
  }

  if (e.tipo === "etapa") {
    const c = m.cambio.get(e.refId);
    const o = e.oportunidadId ? m.oportunidad.get(e.oportunidadId) : undefined;
    if (!c) return null;
    const desde = c.etapa_anterior_id ? m.etapa.get(c.etapa_anterior_id) : null;
    const hacia = m.etapa.get(c.etapa_nueva_id);
    const Icono =
      e.resultado === "ganada" ? CircleCheck : e.resultado === "perdida" ? CircleX : e.titulo === "Reapertura" ? RotateCcw : ArrowRightLeft;
    return (
      <li className={claseFila}>
        <Tile tono={e.resultado === "perdida" ? "rojo" : "brand"}>
          <Icono className="h-4 w-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">
              {e.titulo}
              {o && (
                <>
                  {": "}
                  <Link href={`/oportunidades/${o.id}`} className={enlaceOportunidad}>
                    {o.titulo}
                  </Link>
                </>
              )}
            </p>
            {e.resultado === "ganada" && <Pill tono="verde">Ganada</Pill>}
            {e.resultado === "perdida" && <Pill tono="rojo">Perdida</Pill>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <time dateTime={e.cuando} className="tabular-nums">
              {formatMomento(e.cuando)}
            </time>
            <Autor nombre={c.usuario_id ? m.autor.get(c.usuario_id) : null} />
          </p>
          {hacia && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {desde ? `De ${desde} a ${hacia}` : `En ${hacia}`}
            </p>
          )}
          {c.observacion && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.observacion}</p>}
        </div>
      </li>
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
      <li className={claseFila}>
        {primero ? (
          <IconoEquipo nombre={primero.producto?.nombre} categoria={primero.producto?.categoria} className="mt-0.5 h-8 w-8" />
        ) : (
          <Tile>
            <ArrowRightLeft className="h-4 w-4" />
          </Tile>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">Compra{v.comprobante ? ` · ${v.comprobante}` : ""}</p>
            <Pill tono="verde">Venta</Pill>
            {v.total > 0 && <span className="font-mono text-xs font-semibold tabular-nums">{formatMoney(v.total)}</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <time dateTime={e.cuando} className="tabular-nums">
              {formatFecha(v.fecha)}
            </time>
          </p>
          {resumen && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {resumen}
              {mas > 0 ? ` y ${mas} más` : ""}
            </p>
          )}
        </div>
      </li>
    );
  }

  // aviso
  const av = m.aviso.get(e.refId);
  if (!av) return null;
  const porMail = av.canal === "email";
  const Canal = porMail ? Mail : MessageCircle;
  return (
    <li className={claseFila}>
      <Tile>
        <BellRing className="h-4 w-4" />
      </Tile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-semibold">Aviso de recambio</p>
          <Pill tono="ambar" className="gap-1">
            <Canal aria-hidden="true" className="h-3 w-3" />
            {porMail ? "Mail" : "WhatsApp"}
          </Pill>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <time dateTime={e.cuando} className="tabular-nums">
            {formatMomento(e.cuando)}
          </time>
          <Autor nombre={av.enviado_por ? m.autor.get(av.enviado_por) : null} />
        </p>
        <p className="mt-1.5 break-words text-sm text-muted-foreground">
          {av.producto} · a {av.destinatario}
        </p>
      </div>
    </li>
  );
}
