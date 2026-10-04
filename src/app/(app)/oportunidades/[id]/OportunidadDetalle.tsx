"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CircleCheck,
  CircleX,
  FileClock,
  Handshake,
  History,
  NotebookPen,
  Pencil,
  Plus,
  UserCog,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import ActividadForm from "@/components/ActividadForm";
import { ActividadFila } from "@/components/ActividadesTimeline";
import CierreModal, { ACCION_CAMBIO, useCierre } from "@/components/CierreModal";
import { Dato, Seccion } from "@/components/cliente";
import { CampoSelect, FormActions, FormBanner } from "@/components/form";
import { EstadoOportunidadPill, EtapaBadge, TipoOportunidadBadge } from "@/components/oportunidades";
import { Button, Card } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, formatFechaAlta, formatMomento } from "@/lib/clientes";
import { formatMoney } from "@/lib/money";
import {
  accionesDisponibles,
  describirCambios,
  lineaDeTiempo,
  mensajeErrorOportunidad,
  tituloCambioEtapa,
  type ResolverId,
} from "@/lib/oportunidades";
import type { Tables } from "@/lib/supabase/types";
import OportunidadForm from "../OportunidadForm";
import type { Opciones } from "../datos";

type Oportunidad = Tables<"oportunidades">;
type Historial = Tables<"oportunidad_etapas_historial">;
type Auditoria = Tables<"oportunidad_auditoria">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;

type DrawerState = "editar" | "actividad" | "reasignar";

