"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, Mail, Pencil, Phone, Plus, Power, Search, Users } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import { BajaModal, useReactivar } from "@/components/BajaCliente";
import { EstadoPill } from "@/components/cliente";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  initials,
} from "@/components/ui/UIComponents";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ESTADOS,
  estaDeBaja,
  etiquetaTipoCliente,
  type OrigenOpcion,
  type PerfilOpcion,
} from "@/lib/clientes";
import { cn } from "@/lib/utils";
import EmpresaForm from "./EmpresaForm";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
/** Lo mínimo de cada contacto: alcanza para contarlos y para que la búsqueda encuentre a la empresa por su gente. */
export type ContactoResumen = Pick<Tables<"contactos">, "id" | "empresa_id" | "nombre" | "apellido" | "email" | "estado">;

const TODOS = "";

export default function EmpresasList({
  empresas,
  contactos,
  perfiles,
  origenes,
  puedeEditar,
  puedeAsignar,
  puedeVerTodos,
  yoId,
}: {
  empresas: Empresa[];
  contactos: ContactoResumen[];
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
  const reactivar = useReactivar("empresa");
  const [lista, setLista] = useState(empresas);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState(TODOS);
  const [responsable, setResponsable] = useState(TODOS);
  const [origen, setOrigen] = useState(TODOS);
  const [verBajas, setVerBajas] = useState(false);
  const [dandoDeBaja, setDandoDeBaja] = useState<Empresa | null>(null);

  // The payload outlives `open` on purpose: clearing it on close would flip the
  // drawer's title halfway through the exit animation.
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [open, setOpen] = useState(false);

  function abrir(empresa: Empresa | null) {
    setEditando(empresa);
    setOpen(true);
  }

  function guardada(saved: Empresa) {
    setLista((prev) => {
      const existe = prev.some((e) => e.id === saved.id);
      const next = existe ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
      return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
    setOpen(false);
  }

  function reemplazar(saved: Empresa) {
    setLista((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
  }

  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origenPorId = useMemo(() => new Map(origenes.map((o) => [o.id, o.nombre])), [origenes]);
  const contactosPorEmpresa = useMemo(() => {
    const m = new Map<string, ContactoResumen[]>();
    for (const c of contactos) {
      if (!c.empresa_id) continue;
      m.set(c.empresa_id, [...(m.get(c.empresa_id) ?? []), c]);
    }
    return m;
  }, [contactos]);

  const dadasDeBaja = lista.filter((e) => estaDeBaja(e.estado)).length;

  // Search spans the company and its contacts, so looking up a person's name
  // surfaces the company that holds them.
  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const coincide = (v: string | null) => Boolean(v && v.toLowerCase().includes(q));
    return lista.filter((e) => {
      // Un estado elegido a mano manda; sin elegir, las dadas de baja quedan escondidas.
      if (estado ? e.estado !== estado : !verBajas && estaDeBaja(e.estado)) return false;
      if (responsable && e.responsable_id !== responsable) return false;
      if (origen && e.origen_id !== origen) return false;
      if (!q) return true;
      return (
        coincide(e.nombre) ||
        coincide(e.cuit) ||
        coincide(e.email) ||
        coincide(e.telefono) ||
        coincide(e.direccion) ||
        (contactosPorEmpresa.get(e.id) ?? []).some(
          (c) => coincide(c.nombre) || coincide(c.apellido) || coincide(c.email),
        )
      );
    });
  }, [lista, query, estado, responsable, origen, verBajas, contactosPorEmpresa]);

  const hayFiltro = Boolean(query.trim() || estado || responsable || origen);
  const visiblesSinFiltro = verBajas ? lista.length : lista.length - dadasDeBaja;

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
                    if (fila) reemplazar(fila);
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
        meta={
          hayFiltro
            ? `${filtradas.length} de ${visiblesSinFiltro} empresas`
            : `${visiblesSinFiltro} empresas · ${contactos.length} contactos`
        }
        bajada="Clubes, canchas, complejos y escuelas de fútbol. Entrá a una ficha para ver su gente, sus oportunidades y todo lo que pasó."
      >
        <div className="relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa o contacto…"
            aria-label="Buscar empresa o contacto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        {puedeEditar && (
          <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm" aria-label="Nueva empresa">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva empresa</span>
          </Button>
        )}
      </PageHeader>

      {/* FILTROS */}
      {lista.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
          <div className="w-full sm:w-44">
            <span id="filtro-estado" className="sr-only">Filtrar por estado</span>
            <Select
              value={estado}
              aria-labelledby="filtro-estado"
              onChange={setEstado}
              placeholder="Todos los estados"
              options={[{ value: TODOS, label: "Todos los estados" }, ...ESTADOS.map((s) => ({ value: s.value, label: s.label }))]}
              className="h-9"
            />
          </div>
          {puedeVerTodos && (
            <div className="w-full sm:w-48">
              <span id="filtro-responsable" className="sr-only">Filtrar por responsable</span>
              <Select
                value={responsable}
                aria-labelledby="filtro-responsable"
                onChange={setResponsable}
                placeholder="Todos los responsables"
                options={[
                  { value: TODOS, label: "Todos los responsables" },
                  ...perfiles.map((p) => ({ value: p.id, label: p.nombre })),
                ]}
                className="h-9"
              />
            </div>
          )}
          <div className="w-full sm:w-48">
            <span id="filtro-origen" className="sr-only">Filtrar por origen</span>
            <Select
              value={origen}
              aria-labelledby="filtro-origen"
              onChange={setOrigen}
              placeholder="Todos los orígenes"
              options={[{ value: TODOS, label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))]}
              className="h-9"
            />
          </div>
          <button
            type="button"
            aria-pressed={verBajas}
            onClick={() => setVerBajas((v) => !v)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              verBajas
                ? "border-brand bg-brand/10 text-brand"
                : "border-input bg-background text-foreground hover:bg-accent",
            )}
          >
            <Power aria-hidden="true" className="h-3.5 w-3.5" />
            Ver dadas de baja
            <span className="font-mono tabular-nums">({dadasDeBaja})</span>
          </button>
        </div>
      )}

      {/* LISTA */}
      {!lista.length ? (
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
      ) : !filtradas.length ? (
        <EmptyState
          escena="afuera"
          text={
            query.trim()
              ? `Ninguna empresa con «${query.trim()}»`
              : visiblesSinFiltro === 0 && !hayFiltro
                ? "No hay empresas activas"
                : "Ninguna empresa con esos filtros"
          }
          hint={
            visiblesSinFiltro === 0 && !hayFiltro
              ? `Las ${dadasDeBaja} que tenés están dadas de baja. Activá «Ver dadas de baja» para verlas o reactivarlas.`
              : "Probá con el CUIT, el mail o el nombre de uno de sus contactos, o aflojá los filtros."
          }
        />
      ) : (
        <>
          {/* MOBILE: una card por fila */}
          <ul className="space-y-2 md:hidden">
            {filtradas.map((e) => {
              const gente = (contactosPorEmpresa.get(e.id) ?? []).filter((c) => !estaDeBaja(c.estado)).length;
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
                {filtradas.map((e) => {
                  const gente = (contactosPorEmpresa.get(e.id) ?? []).filter((c) => !estaDeBaja(c.estado)).length;
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
        </>
      )}

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
        onHecho={reemplazar}
      />
    </div>
  );
}
