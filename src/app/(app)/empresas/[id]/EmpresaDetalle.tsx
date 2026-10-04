"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Handshake,
  NotebookPen,
  Pencil,
  Plus,
  Power,
  Receipt,
  UserRound,
  Users,
} from "lucide-react";
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
import { AvisoMigracion } from "@/components/AvisoMigracion";
import { ParqueInstalado } from "@/components/ParqueInstalado";
import { Avatar, AvatarFallback, Button, Card, Pill, initials } from "@/components/ui/UIComponents";
import {
  estaDeBaja,
  etiquetaTipoCliente,
  formatFechaAlta,
  hrefSitioWeb,
  nombreCompleto,
  type OrigenOpcion,
  type PerfilOpcion,
} from "@/lib/clientes";
import type { GrupoParque } from "@/lib/parque";
import { TOPES, type AvisoCuenta, type CambioEtapaFila, type Cuenta360, type EtapaCuenta, type OportunidadCuenta, type VentaCuenta } from "@/lib/cuenta360";
import { resumenCuenta } from "@/lib/timeline360";
import ContactoForm from "../../contactos/ContactoForm";
import EmpresaForm from "../EmpresaForm";
import CanchasSeccion from "./CanchasSeccion";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;
type Cancha = Tables<"canchas">;

type DrawerState =
  | { tipo: "empresa" }
  | { tipo: "contacto"; contacto?: Contacto }
  | { tipo: "actividad" };