export default function OportunidadDetalle({
  oportunidad: oportunidadInicial,
  historial: historialInicial,
  auditoria: auditoriaInicial,
  actividades: actividadesIniciales,
  tipos,
  opciones,
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
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeReabrir: boolean;
  puedeVerActividades: boolean;
  puedeEscribirActividad: boolean;
  puedeVerClientes: boolean;
}) {
  const { etapas, empresas, contactos, productos, perfiles, origenes, motivos } = opciones;
  const [oportunidad, setOportunidad] = useState(oportunidadInicial);
  const [historial, setHistorial] = useState(historialInicial);
  const [auditoria, setAuditoria] = useState(auditoriaInicial);
  const [actividades, setActividades] = useState(actividadesIniciales);
  const cierre = useCierre();

  // The payload outlives `open` on purpose so the drawer's title doesn't flip mid-animation.
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [open, setOpen] = useState(false);
  function abrir(next: DrawerState) {
    setDrawer(next);
    setOpen(true);
  }

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

  /** Historial y auditoria vuelven de la base: son lo que escribieron los triggers, no una copia armada a mano. */
  async function recargarHistorial() {
    const supabase = createClient();
    const [h, a] = await Promise.all([
      supabase.from("oportunidad_etapas_historial").select("*").eq("oportunidad_id", oportunidad.id).order("cambiado_en", { ascending: false }),
      supabase.from("oportunidad_auditoria").select("*").eq("oportunidad_id", oportunidad.id).order("cambiado_en", { ascending: false }),
    ]);
    if (h.data) setHistorial(h.data);
    if (a.data) setAuditoria(a.data);
  }

  function guardada(saved: Oportunidad) {
    setOportunidad(saved);
    setOpen(false);
    void recargarHistorial();
  }

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

  const tituloDrawer =
    drawer === "editar" ? "Editar oportunidad" : drawer === "reasignar" ? "Reasignar oportunidad" : "Registrar actividad";

  return (
    <div className="flex w-full flex-col gap-4">
      <nav aria-label="Ruta">
        <Link
          href="/oportunidades"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Oportunidades
        </Link>
      </nav>

      {/* CABECERA */}
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
            <span className="h-px w-6 bg-brand" aria-hidden="true" />
            Oportunidad
          </p>
          <h1 className="break-words font-display text-[2rem] leading-tight tracking-[-0.01em]">{oportunidad.titulo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EstadoOportunidadPill estado={oportunidad.estado} />
            <EtapaBadge nombre={etapa?.nombre ?? "—"} color={etapa?.color} />
            <TipoOportunidadBadge tipo={oportunidad.tipo} />
            <span className="font-mono text-sm font-semibold tabular-nums">
              <span className="sr-only">Valor estimado: </span>
              {oportunidad.monto ? formatMoney(Number(oportunidad.monto)) : "Sin valor estimado"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {puedeEscribirActividad && puedeVerActividades && (
            <Button onClick={() => abrir("actividad")} className="gap-1.5">
              <NotebookPen aria-hidden="true" className="h-4 w-4" /> Registrar actividad
            </Button>
          )}
          {modos.map((modo) => {
            const Icon = ACCION_CAMBIO[modo].icon;
            return (
              <Button
                key={modo}
                variant="outline"
                className="gap-1.5"
                onClick={() => cierre.abrir({ modo, oportunidad })}
              >
                <Icon aria-hidden="true" className="h-4 w-4" /> {ACCION_CAMBIO[modo].label}
              </Button>
            );
          })}
          {puedeAsignar && (
            <Button variant="outline" onClick={() => abrir("reasignar")} className="gap-1.5">
              <UserCog aria-hidden="true" className="h-4 w-4" /> Reasignar
            </Button>
          )}
          {puedeEditar && (
            <Button variant="outline" onClick={() => abrir("editar")} className="gap-1.5">
              <Pencil aria-hidden="true" className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </header>

      {cerrada && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-sm"
        >
          {oportunidad.estado === "ganada" ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          ) : (
            <CircleX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <p>
            <strong>
              {oportunidad.estado === "ganada" ? "Ganada" : "Perdida"}
              {oportunidad.fecha_cierre ? ` el ${formatFecha(oportunidad.fecha_cierre)}` : ""}.
            </strong>{" "}
            {oportunidad.estado === "perdida" && oportunidad.motivo_perdida_id && (
              <>Motivo: {motivoPorId.get(oportunidad.motivo_perdida_id) ?? "no disponible"}. </>
            )}
            Está cerrada: corregirla queda registrado en la auditoría
            {puedeReabrir ? ", y podés reabrirla." : ". Reabrirla lo hace quien tiene ese permiso."}
          </p>
        </div>
      )}

      {/* DATOS */}
      <Card className="p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Empresa">
            {oportunidad.empresa_id &&
              (empresa && puedeVerClientes ? (
                <Link href={`/empresas/${empresa.id}`} className="text-brand underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  {empresa.label}
                </Link>
              ) : (
                sinAcceso
              ))}
          </Dato>
          <Dato label="Contacto">
            {oportunidad.contacto_id &&
              (contacto && puedeVerClientes ? (
                <Link href={`/contactos/${contacto.id}`} className="text-brand underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  {contacto.label}
                </Link>
              ) : (
                sinAcceso
              ))}
          </Dato>
          <Dato label="Responsable">{oportunidad.responsable_id ? (perfilPorId.get(oportunidad.responsable_id) ?? "Usuario no disponible") : "Sin asignar"}</Dato>
          <Dato label="Producto / servicio">{producto?.label}</Dato>
          <Dato label="Valor estimado">
            {oportunidad.monto != null && <span className="font-mono tabular-nums">{formatMoney(Number(oportunidad.monto))}</span>}
          </Dato>
          <Dato label="Probabilidad">
            {oportunidad.probabilidad != null && <span className="tabular-nums">{oportunidad.probabilidad}%</span>}
          </Dato>
          <Dato label="Fecha estimada de cierre">
            {oportunidad.fecha_estimada_cierre && <span className="tabular-nums">{formatFecha(oportunidad.fecha_estimada_cierre)}</span>}
          </Dato>
          <Dato label="Fecha real de cierre">
            {oportunidad.fecha_cierre && <span className="tabular-nums">{formatFecha(oportunidad.fecha_cierre)}</span>}
          </Dato>
          <Dato label="Origen">{oportunidad.origen_id ? origenPorId.get(oportunidad.origen_id) : null}</Dato>
          {oportunidad.estado === "perdida" && (
            <Dato label="Motivo de pérdida">
              {oportunidad.motivo_perdida_id ? motivoPorId.get(oportunidad.motivo_perdida_id) : null}
            </Dato>
          )}
          <Dato label="Alta">{formatFechaAlta(oportunidad.created_at)}</Dato>
          {oportunidad.notas && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Dato label="Observaciones">
                <span className="whitespace-pre-line text-muted-foreground">{oportunidad.notas}</span>
              </Dato>
            </div>
          )}
        </dl>
      </Card>

      {/* LINEA DE TIEMPO: actividades y cambios de etapa, lo ultimo arriba */}
      <Seccion
        icon={History}
        titulo="Historial"
        cantidad={tiempo.length}
        accion={
          puedeEscribirActividad && puedeVerActividades ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrir("actividad")}>
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Registrar
            </Button>
          ) : undefined
        }
      >
        {tiempo.length ? (
          <ol className="space-y-3">
            {tiempo.map((item) =>
              item.tipo === "actividad" ? (
                <ActividadFila
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
          <EmptyState
            compact
            text="Todavía no hay historial"
            hint="Acá aparecen las llamadas, visitas y cada cambio de etapa, con quién lo hizo y por qué."
            className="py-8"
          />
        )}
      </Seccion>

      {/* AUDITORIA: solo si alguien corrigio la oportunidad despues de cerrarla */}
      {auditoria.length > 0 && (
        <Seccion icon={FileClock} titulo="Cambios después del cierre" cantidad={auditoria.length}>
          <p className="mb-3 text-sm text-muted-foreground">
            Una oportunidad cerrada se puede corregir, pero cada modificación queda asentada: qué campo, qué valía antes y qué vale ahora.
          </p>
          <ol className="space-y-3">
            {auditoria.map((a) => {
              const filas = describirCambios(a.cambios, resolver);
              return (
                <li key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <time dateTime={a.cambiado_en} className="tabular-nums">
                      {formatMomento(a.cambiado_en)}
                    </time>
                    <span>{a.usuario_id ? (perfilPorId.get(a.usuario_id) ?? "Usuario no disponible") : "Sistema"}</span>
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {filas.map((f) => (
                      <li key={f.campo} className="break-words">
                        <span className="font-semibold">{f.campo}: </span>
                        <span className="text-muted-foreground">{f.antes}</span>
                        <ArrowRight aria-hidden="true" className="mx-1.5 inline h-3 w-3 text-muted-foreground" />
                        <span className="sr-only"> pasó a </span>
                        {f.despues}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </Seccion>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={tituloDrawer}
        subtitle={oportunidad.titulo}
        icon={drawer === "actividad" ? NotebookPen : Handshake}
      >
        {drawer === "editar" ? (
          <OportunidadForm
            key={`editar-${oportunidad.id}`}
            oportunidad={oportunidad}
            empresas={empresas}
            contactos={contactos}
            productos={productos}
            etapas={etapas}
            origenes={origenes}
            perfiles={perfiles}
            motivoNombre={oportunidad.motivo_perdida_id ? motivoPorId.get(oportunidad.motivo_perdida_id) : null}
            puedeAsignar={puedeAsignar}
            yoId={yoId}
            onSaved={guardada}
            onCancel={() => setOpen(false)}
          />
        ) : drawer === "reasignar" ? (
          <ReasignarForm
            key={`reasignar-${oportunidad.id}`}
            oportunidad={oportunidad}
            perfiles={perfiles}
            onSaved={guardada}
            onCancel={() => setOpen(false)}
          />
        ) : drawer === "actividad" ? (
          <ActividadForm
            key={`actividad-${oportunidad.id}`}
            empresaId={oportunidad.empresa_id}
            contactoId={oportunidad.contacto_id}
            oportunidadId={oportunidad.id}
            tipos={tipos}
            avisoNoContactar={empresa?.estado === "no_contactar" || contacto?.estado === "no_contactar"}
            onSaved={(nueva) => {
              setActividades((prev) => [nueva, ...prev]);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </Drawer>

      <CierreModal
        {...cierre.modalProps}
        etapas={etapas}
        motivos={motivos}
        onHecho={(row) => {
          setOportunidad(row);
          void recargarHistorial();
        }}
      />
    </div>
  );
}

/** Un cambio de etapa del historial (un `<li>` de la linea de tiempo). */
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

  return (
    <li className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <ArrowRightLeft className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          {titulo}
          {anterior && (
            <>
              <span className="sr-only">: de</span>
              <EtapaBadge nombre={anterior.nombre} color={anterior.color} />
              <span className="sr-only">a</span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
          <EtapaBadge nombre={nueva?.nombre ?? "—"} color={nueva?.color} />
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <time dateTime={cambio.cambiado_en} className="tabular-nums">
            {formatMomento(cambio.cambiado_en)}
          </time>
          {usuario && (
            <span>
              <span className="sr-only">Lo hizo </span>
              {usuario}
            </span>
          )}
        </p>
        {cambio.observacion && (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Observación: </span>
            {cambio.observacion}
          </p>
        )}
      </div>
    </li>
  );
}

/** Reasignar el responsable (`oportunidades.asignar`). La base lo vuelve a exigir en el trigger `validar_responsable`. */
function ReasignarForm({
  oportunidad,
  perfiles,
  onSaved,
  onCancel,
}: {
  oportunidad: Oportunidad;
  perfiles: Opciones["perfiles"];
  onSaved: (o: Oportunidad) => void;
  onCancel: () => void;
}) {
  const [responsableId, setResponsableId] = useState(oportunidad.responsable_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!responsableId) {
      setError("Elegí quién queda a cargo.");
      return;
    }
    if (responsableId === oportunidad.responsable_id) {
      onCancel();
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
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <FormBanner message={error} />}
      <p className="text-sm text-muted-foreground">
        Quien queda a cargo ve esta oportunidad en su cartera. Quien la tenía deja de verla si no tiene acceso a toda la cartera.
      </p>
      <CampoSelect
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
      <FormActions saving={saving} onCancel={onCancel} submitLabel="Reasignar" />
    </form>
  );
}
