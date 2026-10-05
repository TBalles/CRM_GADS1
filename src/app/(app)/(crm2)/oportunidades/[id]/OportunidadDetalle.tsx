"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowRightLeft, CircleCheck, CircleX, FileClock, FileText, NotebookPen, Pencil, Plus, RotateCcw, UserCog } from "lucide-react";
import { Button, buttonClass } from "@/components/crm/Button";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { DetailHeader, SectionBar } from "@/components/crm/PageBar";
import { DefinitionList, type Definition } from "@/components/crm/Panel";
import { Avatar, StatusDot, Tag } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { ActividadDrawer } from "@/components/crm/cuenta/ActividadDrawer";
import { CampoOpciones, FormDrawer, useApertura } from "@/components/crm/cuenta/FormDrawer";
import { CuandoHistoria, FilaActividad, FilaHistoria, PROSA } from "@/components/crm/cuenta/HistoriaCuenta";
import { RielDatos } from "@/components/crm/cuenta/SeccionesCuenta";
import { EstadoOportunidad } from "@/components/crm/cuenta/estados";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, formatFechaAlta } from "@/lib/clientes";
import { bloqueoGanada, datosApertura, textoApertura } from "@/lib/licitaciones";
import { formatMoney } from "@/lib/money";
import {
  accionesDisponibles,
  describirCambios,
  etapaRepiteEstado,
  lineaDeTiempo,
  mensajeErrorOportunidad,
  pasosEmbudo,
  textoCerrada,
  tituloCambioEtapa,
  type ResolverId,
} from "@/lib/oportunidades";
import type { Tables } from "@/lib/supabase/types";
import CierreDialog, { ACCION_CAMBIO, useCierre } from "../CierreDialog";
import OportunidadForm from "../OportunidadForm";
import type { Opciones } from "../datos";
import { sinTrabarse } from "@/lib/guardar";

type Oportunidad = Tables<"oportunidades">;
type Historial = Tables<"oportunidad_etapas_historial">;
type Auditoria = Tables<"oportunidad_auditoria">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;
type Licitacion = Tables<"licitaciones">;

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);

/**
 * Ficha de una oportunidad (CRM 2.0, MASTER.md §10.19). Franja de identidad (h1 = título exacto, estado, etapa, tipo,
 * valor, responsable, empresa) con UNA primaria ("Registrar actividad"), "Presupuesto" a la vista y "Más acciones"
 * (Reasignar, Editar); debajo, el recorrido por el embudo (solo lectura) con las acciones de etapa al lado ("Cambiar
 * etapa", "Marcar ganada", "Marcar perdida" / "Reabrir", "Cambiar resultado", con las reglas de `accionesDisponibles`).
 * Cuerpo sin cajas: licitación, historial (actividades + cambios de etapa) y auditoría a la izquierda; riel "Datos" a
 * la derecha. Cada mutación hace `router.refresh()`: los datos vienen del servidor, sin copias locales.
 */
