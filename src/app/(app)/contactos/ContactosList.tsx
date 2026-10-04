"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Mail, Pencil, Phone, Plus, Power, Search, UserRound } from "lucide-react";
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
  Pill,
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
import { ESTADOS, estaDeBaja, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { cn } from "@/lib/utils";
import ContactoForm, { type EmpresaOpcion } from "./ContactoForm";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;

const TODOS = "";
const VINCULOS = [
  { value: TODOS, label: "Con y sin empresa" },
  { value: "empresa", label: "De una empresa" },
  { value: "individual", label: "Clientes individuales" },
];

export default function ContactosList({
  contactos,
  empresas,
  perfiles,
  origenes,
  puedeEditar,
  puedeAsignar,
  puedeVerTodos,
  yoId,
}: {
  contactos: Contacto[];
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
  const reactivar = useReactivar("contacto");
  const [lista, setLista] = useState(contactos);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState(TODOS);
  const [vinculo, setVinculo] = useState(TODOS);
  const [responsable, setResponsable] = useState(TODOS);
  const [verBajas, setVerBajas] = useState(false);
  const [dandoDeBaja, setDandoDeBaja] = useState<Contacto | null>(null);

  // The payload outlives `open` on purpose so the drawer's title doesn't flip mid-animation.
  const [editando, setEditando] = useState<Contacto | null>(null);
  const [open, setOpen] = useState(false);

  function abrir(contacto: Contacto | null) {
    setEditando(contacto);
    setOpen(true);
  }

  function guardado(saved: Contacto) {
    setLista((prev) => {
      const existe = prev.some((c) => c.id === saved.id);
      const next = existe ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
      return [...next].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
    });
    setOpen(false);
  }

  function reemplazar(saved: Contacto) {
    setLista((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
  }

  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const empresaPorId = useMemo(() => new Map(empresas.map((e) => [e.id, e.nombre])), [empresas]);

  const dadosDeBaja = lista.filter((c) => estaDeBaja(c.estado)).length;
  const visiblesSinFiltro = verBajas ? lista.length : lista.length - dadosDeBaja;

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const coincide = (v: string | null | undefined) => Boolean(v && v.toLowerCase().includes(q));
    return lista.filter((c) => {
      if (estado ? c.estado !== estado : !verBajas && estaDeBaja(c.estado)) return false;
      if (vinculo === "empresa" && !c.empresa_id) return false;
      if (vinculo === "individual" && c.empresa_id) return false;
      if (responsable && c.responsable_id !== responsable) return false;
      if (!q) return true;
      return (
        coincide(nombreCompleto(c)) ||
        coincide(c.documento) ||
        coincide(c.email) ||
        coincide(c.telefono) ||
        coincide(c.cargo) ||
        coincide(c.empresa_id ? empresaPorId.get(c.empresa_id) : null)
      );
    });
  }, [lista, query, estado, vinculo, responsable, verBajas, empresaPorId]);

  const hayFiltro = Boolean(query.trim() || estado || vinculo || responsable);
  const individuales = lista.filter((c) => !c.empresa_id && !estaDeBaja(c.estado)).length;

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
                    if (fila) reemplazar(fila);
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
  const vinculoCelda = (c: Contacto) => {
    if (!c.empresa_id) return <Pill tono="gris">Individual</Pill>;
    const nombre = empresaPorId.get(c.empresa_id);
    // Un vendedor puede ver un contacto cuya empresa es de otra cartera: la RLS no se la muestra.
    return nombre ? (
      <Link href={`/empresas/${c.empresa_id}`} className="block truncate hover:text-brand">
        {nombre}
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
        meta={
          hayFiltro
            ? `${filtrados.length} de ${visiblesSinFiltro} contactos`
            : `${visiblesSinFiltro} contactos · ${individuales} individuales`
        }
        bajada="La gente de cada club y los clientes que compran por su cuenta. Los de una empresa también están en su ficha."
      >
        <div className="relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contacto…"
            aria-label="Buscar contacto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        {puedeEditar && (
          <Button onClick={() => abrir(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm" aria-label="Nuevo contacto">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuevo contacto</span>
          </Button>
        )}
      </PageHeader>

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
          <div className="w-full sm:w-52">
            <span id="filtro-vinculo" className="sr-only">Filtrar por empresa o individual</span>
            <Select value={vinculo} onChange={setVinculo} options={VINCULOS} className="h-9" aria-labelledby="filtro-vinculo" />
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
            Ver bajas
            <span className="font-mono tabular-nums">({dadosDeBaja})</span>
          </button>
        </div>
      )}

      {!lista.length ? (
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
      ) : !filtrados.length ? (
        <EmptyState
          escena="afuera"
          text={
            query.trim()
              ? `Ningún contacto con «${query.trim()}»`
              : visiblesSinFiltro === 0 && !hayFiltro
                ? "No hay contactos activos"
                : "Ningún contacto con esos filtros"
          }
          hint={
            visiblesSinFiltro === 0 && !hayFiltro
              ? `Los ${dadosDeBaja} que tenés están dados de baja. Activá «Ver bajas» para verlos o reactivarlos.`
              : "Probá con el mail, el teléfono, el documento o el nombre de la empresa, o aflojá los filtros."
          }
        />
      ) : (
        <>
          {/* MOBILE: una card por fila */}
          <ul className="space-y-2 md:hidden">
            {filtrados.map((c) => (
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
                    {c.empresa_id && <p className="truncate">Empresa: {empresaPorId.get(c.empresa_id) ?? "—"}</p>}
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
                {filtrados.map((c) => (
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
        </>
      )}

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
        onHecho={reemplazar}
      />
    </div>
  );
}
