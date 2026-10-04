"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  KeyRound,
  Lock,
  MailPlus,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions, { type RowAction } from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import { Campo, CampoSelect, FormActions, FormBanner } from "@/components/form";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Pill,
  initials,
  tonoPara,
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OverlayCarga } from "@/components/ui/OverlayCarga";
import { AnuncioResultados, BarraPendiente, CajaBusqueda, FiltroSelect, useFiltrosUrl } from "@/components/FiltrosUrl";
import { Paginacion } from "@/components/Paginacion";
import { PERMISOS } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import { borrarRol, cambiarActivo, cambiarRol, invitarUsuario, reenviarInvitacion } from "./actions";
import RolForm, { type RolFila } from "./RolForm";

type UsuarioFila = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol_id: string | null;
  activo: boolean;
  activado_at: string | null;
};

type Panel =
  | { tipo: "invitar" }
  | { tipo: "rol-usuario"; usuario: UsuarioFila }
  | { tipo: "rol"; rol?: RolFila };

function Estado({ u }: { u: UsuarioFila }) {
  if (!u.activo) return <Pill tono="gris">De baja</Pill>;
  if (!u.activado_at) return <Pill tono="ambar">Invitación pendiente</Pill>;
  return <Pill tono="verde">Activo</Pill>;
}

/** Link de activación para compartir a mano cuando no hay SMTP configurado. */
function LinkManual({ link, onClose }: { link: string; onClose: () => void }) {
  const { showToast } = useToast();
  return (
    <Card className="border-brand/40 p-4">
      <p className="text-sm font-semibold">El envío de mails no está configurado</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Compartile este link a la persona por otro medio. Es personal y vence en poco tiempo.
      </p>
      <div className="mt-3 flex gap-2">
        <Input readOnly value={link} className="h-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => showToast("Link copiado.", "success"),
              () => showToast("No se pudo copiar: seleccionalo a mano.", "error"),
            );
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Card>
  );
}

function InvitarForm({
  roles,
  onDone,
  onCancel,
}: {
  roles: RolFila[];
  onDone: (linkManual?: string) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rolId, setRolId] = useState(() => roles.find((r) => r.nombre === "Vendedor")?.id ?? roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await invitarUsuario({ nombre, email, rolId });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    showToast(res.linkManual ? "Usuario creado." : `Invitación enviada a ${email.trim()}.`, "success");
    onDone(res.linkManual);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}
      <Campo id="inv-nombre" label="Nombre y apellido" required autoFocus value={nombre} onChange={setNombre} />
      <Campo
        id="inv-email"
        label="Email"
        type="email"
        inputMode="email"
        required
        placeholder="persona@empresa.com"
        value={email}
        onChange={setEmail}
      />
      <CampoSelect
        id="inv-rol"
        label="Rol"
        required
        options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
        value={rolId}
        onChange={setRolId}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Le llega un mail para elegir su contraseña y activar la cuenta. Hasta que lo haga, figura como
        &quot;invitación pendiente&quot;.
      </p>
      <FormActions saving={saving} onCancel={onCancel} submitLabel="Enviar invitación" />
    </form>
  );
}

