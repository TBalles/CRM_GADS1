"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Handshake, NotebookPen, Pencil, Plus, Power, Receipt, UserRound } from "lucide-react";
import Drawer from "@/components/Drawer";
import ActividadForm from "@/components/ActividadForm";
import { HistoriaCuenta, ResumenCuentaCard } from "@/components/Cuenta360";
import { ResumenIA } from "@/components/ResumenIA";
import { BajaModal, useReactivar } from "@/components/BajaCliente";
import {
  AvisoEstado,
  Dato,
  EstadoPill,
  OportunidadesLista,
  Seccion,
  VentasLista,
} from "@/components/cliente";
import { Avatar, AvatarFallback, Button, Card, Pill, initials } from "@/components/ui/UIComponents";
import { estaDeBaja, formatFechaAlta, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import ContactoForm, { type EmpresaOpcion } from "../ContactoForm";
import { TOPES, type AvisoCuenta, type CambioEtapaFila, type Cuenta360, type EtapaCuenta, type OportunidadCuenta, type VentaCuenta } from "@/lib/cuenta360";
import { resumenCuenta } from "@/lib/timeline360";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;

type DrawerState = "contacto" | "actividad";

export default function ContactoDetalle({
  contacto: contactoInicial,
  empresa,
  empresas,
  oportunidades,
  etapas,
  ventas,
  actividades: actividadesIniciales,
  cambios,
  avisos,
  truncado,
  primeraCompra,
  hoy,
  tipos,
  perfiles,
  origenes,
  yoId,
  puedeEditar,
  puedeAsignar,
  puedeVerOportunidades,
  puedeVerVentas,
  puedeVerActividades,
  puedeVerAvisos,
  puedeEscribirActividad,
  iaDisponible,
}: {
  contacto: Contacto;
  /** La empresa del contacto, solo si el usuario la ve (puede ser de otra cartera). */
  empresa: EmpresaOpcion | null;
  empresas: EmpresaOpcion[];
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  ventas: VentaCuenta[];
  actividades: Actividad[];
  /** F5: cambios de etapa de las oportunidades del contacto, avisos de recambio enviados y si algo pasó el tope. */
  cambios: CambioEtapaFila[];
  avisos: AvisoCuenta[];
  truncado: Cuenta360["truncado"];
  /** Fecha de la primera compra de toda la cuenta (aunque las ventas que se muestran estén recortadas). */
  primeraCompra: string | null;
  /** Hoy en horario argentino (`aaaa-mm-dd`), calculado en el servidor para que no se desfase al hidratar. */
  hoy: string;
  tipos: Tipo[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeVerOportunidades: boolean;
  puedeVerVentas: boolean;
  puedeVerActividades: boolean;
  puedeVerAvisos: boolean;
  puedeEscribirActividad: boolean;
  /** F7: la IA está activada en el servidor (hay clave). Sin ella no se ofrece nada. */
  iaDisponible: boolean;
}) {
  const reactivar = useReactivar("contacto");
  const [contacto, setContacto] = useState(contactoInicial);
  const [actividades, setActividades] = useState(actividadesIniciales);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>("contacto");
  const [open, setOpen] = useState(false);

  function abrir(next: DrawerState) {
    setDrawer(next);
    setOpen(true);
  }

  const nombre = nombreCompleto(contacto);
  const verHistoria = useMemo(
    () => ({
      actividades: puedeVerActividades,
      etapas: puedeVerOportunidades,
      ventas: puedeVerVentas,
      avisos: puedeVerAvisos && puedeVerVentas,
    }),
    [puedeVerActividades, puedeVerOportunidades, puedeVerVentas, puedeVerAvisos],
  );
  const resumen = useMemo(
    () => resumenCuenta({ ventas, oportunidades, actividades: puedeVerActividades ? actividades : null, hoy, primeraCompra }),
    [ventas, oportunidades, actividades, puedeVerActividades, hoy, primeraCompra],
  );
  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origen = origenes.find((o) => o.id === contacto.origen_id)?.nombre;
  const responsable = contacto.responsable_id ? perfilPorId.get(contacto.responsable_id) : null;
  const deBaja = estaDeBaja(contacto.estado);
  // La empresa vigente del contacto (si la editaron en el drawer puede haber cambiado).
  const empresaActual = empresas.find((e) => e.id === contacto.empresa_id) ?? (contacto.empresa_id === empresa?.id ? empresa : null);
  const oportunidadesOpciones = oportunidades
    // La RLS rechaza vincular una oportunidad de otra empresa a la actividad de esta.
    .filter((o) => o.estado === "abierta" && (!empresaActual || o.empresa_id === null || o.empresa_id === empresaActual.id))
    .map((o) => ({ id: o.id, label: o.titulo }));

  const accionReactivar = puedeEditar ? (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={async () => {
        const fila = await reactivar(contacto.id, nombre, contacto.empresa_id);
        if (fila) setContacto(fila);
      }}
    >
      <Power aria-hidden="true" className="h-3.5 w-3.5" /> Reactivar
    </Button>
  ) : undefined;

  return (
    <div className="flex w-full flex-col gap-4">
      <nav aria-label="Ruta">
        <Link
          href="/contactos"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Contactos
        </Link>
      </nav>

      {/* CABECERA */}
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-secondary text-lg text-muted-foreground">{initials(nombre)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              <span className="h-px w-6 bg-brand" aria-hidden="true" />
              Ficha de contacto
            </p>
            <h1 className="break-words font-display text-[2rem] leading-tight tracking-[-0.01em]">{nombre}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoPill estado={contacto.estado} />
              {!contacto.empresa_id && <Pill tono="gris">Cliente individual</Pill>}
              {contacto.cargo && <Pill tono="gris">{contacto.cargo}</Pill>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {puedeEscribirActividad && puedeVerActividades && (
            <Button onClick={() => abrir("actividad")} className="gap-1.5">
              <NotebookPen aria-hidden="true" className="h-4 w-4" /> Registrar actividad
            </Button>
          )}
          {puedeEditar && (
            <Button variant="outline" onClick={() => abrir("contacto")} className="gap-1.5">
              <Pencil aria-hidden="true" className="h-4 w-4" /> Editar
            </Button>
          )}
          {puedeEditar && !deBaja && (
            <Button variant="outline" onClick={() => setDandoDeBaja(true)} className="gap-1.5">
              <Power aria-hidden="true" className="h-4 w-4" /> Dar de baja
            </Button>
          )}
        </div>
      </header>

      <AvisoEstado estado={contacto.estado} entidad="contacto" accion={contacto.estado === "inactivo" ? accionReactivar : undefined} />

      {/* DATOS */}
      <Card className="p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Empresa">
            {contacto.empresa_id ? (
              empresaActual ? (
                <Link href={`/empresas/${empresaActual.id}`} className="text-brand underline-offset-4 hover:underline">
                  {empresaActual.nombre}
                </Link>
              ) : (
                <span className="text-muted-foreground">Empresa de otra cartera</span>
              )
            ) : (
              "Sin empresa: cliente individual"
            )}
          </Dato>
          <Dato label="Documento">{contacto.documento}</Dato>
          <Dato label="Email">
            {contacto.email && (
              <a href={`mailto:${contacto.email}`} className="break-all text-brand underline-offset-4 hover:underline">
                {contacto.email}
              </a>
            )}
          </Dato>
          <Dato label="Teléfono">{contacto.telefono}</Dato>
          <Dato label="Cargo">{contacto.cargo}</Dato>
          <Dato label="Responsable">{responsable ?? "Sin asignar"}</Dato>
          <Dato label="Origen">{origen}</Dato>
          <Dato label="Alta">{formatFechaAlta(contacto.created_at)}</Dato>
          {contacto.notas && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Dato label="Observaciones">
                <span className="whitespace-pre-line text-muted-foreground">{contacto.notas}</span>
              </Dato>
            </div>
          )}
        </dl>
      </Card>

      {/* RESUMEN (F5): lo que la persona lleva comprado y hace cuánto no se habla */}
      {(puedeVerVentas || puedeVerOportunidades || puedeVerActividades) && (
        <ResumenCuentaCard
          resumen={resumen}
          mostrar={{ ventas: puedeVerVentas, oportunidades: puedeVerOportunidades, contacto: puedeVerActividades }}
          truncado={truncado}
        />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {puedeVerOportunidades && (
            <Seccion icon={Handshake} titulo="Oportunidades" cantidad={truncado.oportunidades ? `${oportunidades.length}+` : oportunidades.length}>
              <OportunidadesLista oportunidades={oportunidades} etapas={etapas} />
              {truncado.oportunidades && (
                <p className="mt-3 text-xs text-muted-foreground">Se muestran las {TOPES.oportunidades} más recientes.</p>
              )}
            </Seccion>
          )}

          {puedeVerVentas && (
            <Seccion icon={Receipt} titulo="Ventas" cantidad={truncado.ventas ? `${ventas.length}+` : ventas.length}>
              <VentasLista ventas={ventas} />
              {truncado.ventas && <p className="mt-3 text-xs text-muted-foreground">Se muestran las {TOPES.ventas} más recientes.</p>}
            </Seccion>
          )}
        </div>

        {/* HISTORIA (F5): actividades, etapas, ventas y avisos en una sola línea de tiempo */}
        {(puedeVerActividades || puedeVerOportunidades || puedeVerVentas || puedeVerAvisos) && (
          <HistoriaCuenta
            actividades={actividades}
            cambios={cambios}
            oportunidades={oportunidades}
            ventas={ventas}
            avisos={avisos}
            etapas={etapas}
            tipos={tipos}
            perfiles={perfiles}
            ver={verHistoria}
            truncado={truncado}
            ia={iaDisponible ? <ResumenIA tipo="contacto" id={contacto.id} /> : undefined}
            accion={
              puedeEscribirActividad && puedeVerActividades ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrir("actividad")}>
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Registrar
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={drawer === "actividad" ? "Registrar actividad" : "Editar contacto"}
        subtitle={nombre}
        icon={drawer === "actividad" ? NotebookPen : UserRound}
      >
        {drawer === "contacto" ? (
          <ContactoForm
            key={`contacto-${contacto.id}`}
            contacto={contacto}
            empresas={empresas}
            perfiles={perfiles}
            origenes={origenes}
            puedeAsignar={puedeAsignar}
            yoId={yoId}
            onSaved={(saved) => {
              setContacto(saved);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <ActividadForm
            key={`actividad-${contacto.id}`}
            contactoId={contacto.id}
            // Se cuelga también de la empresa para que aparezca en su línea de tiempo; si la RLS no deja ver la empresa, no.
            empresaId={empresaActual?.id ?? null}
            tipos={tipos}
            oportunidades={oportunidadesOpciones}
            avisoNoContactar={contacto.estado === "no_contactar" || empresaActual?.estado === "no_contactar"}
            onSaved={(nueva) => {
              setActividades((prev) => [nueva, ...prev]);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Drawer>

      <BajaModal
        tipo="contacto"
        objetivo={dandoDeBaja ? { id: contacto.id, nombre } : null}
        onClose={() => setDandoDeBaja(false)}
        onHecho={setContacto}
      />
    </div>
  );
}