export default function EmpresaDetalle({
  empresa: empresaInicial,
  contactos: contactosIniciales,
  oportunidades,
  etapas,
  ventas,
  actividades: actividadesIniciales,
  cambios,
  avisos,
  truncado,
  primeraCompra,
  parqueTruncado,
  hoy,
  tipos,
  perfiles,
  origenes,
  parque,
  canchas,
  mostrarAvisoMigracion,
  puedeCrearOportunidad,
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
  empresa: Empresa;
  contactos: Contacto[];
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  ventas: VentaCuenta[];
  actividades: Actividad[];
  /** F5: cambios de etapa de las oportunidades de la cuenta, avisos de recambio enviados y si algo pasó el tope. */
  cambios: CambioEtapaFila[];
  avisos: AvisoCuenta[];
  truncado: Cuenta360["truncado"];
  /** Fecha de la primera compra de toda la cuenta (aunque las ventas que se muestran estén recortadas). */
  primeraCompra: string | null;
  /** El parque instalado se leyó con tope y la empresa tiene más equipos de los que se ven. */
  parqueTruncado: boolean;
  /** Hoy en horario argentino (`aaaa-mm-dd`), calculado en el servidor para que no se desfase al hidratar. */
  hoy: string;
  tipos: Tipo[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Equipamiento entregado, agrupado por urgencia. `null` si el rol no puede ver ventas. */
  parque: GrupoParque[] | null;
  /** Canchas de la empresa. `null` si la base todavia no tiene la tabla (migracion 0011). */
  canchas: Cancha[] | null;
  /** Falta la migracion 0011 y quien mira administra la configuracion: se le avisa. */
  mostrarAvisoMigracion: boolean;
  puedeCrearOportunidad: boolean;
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
  const reactivar = useReactivar("empresa");
  const [empresa, setEmpresa] = useState(empresaInicial);
  const [contactos, setContactos] = useState(contactosIniciales);
  const [actividades, setActividades] = useState(actividadesIniciales);
  const [dandoDeBaja, setDandoDeBaja] = useState(false);

  // The payload outlives `open` on purpose so the drawer's title doesn't flip mid-animation.
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [open, setOpen] = useState(false);

  function abrir(next: DrawerState) {
    setDrawer(next);
    setOpen(true);
  }

  const resumen = useMemo(
    () =>
      resumenCuenta({
        ventas,
        oportunidades,
        actividades: puedeVerActividades ? actividades : null,
        hoy,
        primeraCompra,
      }),
    [ventas, oportunidades, actividades, puedeVerActividades, hoy, primeraCompra],
  );

  const verHistoria = useMemo(
    () => ({
      actividades: puedeVerActividades,
      etapas: puedeVerOportunidades,
      ventas: puedeVerVentas,
      avisos: puedeVerAvisos && puedeVerVentas,
    }),
    [puedeVerActividades, puedeVerOportunidades, puedeVerVentas, puedeVerAvisos],
  );

  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origen = origenes.find((o) => o.id === empresa.origen_id)?.nombre;
  const responsable = empresa.responsable_id ? perfilPorId.get(empresa.responsable_id) : null;
  const web = empresa.sitio_web ? hrefSitioWeb(empresa.sitio_web) : null;
  const deBaja = estaDeBaja(empresa.estado);
  const tipoCliente = etiquetaTipoCliente(empresa.tipo_cliente);

  const contactosOpciones = contactos
    .filter((c) => !estaDeBaja(c.estado))
    .map((c) => ({ id: c.id, label: nombreCompleto(c) }));
  const contactosNombres = contactos.map((c) => ({ id: c.id, label: nombreCompleto(c) }));
  const oportunidadesOpciones = oportunidades
    .filter((o) => o.estado === "abierta")
    .map((o) => ({ id: o.id, label: o.titulo }));

  function contactoGuardado(saved: Contacto) {
    // Si el contacto se mudó de empresa (o quedó sin ella), deja de estar en esta ficha.
    setContactos((prev) => {
      const sale = saved.empresa_id !== empresa.id;
      const existe = prev.some((c) => c.id === saved.id);
      const sin = prev.filter((c) => c.id !== saved.id);
      if (sale) return sin;
      return (existe ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]).sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      );
    });
    setOpen(false);
  }

  const tituloDrawer =
    drawer?.tipo === "empresa"
      ? "Editar empresa"
      : drawer?.tipo === "actividad"
        ? "Registrar actividad"
        : drawer?.contacto
          ? "Editar contacto"
          : "Nuevo contacto";

  const accionReactivar = puedeEditar ? (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={async () => {
        const fila = await reactivar(empresa.id, empresa.nombre);
        if (fila) setEmpresa(fila);
      }}
    >
      <Power aria-hidden="true" className="h-3.5 w-3.5" /> Reactivar
    </Button>
  ) : undefined;

  return (
    <div className="flex w-full flex-col gap-4">
      <nav aria-label="Ruta">
        <Link
          href="/empresas"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Empresas
        </Link>
      </nav>

      {/* CABECERA */}
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-brand/10 text-lg text-brand">{initials(empresa.nombre)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              <span className="h-px w-6 bg-brand" aria-hidden="true" />
              Ficha de empresa
            </p>
            <h1 className="break-words font-display text-[2rem] leading-tight tracking-[-0.01em]">{empresa.nombre}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoPill estado={empresa.estado} />
              {tipoCliente && <Pill tono="gris">{tipoCliente}</Pill>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {puedeEscribirActividad && puedeVerActividades && (
            <Button onClick={() => abrir({ tipo: "actividad" })} className="gap-1.5">
              <NotebookPen aria-hidden="true" className="h-4 w-4" /> Registrar actividad
            </Button>
          )}
          {puedeEditar && (
            <Button variant="outline" onClick={() => abrir({ tipo: "empresa" })} className="gap-1.5">
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

      <AvisoEstado estado={empresa.estado} entidad="empresa" accion={empresa.estado === "inactivo" ? accionReactivar : undefined} />

      {/* DATOS */}
      <Card className="p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="CUIT">{empresa.cuit && <span className="tabular-nums">{empresa.cuit}</span>}</Dato>
          <Dato label="Teléfono">{empresa.telefono}</Dato>
          <Dato label="Email">
            {empresa.email && (
              <a href={`mailto:${empresa.email}`} className="break-all text-brand underline-offset-4 hover:underline">
                {empresa.email}
              </a>
            )}
          </Dato>
          <Dato label="Sitio web">
            {empresa.sitio_web &&
              (web ? (
                <a
                  href={web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-brand underline-offset-4 hover:underline"
                >
                  {empresa.sitio_web}
                </a>
              ) : (
                empresa.sitio_web
              ))}
          </Dato>
          <Dato label="Dirección">{empresa.direccion}</Dato>
          <Dato label="Responsable">{responsable ?? "Sin asignar"}</Dato>
          <Dato label="Origen">{origen}</Dato>
          <Dato label="Alta">{formatFechaAlta(empresa.created_at)}</Dato>
          {empresa.notas && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Dato label="Observaciones">
                <span className="whitespace-pre-line text-muted-foreground">{empresa.notas}</span>
              </Dato>
            </div>
          )}
        </dl>
      </Card>

      {/* RESUMEN (F5): lo que la cuenta lleva comprado y hace cuánto no se habla */}
      {(puedeVerVentas || puedeVerOportunidades || puedeVerActividades) && (
        <ResumenCuentaCard
          resumen={resumen}
          mostrar={{ ventas: puedeVerVentas, oportunidades: puedeVerOportunidades, contacto: puedeVerActividades }}
          truncado={truncado}
        />
      )}

      {/* RUBRO (F4): las canchas del cliente y lo que ya tiene instalado */}
      <AvisoMigracion visible={mostrarAvisoMigracion} que="la ficha de canchas y el equipamiento sugerido" />
      {(canchas || parque) && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {canchas && (
            <CanchasSeccion
              empresa={{ id: empresa.id, nombre: empresa.nombre }}
              canchas={canchas}
              parque={parque}
              etapas={etapas}
              origenes={origenes}
              yoId={yoId}
              puedeEditar={puedeEditar}
              puedeCrearOportunidad={puedeCrearOportunidad && puedeVerOportunidades}
            />
          )}
          {parque && (
            <div className="flex min-w-0 flex-col gap-2">
              <ParqueInstalado grupos={parque} />
              {parqueTruncado && (
                <p className="rounded-md bg-secondary p-2.5 text-xs text-muted-foreground">
                  Se leyeron los 1000 equipos entregados más recientes: el parque puede estar incompleto.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {/* CONTACTOS */}
          <Seccion
            icon={Users}
            titulo="Contactos"
            cantidad={contactos.length}
            accion={
              puedeEditar ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrir({ tipo: "contacto" })}>
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Agregar
                </Button>
              ) : undefined
            }
          >
            {contactos.length ? (
              <ul className="divide-y divide-border">
                {contactos.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-muted-foreground">
                        {initials(nombreCompleto(c))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link href={`/contactos/${c.id}`} className="block truncate text-sm font-medium hover:text-brand">
                        {nombreCompleto(c)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.cargo, c.email, c.telefono].filter(Boolean).join(" · ") || "Sin cargo, mail ni teléfono"}
                      </p>
                    </div>
                    {estaDeBaja(c.estado) && <EstadoPill estado={c.estado} />}
                    {puedeEditar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Editar ${nombreCompleto(c)}`}
                        title={`Editar ${nombreCompleto(c)}`}
                        onClick={() => abrir({ tipo: "contacto", contacto: c })}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay a quién escribirle. Sumá quién compra en este cliente: nombre, mail y teléfono.
              </p>
            )}
          </Seccion>

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
            contactos={contactosNombres}
            ver={verHistoria}
            truncado={truncado}
            ia={iaDisponible ? <ResumenIA tipo="empresa" id={empresa.id} /> : undefined}
            accion={
              puedeEscribirActividad && puedeVerActividades ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrir({ tipo: "actividad" })}>
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
        title={tituloDrawer}
        subtitle={empresa.nombre}
        icon={drawer?.tipo === "contacto" ? UserRound : drawer?.tipo === "actividad" ? NotebookPen : Building2}
      >
        {drawer?.tipo === "empresa" ? (
          <EmpresaForm
            key={`empresa-${empresa.id}`}
            empresa={empresa}
            perfiles={perfiles}
            origenes={origenes}
            puedeAsignar={puedeAsignar}
            yoId={yoId}
            onSaved={(saved) => {
              setEmpresa(saved);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : drawer?.tipo === "contacto" ? (
          <ContactoForm
            key={drawer.contacto?.id ?? `nuevo-contacto-${empresa.id}`}
            contacto={drawer.contacto}
            empresaId={empresa.id}
            empresas={[{ id: empresa.id, nombre: empresa.nombre, estado: empresa.estado }]}
            perfiles={perfiles}
            origenes={origenes}
            puedeAsignar={puedeAsignar}
            yoId={yoId}
            onSaved={contactoGuardado}
            onCancel={() => setOpen(false)}
          />
        ) : drawer?.tipo === "actividad" ? (
          <ActividadForm
            key={`actividad-${empresa.id}`}
            empresaId={empresa.id}
            tipos={tipos}
            contactos={contactosOpciones}
            oportunidades={oportunidadesOpciones}
            avisoNoContactar={empresa.estado === "no_contactar"}
            onSaved={(nueva) => {
              setActividades((prev) => [nueva, ...prev]);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </Drawer>

      <BajaModal
        tipo="empresa"
        objetivo={dandoDeBaja ? { id: empresa.id, nombre: empresa.nombre } : null}
        onClose={() => setDandoDeBaja(false)}
        onHecho={setEmpresa}
      />
    </div>
  );
}
