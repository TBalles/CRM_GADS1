"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Mail, Pencil, Phone, Plus, Power, UserRound } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import { BajaModal, useReactivar } from "@/components/BajaCliente";
import { EstadoPill } from "@/components/cliente";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  PageHeader,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  initials,
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnuncioResultados, BarraPendiente, CajaBusqueda, FiltroChip, FiltroSelect, useFiltrosUrl } from "@/components/FiltrosUrl";
import { Paginacion } from "@/components/Paginacion";
import { ESTADOS, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import ContactoForm, { type EmpresaOpcion } from "./ContactoForm";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;
/** La fila de la lista: el contacto y el nombre de su empresa (la trae la consulta, no depende de otra lista). */
type ContactoFila = Contacto & { empresa: { id: string; nombre: string } | null };

const VINCULOS = [
  { value: "", label: "Con y sin empresa" },
  { value: "empresa", label: "De una empresa" },
  { value: "individual", label: "Clientes individuales" },
];

export default function ContactosList({
  contactos,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  visiblesSinFiltro,
  dadosDeBaja,
  individuales,
  empresas,
  perfiles,
  origenes,
  puedeEditar,
  puedeAsignar,
  puedeVerTodos,
  yoId,
}: {
  /** Solo la página actual: el servidor busca, filtra y pagina (F3). */
  contactos: ContactoFila[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si algún conteo del encabezado falló: no se sabe si hay contactos, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Contactos que se verían sin ningún filtro (respetando "Ver bajas"). */
  visiblesSinFiltro: number;
  dadosDeBaja: number;
  individuales: number;
  /** Para el formulario (a qué empresa pertenece); no sale de la página. */
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  /** `clientes.ver_todos`: sin el, la base ya devuelve solo la cartera propia. */
  puedeVerTodos: boolean;
  yoId: string;
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  const reactivar = useReactivar("contacto");
  const [dandoDeBaja, setDandoDeBaja] = useState<Contacto | null>(null);
  const verBajas = filtros.valor("bajas") === "1";

  // The payload outlives `open` on purpose so the drawer's title doesn't flip mid-animation.
  const [editando, setEditando] = useState<Contacto | null>(null);
  const [open, setOpen] = useState(false);

  function abrir(contacto: Contacto | null) {
    setEditando(contacto);
    setOpen(true);
  }

  // La lista sale del servidor: después de guardar o dar de baja se le vuelve a pedir.
  function guardado() {
    setOpen(false);
    filtros.refrescar();
  }

  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);

  const base = Math.max(visiblesSinFiltro, total);
  const vacioReal = cuentasOk && !hayFiltro && visiblesSinFiltro + (verBajas ? 0 : dadosDeBaja) === 0;

  const acciones = (c: Contacto) => [
    { label: "Ver ficha", icon: Eye, onClick: () => router.push(`/contactos/${c.id}`) },
    ...(puedeEditar
      ? [
          { label: "Editar", icon: Pencil, onClick: () => abrir(c) },
          // "No contactar" es un pedido del cliente: no se deshace con un clic, se cambia desde Editar.
          ...(c.estado === "inactivo"
            ? [
                {
                  label: "Reactivar",
                  icon: Power,
                  onClick: async () => {
                    const fila = await reactivar(c.id, nombreCompleto(c), c.empresa_id);
                    if (fila) filtros.refrescar();
                  },
                },
              ]
            : c.estado === "no_contactar"
              ? []
              : [{ label: "Dar de baja", icon: Power, variant: "destructive" as const, onClick: () => setDandoDeBaja(c) }]),
        ]
      : []),
  ];

  /** Empresa del contacto como link, o el aviso de que es un cliente individual. */
  const vinculoCelda = (c: ContactoFila) => {
    if (!c.empresa_id) return <Pill tono="gris">Individual</Pill>;
    // Un vendedor puede ver un contacto cuya empresa es de otra cartera: la RLS no se la muestra.
    return c.empresa ? (
      <Link href={`/empresas/${c.empresa_id}`} className="block truncate hover:text-brand">
        {c.empresa.nombre}
      </Link>
    ) : (
      <span className="text-muted-foreground">Empresa de otra cartera</span>
    );
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        titulo="Contactos"
        eyebrow="Con quién hablás"
        meta={!cuentasOk ? `${total} contactos` : hayFiltro ? `${total} de ${base} contactos` : `${visiblesSinFiltro} contactos · ${individuales} individuales`}
        bajada="La gente de cada club y los clientes que compran por su cuenta. Los de una empresa también están en su ficha."
      >
        <CajaBusqueda filtros={filtros} etiqueta="Buscar contacto" placeholder="Buscar contacto…" />
        {puedeEditar && (
          <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm" aria-label="Nuevo contacto">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuevo contacto</span>
          </Button>
        )}
      </PageHeader>

      {!vacioReal && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
          <FiltroSelect
            filtros={filtros}
            param="estado"
            etiqueta="Filtrar por estado"
            className="sm:w-44"
            opciones={[{ value: "", label: "Todos los estados" }, ...ESTADOS.map((s) => ({ value: s.value, label: s.label }))]}
          />
          <FiltroSelect filtros={filtros} param="vinculo" etiqueta="Filtrar por empresa o individual" className="sm:w-52" opciones={VINCULOS} />
          {puedeVerTodos && (
            <FiltroSelect
              filtros={filtros}
              param="responsable"
              etiqueta="Filtrar por responsable"
              opciones={[{ value: "", label: "Todos los responsables" }, ...perfiles.map((p) => ({ value: p.id, label: p.nombre }))]}
            />
          )}
          <FiltroSelect
            filtros={filtros}
            param="origen"
            etiqueta="Filtrar por origen"
            opciones={[{ value: "", label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))]}
          />
          <FiltroChip filtros={filtros} param="bajas">
            <Power aria-hidden="true" className="h-3.5 w-3.5" />
            Ver bajas
            <span className="font-mono tabular-nums">({dadosDeBaja})</span>
          </FiltroChip>
          {hayFiltro && (
            <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()} className="h-9">
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4" aria-busy={filtros.pending}>
        <BarraPendiente pending={filtros.pending} />
        <AnuncioResultados total={total} />
        {vacioReal ? (
          <EmptyState
            escena="cancha"
            text={puedeVerTodos ? "Todavía no hay contactos" : "Tu cartera de contactos está vacía"}
            hint={
              puedeVerTodos
                ? "Cargá a quien te atiende en cada club, o a un cliente que compra por su cuenta. Con nombre, mail y teléfono alcanza."
                : "Acá ves los contactos que cargás o que te asignan, y los de tus empresas. Cargá el primero."
            }
            action={
              puedeEditar ? (
                <Button onClick={() => abrir(null)} className="gap-2">
                  <Plus aria-hidden="true" className="h-4 w-4" /> Nuevo contacto
                </Button>
              ) : undefined
            }
          />
        ) : total === 0 ? (
          <EmptyState
            escena="afuera"
            text={
              q
                ? `Ningún contacto con «${q}»`
                : visiblesSinFiltro === 0 && !hayFiltro
                  ? "No hay contactos activos"
                  : "Ningún contacto con esos filtros"
            }
            hint={
              visiblesSinFiltro === 0 && !hayFiltro
                ? `Los ${dadosDeBaja} que tenés están dados de baja. Activá «Ver bajas» para verlos o reactivarlos.`
                : "Probá con el mail, el teléfono, el documento o el nombre de la empresa, o aflojá los filtros."
            }
            action={
              hayFiltro ? (
                <Button variant="outline" onClick={() => filtros.limpiar()}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* MOBILE: una card por fila */}
            <ul className="space-y-2 md:hidden">
              {contactos.map((c) => (
                <li key={c.id}>
                  <Card className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-secondary text-muted-foreground">{initials(nombreCompleto(c))}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link href={`/contactos/${c.id}`} className="block truncate text-sm font-semibold hover:text-brand">
                          {nombreCompleto(c)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.cargo ?? "Sin cargo"}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <EstadoPill estado={c.estado} />
                          {!c.empresa_id && <Pill tono="gris">Individual</Pill>}
                        </div>
                      </div>
                      <RowActions label={`Acciones de ${nombreCompleto(c)}`} items={acciones(c)} />
                    </div>
                    <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                      {c.empresa_id && <p className="truncate">Empresa: {c.empresa?.nombre ?? "—"}</p>}
                      <p className="truncate">Responsable: {(c.responsable_id && perfilPorId.get(c.responsable_id)) || "Sin asignar"}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            {/* DESKTOP: tabla */}
            <Card className="hidden overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactos.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-secondary text-muted-foreground">{initials(nombreCompleto(c))}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link href={`/contactos/${c.id}`} className="block truncate font-medium hover:text-brand">
                              {nombreCompleto(c)}
                            </Link>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {c.cargo && <span className="truncate">{c.cargo}</span>}
                              {c.email && (
                                <span className="flex min-w-0 items-center gap-1">
                                  <Mail aria-hidden="true" className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{c.email}</span>
                                </span>
                              )}
                              {c.telefono && (
                                <span className="flex items-center gap-1">
                                  <Phone aria-hidden="true" className="h-3 w-3 shrink-0" />
                                  {c.telefono}
                                </span>
                              )}
                              {!c.cargo && !c.email && !c.telefono && (
                                <span className="flex items-center gap-1">
                                  <UserRound aria-hidden="true" className="h-3 w-3" /> Sin datos de contacto
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[14rem]">{vinculoCelda(c)}</TableCell>
                      <TableCell>
                        <EstadoPill estado={c.estado} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {(c.responsable_id && perfilPorId.get(c.responsable_id)) || (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RowActions label={`Acciones de ${nombreCompleto(c)}`} items={acciones(c)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Paginacion total={total} page={page} pageSize={pageSize} filtros={filtros} />
          </>
        )}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? "Editar contacto" : "Nuevo contacto"}
        subtitle={editando ? nombreCompleto(editando) : undefined}
        icon={UserRound}
      >
        <ContactoForm
          key={editando?.id ?? "nuevo-contacto"}
          contacto={editando ?? undefined}
          empresas={empresas}
          perfiles={perfiles}
          origenes={origenes}
          puedeAsignar={puedeAsignar}
          yoId={yoId}
          onSaved={guardado}
          onCancel={() => setOpen(false)}
        />
      </Drawer>

      <BajaModal
        tipo="contacto"
        objetivo={dandoDeBaja ? { id: dandoDeBaja.id, nombre: nombreCompleto(dandoDeBaja) } : null}
        onClose={() => setDandoDeBaja(null)}
        onHecho={() => filtros.refrescar()}
      />
    </div>
  );
}
