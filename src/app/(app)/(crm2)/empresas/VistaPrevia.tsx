import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { leerCuenta360, type PermisosCuenta360 } from "@/lib/cuenta360";
import { resumenCuenta, textoContacto } from "@/lib/timeline360";
import { hoyAR } from "@/lib/oportunidades";
import { formatFecha, etiquetaTipoCliente, estaDeBaja, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { formatMoney } from "@/lib/money";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import { DefinitionList } from "@/components/crm/Panel";
import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { Avatar, Tag } from "@/components/crm/Status";
import { buttonClass } from "@/components/crm/Button";
import { SectionBar } from "@/components/crm/PageBar";
import { AvisoEstadoCrm, EstadoCliente } from "@/components/crm/cuenta/estados";
import { MovimientosRecientes } from "@/components/crm/cuenta/HistoriaCuenta";
import { FOCUS, TYPE, cn } from "@/components/crm/cx";
import AccionesVistaPrevia from "./AccionesVistaPrevia";

/** Ancho y superficie del panel. Solo existe desde 1280 (debajo, la lista quita `sel` de la URL: ver EmpresasList). */
const ASIDE = "hidden min-h-0 w-[400px] shrink-0 flex-col overflow-y-auto border-l border-(--crm-border) bg-(--crm-panel) xl:flex 2xl:w-[440px]";
const LINK = cn("rounded-[2px] underline-offset-2 hover:underline", FOCUS);
/** Cuántos contactos, oportunidades y movimientos entran: el panel cabe sin scroll en 1440 × 900. */
const TOPE = 3;

/**
 * Vista previa de una empresa (master-detail, MASTER.md §10.13): server component con el cliente de la sesión (RLS) y la
 * misma capa de datos que la ficha (`leerCuenta360`). Si la empresa no existe o la RLS la esconde, no dibuja nada.
 * Es para operar sin abrir la ficha: identidad, UNA acción + `⋮`, cómo contactarla, sus contactos clave, lo abierto,
 * el último contacto y lo último que pasó. Alta, origen, sitio web y el resto quedan en la ficha (y en la fila).
 */
export default async function VistaPrevia({
  id,
  params,
  enLista,
  perfiles,
  origenes,
  yoId,
  puedeEditar,
  puedeAsignar,
  permisos,
  puedeEscribirActividad,
}: {
  id: string;
  /** Los parámetros de la lista (para cerrar sin perder búsqueda, filtros ni página). */
  params: ParamsUrl;
  /** La empresa está en la página que se ve (si no, el panel lo dice: puede venir de un link o de otro filtro). */
  enLista: boolean;
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  yoId: string;
  puedeEditar: boolean;
  puedeAsignar: boolean;
  permisos: PermisosCuenta360;
  puedeEscribirActividad: boolean;
}) {
  const supabase = await createClient();
  const [{ data: empresa }, { data: contactos }, cuenta, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
    supabase.from("contactos").select("id, nombre, apellido, estado, cargo, telefono, email").eq("empresa_id", id).order("nombre"),
    leerCuenta360(supabase, "empresa_id", id, permisos),
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
  ]);
  if (!empresa) return null;

  const responsable = empresa.responsable_id ? (perfiles.find((p) => p.id === empresa.responsable_id)?.nombre ?? null) : null;
  const tipo = etiquetaTipoCliente(empresa.tipo_cliente);
  const activos = (contactos ?? []).filter((c) => !estaDeBaja(c.estado));
  const abiertas = cuenta.oportunidades.filter((o) => o.estado === "abierta");
  const nombreEtapa = new Map(cuenta.etapas.map((e) => [e.id, e.nombre]));
  const resumen = permisos.actividades
    ? resumenCuenta({ ventas: cuenta.ventas, oportunidades: cuenta.oportunidades, actividades: cuenta.actividades, hoy: hoyAR(), primeraCompra: cuenta.primeraCompra })
    : null;
  const alerta = resumen && (resumen.tonoContacto === "atencion" || resumen.tonoContacto === "frio");
  const verHistoria = permisos.actividades || permisos.oportunidades || permisos.ventas || permisos.avisos;
  const cerrar = urlConParams("/empresas", params, { sel: null });
  const ficha = `/empresas/${empresa.id}`;

  return (
    <aside aria-labelledby="vista-previa-titulo" data-vista-previa className={ASIDE}>
      <header className="sticky top-0 z-(--crm-z-sticky) flex flex-col gap-2 border-b border-(--crm-border) bg-(--crm-panel) px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="vista-previa-titulo" className={cn(TYPE.section, "min-w-0 break-words")}>
              {empresa.nombre}
            </h2>
            {!enLista && <Tag className="self-start">Fuera de la lista actual</Tag>}
          </div>
          {/* Link real (quita `sel` y conserva lo demás): Esc hace lo mismo. */}
          <Link href={cerrar} scroll={false} aria-label="Cerrar vista previa" aria-keyshortcuts="Escape" className={buttonClass({ variant: "ghost", className: "-mr-2 -mt-1 w-8 px-0" })}>
            <X aria-hidden="true" strokeWidth={1.75} />
          </Link>
        </div>
        <div className={cn(TYPE.table, "flex flex-wrap items-center gap-x-3 gap-y-1 text-(--crm-text-2)")}>
          <EstadoCliente estado={empresa.estado} className="text-(--crm-text)" />
          {tipo && <span>{tipo}</span>}
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {responsable && <Avatar name={responsable} size="xs" />}
            <span className="truncate">{responsable ?? "Sin asignar"}</span>
          </span>
        </div>
        <AccionesVistaPrevia
          empresa={empresa}
          perfiles={perfiles}
          origenes={origenes}
          yoId={yoId}
          puedeAsignar={puedeAsignar}
          puedeEditar={puedeEditar}
          puedeRegistrar={puedeEscribirActividad && permisos.actividades}
          tipos={tipos ?? []}
          contactos={activos.map((c) => ({ id: c.id, label: nombreCompleto(c) }))}
          oportunidades={abiertas.map((o) => ({ id: o.id, label: o.titulo }))}
        />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <AvisoEstadoCrm estado={empresa.estado} entidad="empresa" />

        <DefinitionList
          inline
          columns={1}
          items={[
            { term: "Teléfono", value: empresa.telefono, mono: true },
            {
              term: "Email",
              value: empresa.email && (
                <a href={`mailto:${empresa.email}`} className={cn(LINK, "break-all text-(--crm-accent-text)")}>
                  {empresa.email}
                </a>
              ),
            },
            { term: "CUIT", value: empresa.cuit, mono: true },
            ...(resumen
              ? [
                  {
                    term: "Último contacto",
                    value: (
                      <span className={cn("inline-flex flex-wrap items-center gap-x-1.5", alerta && "font-medium text-(--crm-warning)")}>
                        {alerta && <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-3.5 self-center" />}
                        {textoContacto(resumen.diasDesdeContacto, resumen.tonoContacto)}
                        {resumen.ultimoContacto && <span className="font-normal text-(--crm-text-2)">el {formatFecha(resumen.ultimoContacto)}</span>}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <section>
          <SectionBar as="h3" title="Contactos" count={activos.length} className="h-8" />
          {activos.length ? (
            <ul className="border-t border-(--crm-border)">
              {activos.slice(0, TOPE).map((c) => (
                <li key={c.id} className="flex flex-col border-b border-(--crm-border) py-1.5">
                  <span className={cn(TYPE.table, "flex min-w-0 items-baseline gap-2")}>
                    <Link href={`/contactos/${c.id}`} className={cn(LINK, "truncate font-medium")}>
                      {nombreCompleto(c)}
                    </Link>
                    {c.cargo && <span className="truncate text-(--crm-text-2)">{c.cargo}</span>}
                  </span>
                  {(c.telefono || c.email) && (
                    <span className={cn(TYPE.meta, "flex min-w-0 gap-3 text-(--crm-text-2)")}>
                      {c.telefono && <span className={cn(TYPE.mono, "shrink-0")}>{c.telefono}</span>}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className={cn(LINK, "truncate")}>
                          {c.email}
                        </a>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Sin contactos cargados.</p>
          )}
        </section>

        {permisos.oportunidades && (
          <section>
            <SectionBar as="h3" title="Oportunidades abiertas" count={abiertas.length} className="h-8" />
            {abiertas.length ? (
              <ul className="border-t border-(--crm-border)">
                {abiertas.slice(0, TOPE).map((o) => (
                  <li key={o.id} className={cn(TYPE.table, "flex h-8 items-center gap-2 border-b border-(--crm-border)")}>
                    <Link href={`/oportunidades/${o.id}`} className={cn(LINK, "min-w-0 truncate font-medium")}>
                      {o.titulo}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-(--crm-text-2)">{nombreEtapa.get(o.etapa_id)}</span>
                    <span className={cn(TYPE.mono, "shrink-0")}>
                      {o.monto ? (
                        <>
                          <span className={TYPE.unit}>$</span> {formatMoney(Number(o.monto)).replace(/^\$/, "")}
                        </>
                      ) : (
                        <span className="text-(--crm-text-2)">—</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Ninguna abierta.</p>
            )}
          </section>
        )}

        {verHistoria && (
          <section>
            <SectionBar
              as="h3"
              title="Últimos movimientos"
              className="h-8"
              actions={
                <Link href={`${ficha}?tab=actividad`} className={cn(TYPE.table, LINK, "text-(--crm-accent-text)")}>
                  Ver toda la actividad
                </Link>
              }
            />
            <div className="border-t border-(--crm-border)">
              <MovimientosRecientes
                limite={TOPE}
                actividades={cuenta.actividades}
                cambios={cuenta.cambios}
                oportunidades={cuenta.oportunidades}
                ventas={cuenta.ventas}
                avisos={cuenta.avisos}
                etapas={cuenta.etapas}
                tipos={tipos ?? []}
                perfiles={perfiles}
                contactos={(contactos ?? []).map((c) => ({ id: c.id, label: nombreCompleto(c) }))}
                ver={{ actividades: permisos.actividades, etapas: permisos.oportunidades, ventas: permisos.ventas, avisos: permisos.avisos && permisos.ventas }}
              />
            </div>
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 border-t border-(--crm-border) bg-(--crm-panel) px-4 py-1.5">
        <Link href={ficha} className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-2 text-(--crm-accent-text)" })}>
          Abrir ficha completa
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </footer>
    </aside>
  );
}

/** Mientras llega la vista previa: el mismo panel con esqueletos, `aria-busy` y "Cargando…". */
export function VistaPreviaCargando() {
  return (
    <aside aria-busy="true" aria-label="Vista previa" className={ASIDE}>
      <LoadingStatus label="Cargando vista previa…" />
      <div className="flex flex-col gap-3 border-b border-(--crm-border) px-4 py-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-7" />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="grid grid-cols-[7rem_1fr] gap-3">
            <Skeleton className="w-16" />
            <Skeleton className={i % 2 ? "w-2/3" : "w-1/2"} />
          </div>
        ))}
      </div>
    </aside>
  );
}
