"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import { Avatar, AvatarFallback, Badge, Button, Card, Input, initials } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import EmpresaForm from "./EmpresaForm";
import ContactoForm from "./ContactoForm";
import BitacoraPanel from "./BitacoraPanel";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;
type Bitacora = Tables<"bitacora_entradas">;

type DrawerState =
  | { type: "empresa"; mode: "create" }
  | { type: "empresa"; mode: "edit"; empresa: Empresa }
  | { type: "contacto"; mode: "create"; empresaId: string; empresaNombre: string }
  | { type: "contacto"; mode: "edit"; contacto: Contacto }
  | { type: "bitacora"; empresa: Empresa };

/** One metadata line: icon + value, dropped entirely when there's no value. */
function Meta({ icon: Icon, value }: { icon: React.ElementType; value: string | null }) {
  if (!value) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
  );
}

export default function EmpresasList({
  empresas,
  contactos,
  bitacora,
  puedeEditar,
  puedeVerBitacora,
  puedeEscribirBitacora,
}: {
  empresas: Empresa[];
  contactos: Contacto[];
  bitacora: Bitacora[];
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeVerBitacora: boolean;
  puedeEscribirBitacora: boolean;
}) {
  const [empresasState, setEmpresasState] = useState(empresas);
  const [contactosState, setContactosState] = useState(contactos);
  const [bitacoraState, setBitacoraState] = useState(bitacora);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The payload outlives `open` on purpose: clearing it on close would flip the
  // drawer's title and icon halfway through the exit animation.
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [open, setOpen] = useState(false);

  function openDrawer(next: DrawerState) {
    setDrawer(next);
    setOpen(true);
  }

  function closeDrawer() {
    setOpen(false);
  }

  function handleEmpresaSaved(saved: Empresa) {
    setEmpresasState((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
      return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
    closeDrawer();
  }

  function handleContactoSaved(saved: Contacto) {
    setContactosState((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
    });
    closeDrawer();
  }

  // Search spans the company and the contacts nested under it, so looking up a
  // person's name surfaces the company that holds them.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return empresasState;
    const matches = (v: string | null) => Boolean(v && v.toLowerCase().includes(q));
    return empresasState.filter(
      (e) =>
        matches(e.nombre) ||
        matches(e.cuit) ||
        matches(e.email) ||
        matches(e.telefono) ||
        matches(e.direccion) ||
        contactosState.some(
          (c) =>
            c.empresa_id === e.id &&
            (matches(c.nombre) || matches(c.apellido) || matches(c.email) || matches(c.cargo)),
        ),
    );
  }, [empresasState, contactosState, query]);

  const drawerTitle =
    drawer?.type === "bitacora"
      ? "Bitácora"
      : drawer?.type === "empresa"
        ? drawer.mode === "edit"
          ? "Editar empresa"
          : "Nueva empresa"
        : drawer?.mode === "edit"
          ? "Editar contacto"
          : "Nuevo contacto";

  const drawerIcon =
    drawer?.type === "bitacora"
      ? NotebookPen
      : drawer?.type === "contacto"
        ? UserRound
        : Building2;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* HEADER + TOOLBAR (DESIGN.md §4.4) */}
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden shrink-0 md:block">
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clubes, canchas, complejos y escuelas de fútbol. Desplegá una empresa para ver sus
            contactos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa o contacto…"
              aria-label="Buscar empresa o contacto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          {puedeEditar && (
            <Button
              onClick={() => openDrawer({ type: "empresa", mode: "create" })}
              className="h-9 shrink-0 gap-1.5 px-3 text-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nueva empresa</span>
            </Button>
          )}
        </div>
      </div>

      {/* LISTA */}
      {!empresasState.length ? (
        <EmptyState
          icon={Building2}
          text="Todavía no hay empresas registradas"
          hint="Cargá tu primer club, cancha o complejo deportivo para empezar."
          action={
            puedeEditar ? (
              <Button onClick={() => openDrawer({ type: "empresa", mode: "create" })} className="gap-2">
                <Plus className="h-4 w-4" /> Nueva empresa
              </Button>
            ) : undefined
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Search}
          text={`Sin resultados para "${query.trim()}"`}
          hint="Probá con otro nombre, CUIT, email o contacto."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((empresa) => {
            const empresaContactos = contactosState.filter((c) => c.empresa_id === empresa.id);
            const expanded = expandedId === empresa.id;

            return (
              <Card
                key={empresa.id}
                className={cn(
                  "overflow-hidden transition-all",
                  expanded ? "border-brand/30 shadow-md" : "hover:border-brand/20 hover:shadow-md",
                )}
              >
                {/* Cabecera clickeable del acordeón */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : empresa.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(expanded ? null : empresa.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30 active:scale-[0.998]"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-90",
                    )}
                  />

                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-brand/10 text-brand">
                      {initials(empresa.nombre)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{empresa.nombre}</p>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                      <Meta icon={Phone} value={empresa.telefono} />
                      <Meta icon={Mail} value={empresa.email} />
                      <Meta icon={MapPin} value={empresa.direccion} />
                      {!empresa.telefono && !empresa.email && !empresa.direccion && (
                        <span className="text-xs text-muted-foreground/70">
                          Sin datos de contacto
                        </span>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="secondary"
                    className="hidden shrink-0 gap-1.5 font-medium tabular-nums sm:inline-flex"
                  >
                    <Users className="h-3 w-3" />
                    {empresaContactos.length}
                  </Badge>

                  {(puedeEditar || puedeVerBitacora) && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        label={`Acciones de ${empresa.nombre}`}
                        items={[
                          ...(puedeEditar
                            ? [
                                {
                                  label: "Editar empresa",
                                  icon: Pencil,
                                  onClick: () => openDrawer({ type: "empresa", mode: "edit", empresa }),
                                },
                              ]
                            : []),
                          ...(puedeVerBitacora
                            ? [
                                {
                                  label: "Bitácora",
                                  icon: NotebookPen,
                                  onClick: () => openDrawer({ type: "bitacora", empresa }),
                                },
                              ]
                            : []),
                          ...(puedeEditar
                            ? [
                                {
                                  label: "Agregar contacto",
                                  icon: Plus,
                                  onClick: () =>
                                    openDrawer({
                                      type: "contacto",
                                      mode: "create",
                                      empresaId: empresa.id,
                                      empresaNombre: empresa.nombre,
                                    }),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </span>
                  )}
                </div>

                {/* Panel de contactos — acordeón por grid-template-rows (§9.6) */}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t bg-muted/20 p-3">
                      {empresa.cuit && (
                        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                          CUIT <span className="font-semibold tabular-nums text-foreground">{empresa.cuit}</span>
                        </p>
                      )}

                      {empresaContactos.length ? (
                        <ul className="space-y-1.5">
                          {empresaContactos.map((c) => {
                            const nombreCompleto = `${c.nombre} ${c.apellido ?? ""}`.trim();
                            return (
                              <li
                                key={c.id}
                                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 shadow-sm"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-secondary text-muted-foreground">
                                    {initials(nombreCompleto)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{nombreCompleto}</p>
                                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <Meta icon={UserRound} value={c.cargo} />
                                    <Meta icon={Mail} value={c.email} />
                                    <Meta icon={Phone} value={c.telefono} />
                                  </div>
                                </div>
                                {puedeEditar && (
                                  <RowActions
                                    label={`Acciones de ${nombreCompleto}`}
                                    items={[
                                      {
                                        label: "Editar contacto",
                                        icon: Pencil,
                                        onClick: () =>
                                          openDrawer({ type: "contacto", mode: "edit", contacto: c }),
                                      },
                                    ]}
                                  />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <EmptyState
                          compact
                          icon={Users}
                          text="Sin contactos asociados"
                          className="py-8"
                        />
                      )}

                      {puedeEditar && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openDrawer({
                            type: "contacto",
                            mode: "create",
                            empresaId: empresa.id,
                            empresaNombre: empresa.nombre,
                          })
                        }
                        className="mt-2.5 w-full gap-1.5 sm:w-auto"
                      >
                        <Plus className="h-3.5 w-3.5" /> Agregar contacto
                      </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* DRAWERS */}
      <Drawer
        open={open}
        onClose={closeDrawer}
        title={drawerTitle}
        subtitle={
          drawer?.type === "bitacora"
            ? drawer.empresa.nombre
            : drawer?.type === "contacto" && drawer.mode === "create"
              ? drawer.empresaNombre
              : undefined
        }
        icon={drawerIcon}
      >
        {/* `key` remounts the form when the drawer is pointed at a different
            record, so its field state is seeded from the new props. */}
        {drawer?.type === "empresa" ? (
          <EmpresaForm
            key={drawer.mode === "edit" ? drawer.empresa.id : "nueva-empresa"}
            empresa={drawer.mode === "edit" ? drawer.empresa : undefined}
            onSaved={handleEmpresaSaved}
            onCancel={closeDrawer}
          />
        ) : drawer?.type === "bitacora" ? (
          <BitacoraPanel
            key={drawer.empresa.id}
            empresaId={drawer.empresa.id}
            entradas={bitacoraState.filter((b) => b.empresa_id === drawer.empresa.id)}
            contactos={contactosState.filter((c) => c.empresa_id === drawer.empresa.id)}
            puedeEscribir={puedeEscribirBitacora}
            onCreada={(entrada) => setBitacoraState((prev) => [entrada, ...prev])}
          />
        ) : drawer?.type === "contacto" ? (
          <ContactoForm
            key={drawer.mode === "edit" ? drawer.contacto.id : `nuevo-contacto-${drawer.empresaId}`}
            contacto={drawer.mode === "edit" ? drawer.contacto : undefined}
            empresaId={drawer.mode === "create" ? drawer.empresaId : undefined}
            empresas={empresasState}
            onSaved={handleContactoSaved}
            onCancel={closeDrawer}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
