"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MailPlus, Plus, Power, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { CellActions, DataTable, TBody, THead, TableMessage, Td, Th, Tr } from "@/components/crm/DataTable";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { FormSection } from "@/components/crm/Drawer";
import { EmptyState } from "@/components/crm/Feedback";
import { LinkManual } from "@/components/crm/LinkManual";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { StatusDot } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { SearchInput, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { CampoTexto, FormDrawer, useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { sinTrabarse } from "@/lib/guardar";
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
type Resultado = { ok: boolean; error?: string; linkManual?: string };

type Panel = { tipo: "nuevo" } | { tipo: "admin"; cliente: Cliente };

/**
 * Panel de plataforma (CRM 2.0, Lote F): las empresas que usan el CRM como una tabla densa, con las mismas acciones
 * que antes (Nuevo cliente; por cliente: Agregar administrador, Suspender / Reactivar; por administrador pendiente:
 * reenviar la invitación) y los mismos mensajes. La búsqueda filtra en el cliente (nombre del cliente, nombre o mail
 * de sus administradores), como antes.
 */
export default function AdminView({ clientes, miOrgId }: { clientes: Cliente[]; miOrgId: string | null }) {
  const router = useRouter();
  const [refrescando, startTransition] = React.useTransition();
  const [ocupado, setOcupado] = React.useState(false);
  const { showToast } = useCrmToast();
  const [query, setQuery] = React.useState("");
  const editor = useApertura<Panel>();
  const [linkManual, setLinkManual] = React.useState<string | null>(null);
  const [suspender, setSuspender] = React.useState<Cliente | null>(null);

  const filtrados = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => `${c.nombre} ${c.admins.map((a) => `${a.nombre} ${a.email}`).join(" ")}`.toLowerCase().includes(q));
  }, [clientes, query]);

  /** Una acción de fila: si tira (red caída, Server Action abortada) también se libera y se avisa. */
  async function ejecutar(accion: () => Promise<Resultado>, exito: string) {
    setOcupado(true);
    let res: Resultado;
    try {
      res = await accion();
    } catch {
      res = { ok: false, error: "No se pudo completar la acción." };
    } finally {
      setOcupado(false);
    }
    if (!res.ok) {
      showToast(res.error ?? "No se pudo completar la acción.", "error");
      return;
    }
    if (res.linkManual) setLinkManual(res.linkManual);
    else showToast(exito, "success");
    startTransition(() => router.refresh());
  }

  function menuDe(c: Cliente): MenuItem[] {
    const items: MenuItem[] = [{ label: "Agregar administrador", icon: UserPlus, onSelect: () => editor.abrir({ tipo: "admin", cliente: c }) }];
    // Antes era el botón "Pendiente" junto al administrador; ahora va con las demás acciones del cliente.
    for (const a of c.admins.filter((x) => x.activo && x.pendiente)) {
      items.push({
        label: `Reenviar invitación a ${a.email}`,
        icon: MailPlus,
        onSelect: () => void ejecutar(() => reenviarInvitacionAdmin({ id: a.id }), `Invitación reenviada a ${a.email}.`),
      });
    }
    items.push(
      c.activa
        ? { label: "Suspender", icon: Power, variant: "danger", onSelect: () => setSuspender(c) }
        : { label: "Reactivar", icon: Power, onSelect: () => void ejecutar(() => cambiarEstadoCliente({ id: c.id, activa: true }), "Cliente reactivado.") },
    );
    return items;
  }

  const q = query.trim();
  const panel = editor.valor;

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar
        title="Clientes"
        count={q ? `${filtrados.length} de ${clientes.length} clientes` : `${clientes.length} clientes en la plataforma`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => editor.abrir({ tipo: "nuevo" })} aria-label="Nuevo cliente" className="max-sm:w-8 max-sm:px-0">
            <span className="max-sm:sr-only">Nuevo cliente</span>
          </Button>
        }
      />
      {/* Lo que antes decía el overlay de "Guardando…" / "Actualizando…", para lectores de pantalla. */}
      <p role="status" className="sr-only">
        {ocupado ? "Guardando…" : refrescando ? "Actualizando…" : ""}
      </p>

      {clientes.length > 0 && (
        <Toolbar>
          <SearchInput label="Buscar cliente" placeholder="Buscar cliente o admin…" value={query} onChange={setQuery} onClear={() => setQuery("")} />
        </Toolbar>
      )}

      {linkManual && (
        <LinkManual link={linkManual} onClose={() => setLinkManual(null)}>
          Compartí este link de activación con el administrador por otro medio. Vence en poco tiempo.
        </LinkManual>
      )}

      {!clientes.length ? (
        <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
          <EmptyState title="Todavía no hay clientes en la plataforma" description="Dá de alta el primero junto con su administrador." />
        </div>
      ) : (
        <div className="flex min-h-0 flex-col pb-3">
          <DataTable label="Clientes" busy={ocupado || refrescando} className="min-h-0">
            <THead>
              <Th>Cliente</Th>
              <Th hideBelow="md">Administradores</Th>
              <Th width={136} align="right" hideBelow="sm">
                Usuarios activos
              </Th>
              <Th width={128} hideBelow="sm">
                Estado
              </Th>
              <Th width={48}>
                <span className="sr-only">Acciones</span>
              </Th>
            </THead>
            <TBody>
              {!filtrados.length ? (
                <TableMessage colSpan={5}>
                  <EmptyState compact title={`Ningún cliente con «${q}»`} description="Probá por nombre o por el mail de su administrador." />
                </TableMessage>
              ) : (
                filtrados.map((c) => <Fila key={c.id} cliente={c} esMia={c.id === miOrgId} menu={menuDe(c)} />)
              )}
            </TBody>
          </DataTable>
        </div>
      )}

      {panel && (
        <ClienteForm
          key={editor.n}
          open={editor.abierto}
          onClose={editor.cerrar}
          cliente={panel.tipo === "admin" ? panel.cliente : undefined}
          onDone={(link) => {
            if (link) setLinkManual(link);
            editor.cerrar();
            startTransition(() => router.refresh());
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(suspender)}
        onClose={() => setSuspender(null)}
        onConfirm={async () => {
          if (suspender) await ejecutar(() => cambiarEstadoCliente({ id: suspender.id, activa: false }), "Cliente suspendido.");
        }}
        title="Suspender cliente"
        description={
          suspender
            ? `Todos los usuarios de "${suspender.nombre}" pierden el acceso al instante. Sus datos se conservan y lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Suspender"
        variant="danger"
      />
    </div>
  );
}

/** Un administrador: nombre · mail y, si corresponde, "Pendiente" (no activó su cuenta) o "De baja". */
function Admin({ a }: { a: AdminFila }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-(--crm-accent-text)" />
      <Tooltip content={`${a.nombre ?? ""} · ${a.email ?? ""}`} onlyWhenTruncated>
        <span className="min-w-0 truncate">
          {a.nombre} <span className="text-(--crm-text-2)">· {a.email}</span>
        </span>
      </Tooltip>
      {!a.activo ? (
        <StatusDot tone="neutral" className="shrink-0">
          De baja
        </StatusDot>
      ) : a.pendiente ? (
        <StatusDot tone="warning" className="shrink-0">
          Pendiente
        </StatusDot>
      ) : null}
    </li>
  );
}

/**
 * Una fila. Los administradores van en su columna desde 45rem de tabla; con menos, debajo del nombre (junto con el
 * estado si está suspendido y los usuarios activos), sin perder ninguno. Un cliente suspendido lleva el nombre en
 * `--crm-text-2` además de "Suspendido" (antes se atenuaba la tarjeta entera, debajo de AA).
 */
function Fila({ cliente: c, esMia, menu }: { cliente: Cliente; esMia: boolean; menu: MenuItem[] }) {
  const usuarios = `${c.usuarios} ${c.usuarios === 1 ? "usuario activo" : "usuarios activos"}`;
  const admins = c.admins.length ? (
    <ul className="flex min-w-0 flex-col gap-0.5">
      {c.admins.map((a) => (
        <Admin key={a.id} a={a} />
      ))}
    </ul>
  ) : (
    <p className="text-(--crm-danger)">Sin administrador: agregale uno.</p>
  );
  return (
    <Tr className="h-auto">
      <Td className="whitespace-normal py-2 align-top">
        <p className={cn("truncate font-medium", !c.activa && "text-(--crm-text-2)")}>
          {c.nombre}
          {esMia && <span className="ml-1.5 font-normal text-(--crm-text-2)">(la tuya)</span>}
        </p>
        <div className={cn(TYPE.meta, "flex flex-col gap-1 text-(--crm-text-2) @[45rem]:hidden")}>
          <p className="@[30rem]:hidden">
            {!c.activa && <span className="mr-3">Suspendido</span>}
            <span className="tabular-nums">{usuarios}</span>
          </p>
          <div className="text-(--crm-text)">{admins}</div>
        </div>
      </Td>
      <Td hideBelow="md" className="whitespace-normal py-2 align-top">
        {admins}
      </Td>
      <Td align="right" hideBelow="sm" className="py-2 align-top">
        <span className={TYPE.mono}>{c.usuarios}</span>
      </Td>
      <Td hideBelow="sm" className="py-2 align-top">
        <StatusDot tone={c.activa ? "success" : "neutral"}>{c.activa ? "Activo" : "Suspendido"}</StatusDot>
      </Td>
      <Td className="overflow-visible px-1 py-1 align-top">
        <CellActions menu={<Menu label={`Acciones de ${c.nombre}`} size="sm" items={menu} />} />
      </Td>
    </Tr>
  );
}

function ClienteForm({
  open,
  onClose,
  cliente,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Sin cliente: alta de cliente + su admin. Con cliente: otro admin para ese cliente. */
  cliente?: Cliente;
  onDone: (linkManual?: string) => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [adminNombre, setAdminNombre] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  async function guardar(e: React.FormEvent) {
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
    showToast(res.linkManual ? "Listo. Compartí el link de activación." : `Invitación enviada a ${adminEmail.trim()}.`, "success");
    onDone(res.linkManual);
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={cliente ? "Agregar administrador" : "Nuevo cliente"}
      description={cliente ? cliente.nombre : "Se crea con su administrador"}
      saving={saving}
      error={error}
      submitLabel={cliente ? "Agregar administrador" : "Crear cliente"}
      onSubmit={(e) =>
        void sinTrabarse(
          () => guardar(e),
          (m) => {
            setSaving(false);
            setError(m);
          },
        )
      }
    >
      {!cliente && (
        <CampoTexto id="cli-nombre" label="Nombre del cliente" required placeholder="Distribuidora Deportiva del Oeste" value={nombre} onChange={setNombre} />
      )}
      <FormSection title="Administrador del cliente">
        <CampoTexto id="cli-admin-nombre" label="Nombre y apellido" required value={adminNombre} onChange={setAdminNombre} />
        <CampoTexto
          id="cli-admin-email"
          label="Email"
          type="email"
          inputMode="email"
          required
          placeholder="admin@cliente.com"
          value={adminEmail}
          onChange={setAdminEmail}
        />
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          Recibe un mail para elegir su contraseña. Entra con el rol <strong className="font-semibold text-(--crm-text)">Administrador</strong>:
          puede invitar a su equipo, asignar roles y crear roles nuevos.
        </p>
      </FormSection>
      {!cliente && (
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          El cliente arranca con los roles Administrador, Vendedor, Responsable comercial y Solo lectura, y con las etapas del
          embudo por defecto. Sus datos quedan aislados del resto.
        </p>
      )}
    </FormDrawer>
  );
}
