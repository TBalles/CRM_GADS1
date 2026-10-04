"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, Mail, Pencil, Phone, Plus, Power, Users } from "lucide-react";
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
import {
  ESTADOS,
  TIPOS_CLIENTE,
  etiquetaTipoCliente,
  type OrigenOpcion,
  type PerfilOpcion,
} from "@/lib/clientes";
import EmpresaForm from "./EmpresaForm";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;

export default function EmpresasList({
  empresas,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  visiblesSinFiltro,
  dadasDeBaja,
  totalContactos,
  contactosPorEmpresa,
  perfiles,
  origenes,
  puedeEditar,
  puedeAsignar,
  puedeVerTodos,
  yoId,
}: {
  /** Solo la página actual: el servidor busca, filtra y pagina (F3). */
  empresas: Empresa[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si algún conteo del encabezado falló: no se sabe si hay empresas, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Empresas que se verían sin ningún filtro (respetando "Ver dadas de baja"). */
  visiblesSinFiltro: number;
  dadasDeBaja: number;
  totalContactos: number;
  /** Contactos activos de cada empresa de esta página. */
  contactosPorEmpresa: Record<string, number>;
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
  const reactivar = useReactivar("empresa");
  const [dandoDeBaja, setDandoDeBaja] = useState<Empresa | null>(null);
  const verBajas = filtros.valor("bajas") === "1";

  // The payload outlives `open` on purpose: clearing it on close would flip the
  // drawer's title halfway through the exit animation.
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [open, setOpen] = useState(false);

  function abrir(empresa: Empresa | null) {
    setEditando(empresa);
    setOpen(true);
  }

  // La lista sale del servidor: después de guardar o dar de baja se le vuelve a pedir.
  function guardada() {
    setOpen(false);
    filtros.refrescar();
  }

  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origenPorId = useMemo(() => new Map(origenes.map((o) => [o.id, o.nombre])), [origenes]);

  const base = Math.max(visiblesSinFiltro, total);
  const vacioReal = cuentasOk && !hayFiltro && visiblesSinFiltro + (verBajas ? 0 : dadasDeBaja) === 0;

  const acciones = (e: Empresa) => [
    { label: "Ver ficha", icon: Eye, onClick: () => router.push(`/empresas/${e.id}`) },
    ...(puedeEditar
      ? [
          { label: "Editar", icon: Pencil, onClick: () => abrir(e) },
          // "No contactar" es un pedido del cliente: no se deshace con un clic, se cambia desde Editar.
          ...(e.estado === "inactivo"
            ? [
                {
                  label: "Reactivar",
                  icon: Power,
                  onClick: async () => {
                    const fila = await reactivar(e.id, e.nombre);
                    if (fila) filtros.refrescar();
                  },
                },
              ]
            : e.estado === "no_contactar"
              ? []
              : [{ label: "Dar de baja", icon: Power, variant: "destructive" as const, onClick: () => setDandoDeBaja(e) }]),
        ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        titulo="Empresas"
        eyebrow="A quién le vendés"
        meta={!cuentasOk ? `${total} empresas` : hayFiltro ? `${total} de ${base} empresas` : `${visiblesSinFiltro} empresas · ${totalContactos} contactos`}
        bajada="Clubes, canchas, complejos y escuelas de fútbol. Entrá a una ficha para ver su gente, sus oportunidades y todo lo que pasó."
      >
        <CajaBusqueda filtros={filtros} etiqueta="Buscar empresa o contacto" placeholder="Buscar empresa o contacto…" />
        {puedeEditar && (
          <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm" aria-label="Nueva empresa">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva empresa</span>
          </Button>
        )}
      </PageHeader>

      {/* FILTROS */}
      {!vacioReal && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
          <FiltroSelect
            filtros={filtros}
            param="estado"
            etiqueta="Filtrar por estado"
            className="sm:w-44"
            opciones={[{ value: "", label: "Todos los estados" }, ...ESTADOS.map((s) => ({ value: s.value, label: s.label }))]}
          />
          <FiltroSelect
            filtros={filtros}
            param="tipo"
            etiqueta="Filtrar por tipo de cliente"
            className="sm:w-52"
            opciones={[{ value: "", label: "Todos los tipos" }, ...TIPOS_CLIENTE.map((t) => ({ value: t.value, label: t.label }))]}
          />
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
            Ver dadas de baja
            <span className="font-mono tabular-nums">({dadasDeBaja})</span>
          </FiltroChip>
          {hayFiltro && (
            <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()} className="h-9">
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* LISTA */}
      <div className="flex flex-col gap-4" aria-busy={filtros.pending}>
        <BarraPendiente pending={filtros.pending} />
        <AnuncioResultados total={total} />
        {vacioReal ? (
          <EmptyState
            escena="cancha"
            text={puedeVerTodos ? "La cartera está vacía" : "Tu cartera está vacía"}
            hint={
              puedeVerTodos
                ? "Cargá el primer club, cancha de fútbol 5 o escuela. Después entrá a su ficha y sumale su gente."
                : "Acá ves las empresas que cargás o que te asignan. Cargá la primera, o pedile a tu responsable comercial que te asigne alguna."
            }
            action={
              puedeEditar ? (
                <Button onClick={() => abrir(null)} className="gap-2">
                  <Plus aria-hidden="true" className="h-4 w-4" /> Nueva empresa
                </Button>
              ) : undefined
            }
          />
        ) : total === 0 ? (
          <EmptyState
            escena="afuera"
            text={
              q
                ? `Ninguna empresa con «${q}»`
                : visiblesSinFiltro === 0 && !hayFiltro
                  ? "No hay empresas activas"
                  : "Ninguna empresa con esos filtros"
            }
            hint={
              visiblesSinFiltro === 0 && !hayFiltro
                ? `Las ${dadasDeBaja} que tenés están dadas de baja. Activá «Ver dadas de baja» para verlas o reactivarlas.`
                : "Probá con el CUIT, el mail o el nombre de uno de sus contactos, o aflojá los filtros."
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
              {empresas.map((e) => {
                const gente = contactosPorEmpresa[e.id] ?? 0;
                return (
                  <li key={e.id}>
                    <Card className="p-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-brand/10 text-brand">{initials(e.nombre)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Link href={`/empresas/${e.id}`} className="block truncate text-sm font-semibold hover:text-brand">
                            {e.nombre}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {etiquetaTipoCliente(e.tipo_cliente) ?? "Sin tipo definido"}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <EstadoPill estado={e.estado} />
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users aria-hidden="true" className="h-3 w-3" />
                              <span className="tabular-nums">{gente}</span>
                              <span className="sr-only"> contactos</span>
                            </span>
                          </div>
                        </div>
                        <RowActions label={`Acciones de ${e.nombre}`} items={acciones(e)} />
                      </div>
                      <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                        <p className="truncate">Responsable: {(e.responsable_id && perfilPorId.get(e.responsable_id)) || "Sin asignar"}</p>
                        <p className="truncate">Origen: {(e.origen_id && origenPorId.get(e.origen_id)) || "Sin origen"}</p>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>

            {/* DESKTOP: tabla */}
            <Card className="hidden overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                    <TableHead className="hidden lg:table-cell">Origen</TableHead>
                    <TableHead className="text-right">Contactos</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e) => {
                    const gente = contactosPorEmpresa[e.id] ?? 0;
                    const responsableNombre = (e.responsable_id && perfilPorId.get(e.responsable_id)) || null;
                    const origenNombre = (e.origen_id && origenPorId.get(e.origen_id)) || null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-brand/10 text-brand">{initials(e.nombre)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link href={`/empresas/${e.id}`} className="block truncate font-medium hover:text-brand">
                                {e.nombre}
                              </Link>
                              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {e.email && (
                                  <span className="flex min-w-0 items-center gap-1">
                                    <Mail aria-hidden="true" className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{e.email}</span>
                                  </span>
                                )}
                                {e.telefono && (
                                  <span className="flex items-center gap-1">
                                    <Phone aria-hidden="true" className="h-3 w-3 shrink-0" />
                                    {e.telefono}
                                  </span>
                                )}
                                {!e.email && !e.telefono && <span>Sin mail ni teléfono</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{etiquetaTipoCliente(e.tipo_cliente) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <EstadoPill estado={e.estado} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {responsableNombre ?? <span className="text-muted-foreground">Sin asignar</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {origenNombre ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{gente}</TableCell>
                        <TableCell>
                          <RowActions label={`Acciones de ${e.nombre}`} items={acciones(e)} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
        title={editando ? "Editar empresa" : "Nueva empresa"}
        subtitle={editando?.nombre}
        icon={Building2}
      >
        {/* `key` remounts the form when the drawer is pointed at a different
            record, so its field state is seeded from the new props. */}
        <EmpresaForm
          key={editando?.id ?? "nueva-empresa"}
          empresa={editando ?? undefined}
          perfiles={perfiles}
          origenes={origenes}
          puedeAsignar={puedeAsignar}
          yoId={yoId}
          onSaved={guardada}
          onCancel={() => setOpen(false)}
        />
      </Drawer>

      <BajaModal
        tipo="empresa"
        objetivo={dandoDeBaja ? { id: dandoDeBaja.id, nombre: dandoDeBaja.nombre } : null}
        onClose={() => setDandoDeBaja(null)}
        onHecho={() => filtros.refrescar()}
      />
    </div>
  );
}