export default function OportunidadDetalle({
  oportunidad,
  historial,
  auditoria,
  actividades,
  tipos,
  opciones,
  licitacion,
  licitacionesActivas,
  hoy,
  yoId,
  puedeEditar,
  puedeAsignar,
  puedeReabrir,
  puedeVerActividades,
  puedeEscribirActividad,
  puedeVerClientes,
}: {
  oportunidad: Oportunidad;
  historial: Historial[];
  auditoria: Auditoria[];
  actividades: Actividad[];
  tipos: Tipo[];
  opciones: Opciones;
  /** Datos de la licitacion (F4); null si todavia no se cargaron. */
  licitacion: Licitacion | null;
  /** Las tablas del rubro (migracion 0011) existen en la base. */
  licitacionesActivas: boolean;
  /** Hoy en Argentina, calculado en el servidor (asi no cambia entre el render del servidor y el del cliente). */
  hoy: string;
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeReabrir: boolean;
  puedeVerActividades: boolean;
  puedeEscribirActividad: boolean;
  puedeVerClientes: boolean;
}) {
  const router = useRouter();
  const refrescar = () => router.refresh();
  const { etapas, empresas, contactos, productos, perfiles, origenes, motivos } = opciones;
  const cierre = useCierre();
  const editor = useApertura<true>();
  const reasignar = useApertura<true>();
  const actividad = useApertura<true>();

  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const motivoPorId = useMemo(() => new Map(motivos.map((m) => [m.id, m.nombre])), [motivos]);
  const origenPorId = useMemo(() => new Map(origenes.map((o) => [o.id, o.nombre])), [origenes]);

  const etapa = etapaPorId.get(oportunidad.etapa_id);
  const empresa = empresas.find((e) => e.id === oportunidad.empresa_id);
  const contacto = contactos.find((c) => c.id === oportunidad.contacto_id);
  const producto = productos.find((p) => p.id === oportunidad.producto_id);
  const cerrada = oportunidad.estado !== "abierta";
  // La empresa o el contacto existen pero esta pantalla no los trae: son de la cartera de otra persona,
  // o el rol no tiene `clientes.ver`. No se afirma cual de las dos.
  const sinAcceso = puedeVerClientes ? "De otra cartera" : "Sin acceso";
  const modos = accionesDisponibles(oportunidad.estado, { puedeEditar, puedeReabrir });
  const esLicitacion = licitacionesActivas && oportunidad.tipo === "licitacion";
  const apertura = datosApertura(oportunidad.tipo, licitacionesActivas, licitacion);
  // Mientras una licitacion abierta no llegue a su apertura (o no tenga datos), no se puede ganar.
  const avisoApertura = oportunidad.estado === "abierta" ? bloqueoGanada(apertura, hoy) : null;
  const responsable = oportunidad.responsable_id ? (perfilPorId.get(oportunidad.responsable_id) ?? "Usuario no disponible") : null;
  const puedeRegistrar = puedeEscribirActividad && puedeVerActividades;
  const pasos = pasosEmbudo(etapas, oportunidad.etapa_id, oportunidad.estado);

  // Después de cerrar, reabrir o cambiar el resultado, el botón que abrió el diálogo deja de existir (cambian las
  // acciones): el foco va a la primera acción de etapa que haya ahora y, si no queda ninguna (un rol sin
  // `oportunidades.reabrir` que acaba de cerrarla), al aviso de cerrada. Nunca al <body>.
  const accionesEtapa = useRef<HTMLDivElement>(null);
  const avisoCerrada = useRef<HTMLDivElement>(null);
  const focoTrasCambio = useRef(false);
  useEffect(() => {
    if (!focoTrasCambio.current) return;
    focoTrasCambio.current = false;
    const activo = document.activeElement;
    if (activo && activo !== document.body && activo.isConnected) return;
    (accionesEtapa.current?.querySelector<HTMLElement>("button") ?? avisoCerrada.current)?.focus();
  }, [oportunidad.estado, oportunidad.etapa_id]);

  // En el celular el recorrido scrollea de costado: la etapa actual queda a la vista y el borde que tiene más etapas se
  // desvanece (como las tabs), así se ve que sigue.
  const recorrido = useRef<HTMLOListElement>(null);
  const [mas, setMas] = useState({ izq: false, der: false });
  useEffect(() => {
    const ol = recorrido.current;
    if (!ol) return;
    const actual = ol.querySelector<HTMLElement>('[aria-current="step"]');
    if (actual && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = actual.offsetLeft - ol.offsetLeft - 24;
    const medir = () => setMas({ izq: ol.scrollLeft > 1, der: ol.scrollLeft + ol.clientWidth < ol.scrollWidth - 1 });
    medir();
    ol.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(ol);
    return () => {
      ol.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, [oportunidad.etapa_id]);

  const resolver: ResolverId = (campo, id) => {
    switch (campo) {
      case "etapa_id":
        return etapaPorId.get(id)?.nombre;
      case "responsable_id":
        return perfilPorId.get(id);
      case "empresa_id":
        return empresas.find((e) => e.id === id)?.label;
      case "contacto_id":
        return contactos.find((c) => c.id === id)?.label;
      case "producto_id":
        return productos.find((p) => p.id === id)?.label;
      case "origen_id":
        return origenPorId.get(id);
      case "motivo_perdida_id":
        return motivoPorId.get(id);
    }
  };

  const tiempo = lineaDeTiempo(actividades, historial);
  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const contactosNombres = new Map(contactos.map((c) => [c.id, c.label]));

  const clienteLink = (id: string | null, visible: { id: string; label: string } | undefined, ruta: string) =>
    id ? visible && puedeVerClientes ? <Link href={`${ruta}/${visible.id}`} className={LINK}>{visible.label}</Link> : sinAcceso : null;

  // El riel no repite la franja de identidad (estado, etapa, tipo, valor, responsable y empresa están arriba).
  const datos: Definition[] = [
    { term: "Contacto", value: clienteLink(oportunidad.contacto_id, contacto, "/contactos") },
    { term: "Producto / servicio", value: producto?.label },
    { term: "Probabilidad", value: oportunidad.probabilidad != null ? `${oportunidad.probabilidad}%` : null, mono: true },
    { term: "Fecha estimada de cierre", value: oportunidad.fecha_estimada_cierre ? formatFecha(oportunidad.fecha_estimada_cierre) : null, mono: true },
    { term: "Fecha real de cierre", value: oportunidad.fecha_cierre ? formatFecha(oportunidad.fecha_cierre) : null, mono: true },
    { term: "Origen", value: oportunidad.origen_id ? origenPorId.get(oportunidad.origen_id) : null },
    ...(oportunidad.estado === "perdida"
      ? [{ term: "Motivo de pérdida", value: oportunidad.motivo_perdida_id ? motivoPorId.get(oportunidad.motivo_perdida_id) : null }]
      : []),
    { term: "Alta", value: formatFechaAlta(oportunidad.created_at), mono: true },
  ];

  const registrar = puedeRegistrar ? (
    <Button variant="primary" icon={NotebookPen} onClick={() => actividad.abrir(true)}>
      Registrar actividad
    </Button>
  ) : null;
  // Sin permiso para registrar, "Editar" pasa a ser la primaria (y el `⋮` queda con el resto).
  const primaria =
    registrar ??
    (puedeEditar ? (
      <Button variant="primary" icon={Pencil} onClick={() => editor.abrir(true)}>
        Editar
      </Button>
    ) : null);
  const masAcciones: MenuItem[] = [
    ...(puedeAsignar ? [{ label: "Reasignar", icon: UserCog, onSelect: () => reasignar.abrir(true) }] : []),
    ...(puedeEditar && registrar ? [{ label: "Editar", icon: Pencil, onSelect: () => editor.abrir(true) }] : []),
  ];

  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas)")}>
      <DetailHeader
        title={oportunidad.titulo}
        meta={
          <>
            <span className="text-(--crm-text)">
              <EstadoOportunidad estado={oportunidad.estado} />
            </span>
            {/* Una etapa de cierre que se llama como el estado ("Perdida") no se repite: lo dice el estado. */}
            {!etapaRepiteEstado(etapa, oportunidad.estado) && (
              <StatusDot color={etapa?.color}>
                <span className="sr-only">Etapa: </span>
                {etapa?.nombre ?? "—"}
              </StatusDot>
            )}
            {oportunidad.tipo === "licitacion" && <Tag>Licitación</Tag>}
            <span className={cn(TYPE.mono, oportunidad.monto ? "text-(--crm-text)" : undefined)}>
              <span className="sr-only">Valor estimado: </span>
              {oportunidad.monto ? formatMoney(Number(oportunidad.monto)) : "Sin valor estimado"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {responsable && <Avatar name={responsable} size="xs" />}
              <span>
                <span className="sr-only">Responsable: </span>
                {responsable ?? "Sin asignar"}
              </span>
            </span>
            {oportunidad.empresa_id && (
              <span>
                <span className="sr-only">Empresa: </span>
                {clienteLink(oportunidad.empresa_id, empresa, "/empresas")}
              </span>
            )}
          </>
        }
        actions={
          <>
            {primaria}
            {/* El presupuesto se arma desde acá: a la vista, al lado de la primaria (mismo link y acceso que antes). */}
            <Link href={`/oportunidades/${oportunidad.id}/presupuesto`} className={buttonClass({ variant: "secondary" })}>
              <FileText aria-hidden="true" strokeWidth={1.75} />
              Presupuesto
            </Link>
            {masAcciones.length > 0 && <Menu label="Más acciones" items={masAcciones} />}
          </>
        }
        tabs={
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
            {/* Con poco ancho (< 1280) el recorrido ocupa su propio renglón y las acciones van debajo. */}
            <ol
              ref={recorrido}
              aria-label="Recorrido por el embudo"
              className={cn(
                "flex min-w-0 flex-1 basis-full snap-x gap-1 overflow-x-auto scroll-px-6 [scrollbar-width:none] xl:basis-0",
                mas.der && mas.izq
                  ? "[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-32px),transparent)]"
                  : mas.der
                    ? "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
                    : mas.izq && "[mask-image:linear-gradient(to_right,transparent,black_24px)]",
              )}
            >
              {pasos.abiertas.map((p) => (
                <Paso key={p.id} nombre={p.nombre} color={p.color} paso={p.paso} />
              ))}
              <Paso
                nombre={pasos.cierre.nombre}
                paso={pasos.cierre.paso}
                tono={cerrada ? (oportunidad.estado === "ganada" ? "success" : "danger") : undefined}
              />
            </ol>
            {modos.length > 0 && (
              // Jerarquía: mover (o reabrir) es la acción de etapa principal (secundaria con borde); cerrar como ganada o
              // perdida (o cambiar el resultado) va callada, sin caja, después de un divisor, con el ícono en el color
              // de lo que hace. Siguen siendo <button> con los nombres de siempre (E2E aprieta "Marcar perdida").
              <div ref={accionesEtapa} role="group" aria-label="Acciones de etapa" className="flex flex-wrap items-center gap-1">
                {modos.map((modo, i) => (
                  <Fragment key={modo}>
                    {i === 1 && <span aria-hidden="true" className="mx-1 h-5 w-px bg-(--crm-border)" />}
                    <Button
                      size="sm"
                      variant={i === 0 ? "secondary" : "ghost"}
                      icon={ACCION_CAMBIO[modo].icon}
                      className={cn(
                        i > 0 && "text-(--crm-text)",
                        modo === "ganada" && "[&_svg]:text-(--crm-success)",
                        modo === "perdida" && "[&_svg]:text-(--crm-danger)",
                      )}
                      onClick={() => cierre.abrir({ modo, oportunidad, licitacion: apertura })}
                    >
                      {ACCION_CAMBIO[modo].label}
                    </Button>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        }
      />

      <div className="grid min-w-0 flex-1 items-start gap-x-6 gap-y-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:px-6">
        <div className="flex min-w-0 flex-col gap-5">
          {cerrada && (
            // Perder una oportunidad no es un error: aviso neutro (hairline, punto de éxito o pérdida + texto), no una caja
            // teñida. `role="status"` (E2E lo busca así: "Perdida el dd/mm/aaaa"). Recibe el foco tras cerrarla si no
            // queda ninguna acción de etapa.
            <div
              ref={avisoCerrada}
              tabIndex={-1}
              role="status"
              className={cn("flex flex-col gap-0.5 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3 py-2", FOCUS)}
            >
              <p className="font-medium">
                <StatusDot tone={oportunidad.estado === "ganada" ? "success" : "danger"}>{textoCerrada(oportunidad.estado, oportunidad.fecha_cierre)}</StatusDot>
              </p>
              <p className={cn(TYPE.ui, "text-(--crm-text-2)")}>
                {oportunidad.estado === "perdida" && oportunidad.motivo_perdida_id && (
                  <>
                    <span className="text-(--crm-text)">Motivo: {motivoPorId.get(oportunidad.motivo_perdida_id) ?? "no disponible"}.</span>{" "}
                  </>
                )}
                Está cerrada: corregirla queda registrado en la auditoría
                {puedeReabrir ? ", y podés reabrirla." : ". Reabrirla lo hace quien tiene ese permiso."}
              </p>
            </div>
          )}

          {avisoApertura && licitacion && (
            <InlineBanner tone="warning" title={`${textoApertura(licitacion.fecha_apertura, hoy)}.`}>
              {avisoApertura}
            </InlineBanner>
          )}

          {/* LICITACION (F4): solo si la oportunidad es una licitacion y la base tiene la tabla */}
          {esLicitacion && (
            <section aria-label="Licitación" className="flex min-w-0 flex-col">
              <SectionBar
                title="Licitación"
                actions={
                  puedeEditar ? (
                    <Button size="sm" icon={Pencil} onClick={() => editor.abrir(true)}>
                      {licitacion ? "Editar datos" : "Cargar datos"}
                    </Button>
                  ) : undefined
                }
              />
              <div className="border-t border-(--crm-border) pt-3">
                {licitacion ? (
                  <DefinitionList
                    items={[
                      { term: "Organismo", value: licitacion.organismo },
                      { term: "Expediente", value: licitacion.expediente, mono: true },
                      {
                        term: "Fecha de apertura",
                        value: (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={TYPE.mono}>{formatFecha(licitacion.fecha_apertura)}</span>
                            {oportunidad.estado === "abierta" && (
                              <StatusDot tone={licitacion.fecha_apertura > hoy ? "warning" : "success"}>{textoApertura(licitacion.fecha_apertura, hoy)}</StatusDot>
                            )}
                          </span>
                        ),
                      },
                      { term: "Monto oficial", value: licitacion.monto_oficial != null ? formatMoney(Number(licitacion.monto_oficial)) : null, mono: true },
                      { term: "Garantía de oferta", value: licitacion.garantia },
                    ]}
                  />
                ) : (
                  <p className={cn(TYPE.ui, "text-(--crm-text-2)")}>
                    Todavía no se cargaron los datos de la licitación. Sin la fecha de apertura no se puede marcar ganada.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* HISTORIAL: actividades y cambios de etapa, lo último arriba (hairlines sobre el canvas, sin caja) */}
          <section aria-label="Historial" className="flex min-w-0 flex-col">
            <SectionBar
              title="Historial"
              count={tiempo.length}
              actions={
                puedeRegistrar ? (
                  <Button size="sm" icon={Plus} onClick={() => actividad.abrir(true)}>
                    Registrar
                  </Button>
                ) : undefined
              }
            />
            {tiempo.length ? (
              <ol className="@container border-t border-(--crm-border)">
                {tiempo.map((item) =>
                  item.tipo === "actividad" ? (
                    <FilaActividad
                      key={`a-${item.actividad.id}`}
                      actividad={item.actividad}
                      tipo={tipoPorId.get(item.actividad.tipo_actividad_id)}
                      autor={item.actividad.autor_id ? perfilPorId.get(item.actividad.autor_id) : null}
                      contacto={item.actividad.contacto_id ? contactosNombres.get(item.actividad.contacto_id) : null}
                    />
                  ) : (
                    <CambioDeEtapa
                      key={`e-${item.cambio.id}`}
                      cambio={item.cambio}
                      anterior={item.cambio.etapa_anterior_id ? etapaPorId.get(item.cambio.etapa_anterior_id) : undefined}
                      nueva={etapaPorId.get(item.cambio.etapa_nueva_id)}
                      usuario={item.cambio.usuario_id ? perfilPorId.get(item.cambio.usuario_id) : undefined}
                    />
                  ),
                )}
              </ol>
            ) : (
              <div className="border-t border-(--crm-border)">
                <EmptyState
                  compact
                  title="Todavía no hay historial"
                  description="Acá aparecen las llamadas, visitas y cada cambio de etapa, con quién lo hizo y por qué."
                />
              </div>
            )}
          </section>

          {/* AUDITORIA: solo si alguien corrigió la oportunidad después de cerrarla */}
          {auditoria.length > 0 && (
            <section aria-label="Cambios después del cierre" className="flex min-w-0 flex-col">
              <SectionBar title="Cambios después del cierre" count={auditoria.length} />
              <p className={cn(TYPE.meta, "mb-2 max-w-prose text-(--crm-text-2)")}>
                Una oportunidad cerrada se puede corregir, pero cada modificación queda asentada: qué campo, qué valía antes y qué vale ahora.
              </p>
              <ol className="@container border-t border-(--crm-border)">
                {auditoria.map((a) => {
                  const usuario = a.usuario_id ? (perfilPorId.get(a.usuario_id) ?? "Usuario no disponible") : "Sistema";
                  return (
                    <FilaHistoria
                      key={a.id}
                      icono={<FileClock strokeWidth={1.75} />}
                      titulo="Corrección"
                      cuando={<CuandoHistoria iso={a.cambiado_en} />}
                      quien={[usuario]}
                      cuerpo={
                        <ul className={cn(TYPE.table, "mt-1 flex flex-col gap-0.5")}>
                          {describirCambios(a.cambios, resolver).map((f) => (
                            <li key={f.campo} className="break-words">
                              <span className="font-medium">{f.campo}: </span>
                              <span className="text-(--crm-text-2)">{f.antes}</span>
                              <ArrowRight aria-hidden="true" strokeWidth={1.75} className="mx-1.5 inline size-3.5 text-(--crm-text-2)" />
                              <span className="sr-only"> pasó a </span>
                              {f.despues}
                            </li>
                          ))}
                        </ul>
                      }
                    />
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <RielDatos label="Datos de la oportunidad" items={datos} notas={oportunidad.notas} />
      </div>

      {puedeEditar && (
        <OportunidadForm
          key={`e-${editor.n}`}
          open={editor.abierto}
          onClose={editor.cerrar}
          oportunidad={oportunidad}
          licitacion={licitacion}
          motivoNombre={oportunidad.motivo_perdida_id ? motivoPorId.get(oportunidad.motivo_perdida_id) : null}
          catalogos={{ licitacionesActivas, empresas, contactos, productos, etapas, origenes, perfiles, puedeAsignar, yoId }}
          onSaved={() => {
            editor.cerrar();
            refrescar();
          }}
        />
      )}
      {puedeAsignar && (
        <ReasignarDrawer
          key={`r-${reasignar.n}`}
          open={reasignar.abierto}
          onClose={reasignar.cerrar}
          oportunidad={oportunidad}
          perfiles={perfiles}
          onSaved={() => {
            reasignar.cerrar();
            refrescar();
          }}
        />
      )}
      {puedeRegistrar && (
        <ActividadDrawer
          key={`a-${actividad.n}`}
          open={actividad.abierto}
          onClose={actividad.cerrar}
          empresaId={oportunidad.empresa_id}
          contactoId={oportunidad.contacto_id}
          oportunidadId={oportunidad.id}
          tipos={tipos}
          avisoNoContactar={empresa?.estado === "no_contactar" || contacto?.estado === "no_contactar"}
          description={oportunidad.titulo}
          onSaved={() => {
            actividad.cerrar();
            refrescar();
          }}
        />
      )}
      <CierreDialog
        {...cierre.dialogProps}
        etapas={etapas}
        motivos={motivos}
        onHecho={() => {
          focoTrasCambio.current = true;
          refrescar();
        }}
      />
    </div>
  );
}

/**
 * Un segmento del recorrido por el embudo: barra de 2 px arriba (hecho: fuerte; actual: acento; pendiente: hairline) y el
 * nombre de la etapa con su cuadradito. Solo lectura: se cambia con "Cambiar etapa" (el mismo diálogo de siempre).
 */
function Paso({
  nombre,
  color,
  paso,
  tono,
}: {
  nombre: string;
  color?: string | null;
  paso: "hecho" | "actual" | "pendiente";
  /** El cierre de una oportunidad cerrada: punto de éxito o de pérdida. */
  tono?: "success" | "danger";
}) {
  return (
    <li
      aria-current={paso === "actual" ? "step" : undefined}
      className={cn(
        "flex min-w-24 flex-1 basis-0 flex-col gap-1 border-t-2 pt-1.5",
        "snap-start",
        tono === "success"
          ? "border-(--crm-success)"
          : tono === "danger"
            ? "border-(--crm-danger)"
            : paso === "actual"
              ? "border-(--crm-accent)"
              : paso === "hecho"
                ? "border-(--crm-border-strong)"
                : "border-(--crm-border)",
      )}
    >
      {/* Sin recortar: un nombre largo baja de renglón (el recorrido comparte la fila con las acciones). */}
      <span className={cn(TYPE.meta, "flex min-w-0 items-baseline gap-1.5", paso === "actual" ? "font-medium text-(--crm-text)" : "text-(--crm-text-2)")}>
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 translate-y-px",
            tono ? cn("rounded-full", tono === "success" ? "bg-(--crm-success)" : "bg-(--crm-danger)") : color ? "rounded-[2px]" : "rounded-full bg-(--crm-text-2)",
          )}
          style={!tono && color ? { backgroundColor: color } : undefined}
        />
        <span className="min-w-0 break-words">{nombre}</span>
      </span>
      {paso === "hecho" && <span className="sr-only">(etapa anterior)</span>}
    </li>
  );
}

/** Un cambio de etapa del historial (una fila de la línea de tiempo). */
function CambioDeEtapa({
  cambio,
  anterior,
  nueva,
  usuario,
}: {
  cambio: Historial;
  anterior?: Tables<"etapas">;
  nueva?: Tables<"etapas">;
  usuario?: string;
}) {
  const titulo = tituloCambioEtapa({
    hayAnterior: Boolean(cambio.etapa_anterior_id),
    anteriorTipo: anterior?.tipo,
    nuevaTipo: nueva?.tipo,
    observacion: cambio.observacion,
  });
  const Icono = nueva?.tipo === "ganada" ? CircleCheck : nueva?.tipo === "perdida" ? CircleX : titulo === "Reapertura" ? RotateCcw : ArrowRightLeft;
  return (
    <FilaHistoria
      icono={<Icono strokeWidth={1.75} />}
      peligro={nueva?.tipo === "perdida"}
      titulo={titulo}
      cuando={<CuandoHistoria iso={cambio.cambiado_en} />}
      quien={[
        usuario && (
          <>
            <span className="sr-only">Lo hizo </span>
            {usuario}
          </>
        ),
      ]}
      cuerpo={
        <>
          <p className={cn(TYPE.table, "mt-1 flex flex-wrap items-center gap-x-1.5 text-(--crm-text-2)")}>
            {anterior && (
              <>
                <span className="sr-only">De </span>
                <StatusDot color={anterior.color}>{anterior.nombre}</StatusDot>
                <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                <span className="sr-only"> a </span>
              </>
            )}
            <StatusDot color={nueva?.color} className="text-(--crm-text)">
              {nueva?.nombre ?? "—"}
            </StatusDot>
          </p>
          {cambio.observacion && (
            <p className={PROSA}>
              <span className="font-medium text-(--crm-text)">Observación: </span>
              {cambio.observacion}
            </p>
          )}
        </>
      }
    />
  );
}

/** Reasignar el responsable (`oportunidades.asignar`). La base lo vuelve a exigir en el trigger `validar_responsable`. */
function ReasignarDrawer({
  open,
  onClose,
  oportunidad,
  perfiles,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  oportunidad: Oportunidad;
  perfiles: Opciones["perfiles"];
  onSaved: () => void;
}) {
  const [responsableId, setResponsableId] = useState(oportunidad.responsable_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useCrmToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responsableId) {
      setError("Elegí quién queda a cargo.");
      return;
    }
    if (responsableId === oportunidad.responsable_id) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: dbError } = await createClient()
      .from("oportunidades")
      .update({ responsable_id: responsableId })
      .eq("id", oportunidad.id)
      .select()
      .single();
    setSaving(false);
    if (dbError || !data) {
      setError(mensajeErrorOportunidad(dbError, "No se pudo reasignar la oportunidad. Intentá de nuevo."));
      return;
    }
    showToast(`«${oportunidad.titulo}» tiene nuevo responsable.`, "success");
    onSaved();
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Reasignar oportunidad"
      description={oportunidad.titulo}
      saving={saving}
      error={error}
      submitLabel="Reasignar"
      onSubmit={(e) => void sinTrabarse(() => handleSubmit(e), (m) => {
        setSaving(false);
        setError(m);
      })}
    >
      <p className={cn(TYPE.ui, "text-(--crm-text-2)")}>
        Quien queda a cargo ve esta oportunidad en su cartera. Quien la tenía deja de verla si no tiene acceso a toda la cartera.
      </p>
      <CampoOpciones
        id="responsable_id"
        label="Responsable"
        required
        placeholder="Elegí una persona"
        searchable={perfiles.length > 8}
        value={responsableId}
        onChange={setResponsableId}
        options={perfiles
          .filter((p) => p.activo || p.id === oportunidad.responsable_id)
          .map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` }))}
      />
    </FormDrawer>
  );
}
