"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, MailPlus, Plus, Power, Search, ShieldCheck, UserPlus } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import { Campo, CampoGrupo, FormActions, FormBanner } from "@/components/form";
import { Badge, Button, Card, Input } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OverlayCarga } from "@/components/ui/OverlayCarga";
import { cn } from "@/lib/utils";
import { agregarAdministrador, cambiarEstadoCliente, crearCliente, reenviarInvitacionAdmin } from "./actions";

type AdminFila = { id: string; nombre: string | null; email: string | null; pendiente: boolean; activo: boolean };
type Cliente = {
  id: string;
  nombre: string;
  activa: boolean;
  created_at: string;
  usuarios: number;
  admins: AdminFila[];
};

type Panel = { tipo: "nuevo" } | { tipo: "admin"; cliente: Cliente };

function ClienteForm({
  cliente,
  onDone,
  onCancel,
}: {
  /** Sin cliente: alta de cliente + su admin. Con cliente: otro admin para ese cliente. */
  cliente?: Cliente;
  onDone: (linkManual?: string) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = cliente
      ? await agregarAdministrador({ organizacionId: cliente.id, nombre: adminNombre, email: adminEmail })
      : await crearCliente({ nombre, adminNombre, adminEmail });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    showToast(
      res.linkManual ? "Listo. Compartí el link de activación." : `Invitación enviada a ${adminEmail.trim()}.`,
      "success",
    );
    onDone(res.linkManual);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}
      {!cliente && (
        <Campo
          id="cli-nombre"
          label="Nombre del cliente"
          required
          autoFocus
          placeholder="Distribuidora Deportiva del Oeste"
          value={nombre}
          onChange={setNombre}
        />
      )}
      <CampoGrupo title="Administrador del cliente" icon={ShieldCheck}>
        <Campo
          id="cli-admin-nombre"
          label="Nombre y apellido"
          required
          autoFocus={Boolean(cliente)}
          value={adminNombre}
          onChange={setAdminNombre}
        />
        <Campo
          id="cli-admin-email"
          label="Email"
          type="email"
          inputMode="email"
          required
          placeholder="admin@cliente.com"
          value={adminEmail}
          onChange={setAdminEmail}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Recibe un mail para elegir su contraseña. Entra con el rol <strong>Administrador</strong>: puede
          invitar a su equipo, asignar roles y crear roles nuevos.
        </p>
      </CampoGrupo>
      {!cliente && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          El cliente arranca con los roles Administrador, Ventas, Corporativo y Solo lectura, y con las
          etapas del embudo por defecto. Sus datos quedan aislados del resto.
        </p>
      )}
      <FormActions saving={saving} onCancel={onCancel} submitLabel={cliente ? "Agregar administrador" : "Crear cliente"} />
    </form>
  );
}

export default function AdminView({ clientes, miOrgId }: { clientes: Cliente[]; miOrgId: string | null }) {
  const router = useRouter();
  const [refrescando, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [open, setOpen] = useState(false);
  const [linkManual, setLinkManual] = useState<string | null>(null);
  const [suspender, setSuspender] = useState<Cliente | null>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      `${c.nombre} ${c.admins.map((a) => `${a.nombre} ${a.email}`).join(" ")}`.toLowerCase().includes(q),
    );
  }, [clientes, query]);

  function abrir(p: Panel) {
    setPanel(p);
    setOpen(true);
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

  return (
    <div className="flex w-full flex-col gap-4">
      <OverlayCarga visible={ocupado || refrescando} texto={ocupado ? "Guardando…" : "Actualizando…"} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empresas que usan el CRM. Cada una ve solo sus propios datos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente o admin…"
              aria-label="Buscar cliente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button onClick={() => abrir({ tipo: "nuevo" })} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nuevo cliente</span>
          </Button>
        </div>
      </div>

      {linkManual && (
        <Card className="border-brand/40 p-4">
          <p className="text-sm font-semibold">El envío de mails no está configurado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compartí este link de activación con el administrador por otro medio. Vence en poco tiempo.
          </p>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={linkManual} className="h-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() =>
                navigator.clipboard.writeText(linkManual).then(
                  () => showToast("Link copiado.", "success"),
                  () => showToast("No se pudo copiar: seleccionalo a mano.", "error"),
                )
              }
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLinkManual(null)}>
              Cerrar
            </Button>
          </div>
        </Card>
      )}

      {!clientes.length ? (
        <EmptyState icon={Building2} text="Todavía no hay clientes" hint="Creá el primero con su administrador." />
      ) : !filtrados.length ? (
        <EmptyState icon={Search} text="Sin resultados" hint="Probá con otro nombre o email." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtrados.map((c) => (
            <Card key={c.id} className={cn("p-4", !c.activa && "opacity-60")}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                  <Building2 className="h-5 w-5 text-brand" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {c.nombre}
                    {c.id === miOrgId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(la tuya)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.usuarios} {c.usuarios === 1 ? "usuario activo" : "usuarios activos"}
                  </p>
                </div>
                <Badge variant={c.activa ? "success" : "secondary"} className="shrink-0">
                  {c.activa ? "Activo" : "Suspendido"}
                </Badge>
                <RowActions
                  label={`Acciones de ${c.nombre}`}
                  items={[
                    { label: "Agregar administrador", icon: UserPlus, onClick: () => abrir({ tipo: "admin", cliente: c }) },
                    c.activa
                      ? { label: "Suspender", icon: Power, variant: "destructive", onClick: () => setSuspender(c) }
                      : {
                          label: "Reactivar",
                          icon: Power,
                          onClick: () => ejecutar(cambiarEstadoCliente({ id: c.id, activa: true }), "Cliente reactivado."),
                        },
                  ]}
                />
              </div>

              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {c.admins.length ? (
                  c.admins.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate">
                        {a.nombre} <span className="text-muted-foreground">· {a.email}</span>
                      </span>
                      {!a.activo ? (
                        <Badge variant="secondary">De baja</Badge>
                      ) : a.pendiente ? (
                        <button
                          type="button"
                          onClick={() => ejecutar(reenviarInvitacionAdmin({ id: a.id }), `Invitación reenviada a ${a.email}.`)}
                          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                          title="Reenviar invitación"
                        >
                          <MailPlus className="h-3.5 w-3.5" /> Pendiente
                        </button>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-destructive">Sin administrador: agregale uno.</li>
                )}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={panel?.tipo === "admin" ? "Agregar administrador" : "Nuevo cliente"}
        subtitle={panel?.tipo === "admin" ? panel.cliente.nombre : "Se crea con su administrador"}
        icon={panel?.tipo === "admin" ? UserPlus : Building2}
      >
        {panel && (
          <ClienteForm
            key={panel.tipo === "admin" ? panel.cliente.id : "nuevo"}
            cliente={panel.tipo === "admin" ? panel.cliente : undefined}
            onCancel={() => setOpen(false)}
            onDone={(link) => {
              if (link) setLinkManual(link);
              setOpen(false);
              startTransition(() => router.refresh());
            }}
          />
        )}
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(suspender)}
        onClose={() => setSuspender(null)}
        onConfirm={() => {
          if (suspender) ejecutar(cambiarEstadoCliente({ id: suspender.id, activa: false }), "Cliente suspendido.");
          setSuspender(null);
        }}
        title="Suspender cliente"
        description={
          suspender
            ? `Todos los usuarios de "${suspender.nombre}" pierden el acceso al instante. Sus datos se conservan y lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Suspender"
        variant="danger"
        icon={<Power className="h-6 w-6" />}
      />
    </div>
  );
}