function CambiarRolForm({
  usuario,
  roles,
  onDone,
  onCancel,
}: {
  usuario: UsuarioFila;
  roles: RolFila[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rolId, setRolId] = useState(usuario.rol_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await cambiarRol({ id: usuario.id, rolId });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    showToast("Rol actualizado.", "success");
    onDone();
  }

  const elegido = roles.find((r) => r.id === rolId);
  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}
      <CampoSelect
        id="cambiar-rol"
        label="Rol"
        required
        options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
        value={rolId}
        onChange={setRolId}
      />
      {elegido && (
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">{elegido.descripcion}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {PERMISOS.filter((p) => elegido.permisos.includes(p.clave)).map((p) => (
              <li key={p.clave}>
                <Pill tono={tonoPara(p.grupo)} className="font-medium">
                  {p.etiqueta}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormActions saving={saving} onCancel={onCancel} submitLabel="Guardar" />
    </form>
  );
}

export default function UsuariosView({
  tab,
  usuarios,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  totalUsuarios,
  usosPorRol,
  roles,
  yoId,
  miRolId,
}: {
  /** Usuarios o Roles: vive en la URL (`?tab=`). */
  tab: "usuarios" | "roles";
  /** Solo la página actual: el servidor busca, filtra y pagina (F3). */
  usuarios: UsuarioFila[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Usuarios de la organización, sin filtros. */
  totalUsuarios: number;
  /** Cuántos usuarios tiene cada rol (cuenta también a los dados de baja: la base no deja borrar un rol asignado). */
  usosPorRol: Record<string, number>;
  roles: RolFila[];
  yoId: string;
  miRolId: string | null;
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  const [refrescando, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const { showToast } = useToast();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [open, setOpen] = useState(false);
  const [linkManual, setLinkManual] = useState<string | null>(null);
  const [confirmBaja, setConfirmBaja] = useState<UsuarioFila | null>(null);
  const [confirmBorrarRol, setConfirmBorrarRol] = useState<RolFila | null>(null);

  const rolPorId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  function abrir(p: Panel) {
    setPanel(p);
    setOpen(true);
  }

  function refrescar() {
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function ejecutar(accion: Promise<{ ok: boolean; error?: string; linkManual?: string }>, exito: string) {
    setOcupado(true);
    const res = await accion;
    setOcupado(false);
    if (!res.ok) {
      showToast(res.error ?? "No se pudo completar la acción.", "error");
      return;
    }
    if (res.linkManual) setLinkManual(res.linkManual);
    else showToast(exito, "success");
    startTransition(() => router.refresh());
  }

  const accionesUsuario = (u: UsuarioFila): RowAction[] => {
    if (u.id === yoId) return [];
    const items: RowAction[] = [
      { label: "Cambiar rol", icon: KeyRound, onClick: () => abrir({ tipo: "rol-usuario", usuario: u }) },
    ];
    if (u.activo && !u.activado_at) {
      items.push({
        label: "Reenviar invitación",
        icon: MailPlus,
        onClick: () => ejecutar(reenviarInvitacion({ id: u.id }), `Invitación reenviada a ${u.email}.`),
      });
    }
    items.push(
      u.activo
        ? { label: "Dar de baja", icon: Power, variant: "destructive", onClick: () => setConfirmBaja(u) }
        : {
            label: "Reactivar",
            icon: Power,
            onClick: () => ejecutar(cambiarActivo({ id: u.id, activo: true }), "Usuario reactivado."),
          },
    );
    return items;
  };

  const titulo =
    panel?.tipo === "invitar"
      ? "Invitar usuario"
      : panel?.tipo === "rol-usuario"
        ? "Cambiar rol"
        : panel?.rol
          ? "Editar rol"
          : "Nuevo rol";

  return (
    <div className="flex w-full flex-col gap-4">
      <OverlayCarga visible={ocupado || refrescando} texto={ocupado ? "Guardando…" : "Actualizando…"} />
      <PageHeader
        titulo="Usuarios"
        eyebrow="El equipo"
        meta={hayFiltro && tab === "usuarios" ? `${total} de ${totalUsuarios} usuarios` : `${totalUsuarios} usuarios con acceso`}
        bajada="Quién entra al CRM de tu empresa y qué puede hacer cada uno."
      >
        <div role="tablist" aria-label="Secciones" className="flex rounded-lg border bg-secondary/40 p-0.5">
          {(
            [
              ["usuarios", "Usuarios", UsersRound],
              ["roles", "Roles", ShieldCheck],
            ] as const
          ).map(([valor, etiqueta, Icon]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={tab === valor}
              onClick={() => filtros.aplicar({ tab: valor === "usuarios" ? null : valor }, { historial: true })}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === valor ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {etiqueta}
            </button>
          ))}
        </div>
        {tab === "usuarios" ? (
          <Button onClick={() => abrir({ tipo: "invitar" })} className="h-9 gap-1.5 px-3 text-sm">
            <UserPlus className="h-3.5 w-3.5" /> Invitar usuario
          </Button>
        ) : (
          <Button onClick={() => abrir({ tipo: "rol" })} className="h-9 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" /> Nuevo rol
          </Button>
        )}
      </PageHeader>

      {linkManual && <LinkManual link={linkManual} onClose={() => setLinkManual(null)} />}

      {tab === "usuarios" ? (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
            <CajaBusqueda filtros={filtros} etiqueta="Buscar usuario" placeholder="Buscar por nombre, email o rol…" className="sm:w-72" />
            <FiltroSelect
              filtros={filtros}
              param="rol"
              etiqueta="Filtrar por rol"
              className="sm:w-48"
              opciones={[{ value: "", label: "Todos los roles" }, ...roles.map((r) => ({ value: r.id, label: r.nombre }))]}
            />
            <FiltroSelect
              filtros={filtros}
              param="estado"
              etiqueta="Filtrar por estado"
              className="sm:w-52"
              opciones={[
                { value: "", label: "Todos los estados" },
                { value: "activo", label: "Activos" },
                { value: "pendiente", label: "Invitación pendiente" },
                { value: "baja", label: "De baja" },
              ]}
            />
            {hayFiltro && (
              <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()} className="h-9">
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4" aria-busy={filtros.pending}>
            <BarraPendiente pending={filtros.pending} />
            <AnuncioResultados total={total} />
            {total === 0 ? (
              <EmptyState
                escena="afuera"
                text={q ? `Nadie del equipo con «${q}»` : "Nadie del equipo con esos filtros"}
                hint="Probá por mail o por rol, o aflojá los filtros."
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
                <div className="space-y-2">
                  {usuarios.map((u) => {
                    const rol = u.rol_id ? rolPorId.get(u.rol_id) : undefined;
                    const acciones = accionesUsuario(u);
                    return (
                      <Card key={u.id} className={cn("flex items-center gap-3 p-3", !u.activo && "opacity-60")}>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-brand/10 text-brand">{initials(u.nombre ?? u.email ?? "?")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {u.nombre ?? u.email}
                            {u.id === yoId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(vos)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          <Pill tono={rol ? (rol.es_admin ? "indigo" : tonoPara(rol.nombre)) : "gris"}>
                            {rol?.es_admin && <ShieldCheck className="h-3 w-3" />}
                            {rol?.nombre ?? "Sin rol"}
                          </Pill>
                          <Estado u={u} />
                        </div>
                        {acciones.length ? (
                          <RowActions label={`Acciones de ${u.nombre ?? u.email}`} items={acciones} />
                        ) : (
                          <span className="w-8" />
                        )}
                      </Card>
                    );
                  })}
                </div>

                <Paginacion total={total} page={page} pageSize={pageSize} filtros={filtros} />
              </>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {roles.map((r) => {
            const usos = usosPorRol[r.id] ?? 0;
            return (
              <Card key={r.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {r.es_admin && <ShieldCheck className="h-4 w-4 text-brand" />}
                      {r.nombre}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {usos} {usos === 1 ? "usuario" : "usuarios"}
                      {r.descripcion && ` · ${r.descripcion}`}
                    </p>
                  </div>
                  {r.es_admin ? (
                    <Badge variant="outline" className="shrink-0 gap-1" title="El rol Administrador no se puede modificar">
                      <Lock className="h-3 w-3" /> Fijo
                    </Badge>
                  ) : (
                    <RowActions
                      label={`Acciones del rol ${r.nombre}`}
                      items={[
                        { label: "Editar", icon: Pencil, onClick: () => abrir({ tipo: "rol", rol: r }) },
                        {
                          label: "Borrar",
                          icon: Trash2,
                          variant: "destructive",
                          onClick: () => setConfirmBorrarRol(r),
                        },
                      ]}
                    />
                  )}
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {PERMISOS.filter((p) => r.permisos.includes(p.clave)).map((p) => (
                    <li key={p.clave}>
                      <Pill tono={tonoPara(p.grupo)} className="font-medium">
                        {p.etiqueta}
                      </Pill>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={titulo}
        subtitle={panel?.tipo === "rol-usuario" ? (panel.usuario.nombre ?? panel.usuario.email ?? undefined) : undefined}
        icon={panel?.tipo === "rol" ? ShieldCheck : panel?.tipo === "rol-usuario" ? KeyRound : UserPlus}
      >
        {panel?.tipo === "invitar" ? (
          <InvitarForm
            roles={roles}
            onCancel={() => setOpen(false)}
            onDone={(link) => {
              if (link) setLinkManual(link);
              refrescar();
            }}
          />
        ) : panel?.tipo === "rol-usuario" ? (
          <CambiarRolForm
            key={panel.usuario.id}
            usuario={panel.usuario}
            roles={roles}
            onCancel={() => setOpen(false)}
            onDone={refrescar}
          />
        ) : panel?.tipo === "rol" ? (
          <RolForm
            key={panel.rol?.id ?? "nuevo-rol"}
            rol={panel.rol}
            esMiRol={Boolean(panel.rol && panel.rol.id === miRolId)}
            onCancel={() => setOpen(false)}
            onSaved={refrescar}
          />
        ) : null}
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(confirmBaja)}
        onClose={() => setConfirmBaja(null)}
        onConfirm={() => {
          if (confirmBaja) ejecutar(cambiarActivo({ id: confirmBaja.id, activo: false }), "Usuario dado de baja.");
          setConfirmBaja(null);
        }}
        title="Dar de baja al usuario"
        description={
          confirmBaja
            ? `${confirmBaja.nombre ?? confirmBaja.email} pierde el acceso al instante, aunque tenga la sesión abierta. Sus registros (ventas, bitácora) se conservan. Lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Dar de baja"
        variant="danger"
        icon={<Power className="h-6 w-6" />}
      />

      <ConfirmModal
        isOpen={Boolean(confirmBorrarRol)}
        onClose={() => setConfirmBorrarRol(null)}
        onConfirm={() => {
          if (confirmBorrarRol) ejecutar(borrarRol({ id: confirmBorrarRol.id }), "Rol borrado.");
          setConfirmBorrarRol(null);
        }}
        title="Borrar rol"
        description={confirmBorrarRol ? `Se borra el rol "${confirmBorrarRol.nombre}". Solo se puede si nadie lo tiene asignado.` : ""}
        confirmText="Borrar"
        variant="danger"
        icon={<Trash2 className="h-6 w-6" />}
      />
    </div>
  );
}
