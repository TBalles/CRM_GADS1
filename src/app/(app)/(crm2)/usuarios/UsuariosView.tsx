"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Lock, MailPlus, Pencil, Plus, Power, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellNumber } from "@/components/crm/DataTable";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { Input } from "@/components/crm/Field";
import { ListFooter, useFocoFilas } from "@/components/crm/Lista";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar, SectionBar } from "@/components/crm/PageBar";
import { Select } from "@/components/crm/Select";
import { Avatar, StatusDot, Tag, type Tone } from "@/components/crm/Status";
import { TabPanel, Tabs } from "@/components/crm/Tabs";
import { useCrmToast } from "@/components/crm/Toast";
import { ANCHO_FILTROS, FiltroOpciones, MasFiltros, SearchField, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { CampoOpciones, CampoTexto, FormDrawer, useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { PERMISOS } from "@/lib/permisos";
import { urlConParams } from "@/lib/paginacion";
import { borrarRol, cambiarActivo, cambiarRol, invitarUsuario, reenviarInvitacion } from "./actions";
import RolForm, { type RolFila } from "./RolForm";
import { TEXTO_ESTADO, estadoUsuario, gruposDePermisos, type EstadoUsuario } from "./logica";
import { sinTrabarse } from "@/lib/guardar";

type UsuarioFila = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol_id: string | null;
  activo: boolean;
  activado_at: string | null;
};

type Panel = { tipo: "invitar" } | { tipo: "rol-usuario"; usuario: UsuarioFila } | { tipo: "rol"; rol?: RolFila };

type Resultado = { ok: true; linkManual?: string } | { ok: false; error: string };

const TONO_ESTADO: Record<EstadoUsuario, Tone> = { activo: "success", pendiente: "warning", baja: "neutral" };
const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "activo", label: "Activos" },
  { value: "pendiente", label: "Invitación pendiente" },
  { value: "baja", label: "De baja" },
];
const GRUPOS = gruposDePermisos();
const TABS_ID = "usuarios";

const nombreDe = (u: UsuarioFila) => u.nombre ?? u.email ?? "";

/**
 * Usuarios y roles del cliente (CRM 2.0, MASTER.md §10.18): PageBar, tabs por URL (`?tab=usuarios|roles`, como antes),
 * y en cada una su superficie: la lista de usuarios (toolbar con búsqueda, rol y estado por URL, DataTable, banda de
 * pie) o los roles (tabla de roles con sus acciones y la matriz de permisos por rol). Mismos permisos, acciones,
 * validaciones, avisos y nombres accesibles que la pantalla anterior.
 */
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
  /** Solo la página actual: el servidor busca, filtra y pagina. */
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
  const filtros = useFiltrosUrl();
  const router = useRouter();
  // Cambiar de tab es navegar (con historial, como antes): el panel queda `busy` hasta que llega el otro.
  const [cambiandoTab, startTab] = React.useTransition();
  const tabla = React.useRef<HTMLDivElement>(null);
  const buscador = React.useRef<HTMLDivElement>(null);
  const foco = useFocoFilas(usuarios, { tabla, buscador });
  const editor = useApertura<Panel>();
  const { showToast } = useCrmToast();
  const [ocupado, setOcupado] = React.useState(false);
  const [linkManual, setLinkManual] = React.useState<string | null>(null);
  const [dandoDeBaja, setDandoDeBaja] = React.useState<UsuarioFila | null>(null);
  const [borrandoRol, setBorrandoRol] = React.useState<RolFila | null>(null);

  const rolPorId = React.useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const opcionesRol = React.useMemo(() => [{ value: "", label: "Todos los roles" }, ...roles.map((r) => ({ value: r.id, label: r.nombre }))], [roles]);
  const rolValor = opcionesRol.some((o) => o.value === filtros.valor("rol")) ? filtros.valor("rol") : "";
  const estadoValor = ESTADOS.some((e) => e.value === filtros.valor("estado")) ? filtros.valor("estado") : "";

  function refrescar() {
    foco.trasCambio();
    filtros.refrescar();
  }

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
    refrescar();
  }

  /** El `⋮` de un usuario (el propio no tiene: nadie se cambia el rol ni se da de baja a sí mismo). */
  function menuDe(u: UsuarioFila): MenuItem[] | null {
    if (u.id === yoId) return null;
    const items: MenuItem[] = [{ label: "Cambiar rol", icon: KeyRound, onSelect: () => editor.abrir({ tipo: "rol-usuario", usuario: u }) }];
    if (u.activo && !u.activado_at) {
      items.push({
        label: "Reenviar invitación",
        icon: MailPlus,
        onSelect: () => void ejecutar(() => reenviarInvitacion({ id: u.id }), `Invitación reenviada a ${u.email}.`),
      });
    }
    items.push(
      u.activo
        ? { label: "Dar de baja", icon: Power, variant: "danger", onSelect: () => setDandoDeBaja(u) }
        : { label: "Reactivar", icon: Power, onSelect: () => void ejecutar(() => cambiarActivo({ id: u.id, activo: true }), "Usuario reactivado.") },
    );
    return foco.conFoco(items, u.id);
  }

  function abrirNuevo(p: Panel) {
    foco.olvidar();
    editor.abrir(p);
  }

  const alGuardar = (link?: string) => {
    if (link) setLinkManual(link);
    editor.cerrar();
    refrescar();
  };

  const primaria =
    tab === "usuarios" ? (
      <Button variant="primary" icon={UserPlus} onClick={() => abrirNuevo({ tipo: "invitar" })} aria-label="Invitar usuario" className="max-sm:w-8 max-sm:px-0">
        <span className="max-sm:sr-only">Invitar usuario</span>
      </Button>
    ) : (
      <Button variant="primary" icon={Plus} onClick={() => abrirNuevo({ tipo: "rol" })} aria-label="Nuevo rol" className="max-sm:w-8 max-sm:px-0">
        <span className="max-sm:sr-only">Nuevo rol</span>
      </Button>
    );

  const hrefTab = (v: string) => urlConParams(filtros.pathname, filtros.params, { tab: v === "usuarios" ? null : v, page: null });
  const columnas = 5;
  const panel = editor.valor;

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar
        title="Usuarios"
        count={hayFiltro && tab === "usuarios" ? `${total} de ${totalUsuarios} usuarios` : `${totalUsuarios} usuarios con acceso`}
        actions={primaria}
      />
      <Tabs
        id={TABS_ID}
        label="Secciones"
        value={tab}
        navigate={(href) => startTab(() => router.push(href, { scroll: false }))}
        items={[
          { value: "usuarios", label: "Usuarios", href: hrefTab("usuarios") },
          { value: "roles", label: "Roles", href: hrefTab("roles") },
        ]}
        className="shrink-0"
      />
      {/* Lo que antes decía el overlay de "Guardando…", para lectores de pantalla. */}
      <p role="status" className="sr-only">
        {ocupado ? "Guardando…" : ""}
      </p>

      {linkManual && <LinkManual link={linkManual} onClose={() => setLinkManual(null)} />}

      <TabPanel tabsId={TABS_ID} value={tab} busy={cambiandoTab} className="flex min-h-0 flex-1 flex-col">
        {tab === "usuarios" ? (
          <>
            <Toolbar>
              <div ref={buscador} className="contents">
                <SearchField filtros={filtros} label="Buscar usuario" placeholder="Buscar por nombre, email o rol…" className="sm:w-48 @[52rem]:w-72" />
              </div>
              <div className={ANCHO_FILTROS.chips}>
                <Menu
                  label="Filtrar por rol"
                  chip={{ label: "Rol", value: rolValor ? rolPorId.get(rolValor)?.nombre : undefined }}
                  items={opcionesRol.map((o) => ({ label: o.label, checked: o.value === rolValor, onSelect: () => filtros.aplicar({ rol: o.value || null }) }))}
                  align="start"
                />
                <Menu
                  label="Filtrar por estado"
                  chip={{ label: "Estado", value: ESTADOS.find((e) => e.value && e.value === estadoValor)?.label }}
                  items={ESTADOS.map((e) => ({ label: e.label, checked: e.value === estadoValor, onSelect: () => filtros.aplicar({ estado: e.value || null }) }))}
                  align="start"
                />
              </div>
              <div className={ANCHO_FILTROS.mas}>
                <MasFiltros activos={[rolValor, estadoValor].filter(Boolean).length}>
                  <FiltroOpciones label="Rol" value={rolValor} options={opcionesRol} onChange={(v) => filtros.aplicar({ rol: v || null })} />
                  <FiltroOpciones label="Estado" value={estadoValor} options={ESTADOS} onChange={(v) => filtros.aplicar({ estado: v || null })} />
                </MasFiltros>
              </div>
              {hayFiltro && (
                <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()}>
                  Limpiar filtros
                </Button>
              )}
            </Toolbar>
            <AnuncioResultados total={total} />
            <div ref={tabla} className="flex min-h-0 flex-col pb-3">
              <DataTable label="Usuarios" busy={filtros.pending || ocupado} className="min-h-0">
                <THead>
                  <Th>Usuario</Th>
                  <Th hideBelow="lg">Email</Th>
                  <Th width={200} hideBelow="sm">
                    Rol
                  </Th>
                  <Th width={184} hideBelow="md">
                    Estado
                  </Th>
                  <Th width={48}>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </THead>
                <TBody>
                  {total === 0 ? (
                    <TableMessage colSpan={columnas}>
                      <EmptyState
                        compact
                        title={q ? `Nadie del equipo con «${q}»` : "Nadie del equipo con esos filtros"}
                        description="Probá por mail o por rol, o aflojá los filtros."
                        action={
                          hayFiltro ? (
                            <Button size="sm" onClick={() => filtros.limpiar()}>
                              Limpiar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableMessage>
                  ) : (
                    usuarios.map((u) => (
                      <FilaUsuario key={u.id} usuario={u} rol={u.rol_id ? rolPorId.get(u.rol_id) : undefined} esYo={u.id === yoId} menu={menuDe(u)} />
                    ))
                  )}
                </TBody>
              </DataTable>
            </div>
            <ListFooter filtros={filtros} total={total} page={page} pageSize={pageSize} />
          </>
        ) : (
          <Roles
            roles={roles}
            usosPorRol={usosPorRol}
            onEditar={(r) => editor.abrir({ tipo: "rol", rol: r })}
            onBorrar={(r) => setBorrandoRol(r)}
          />
        )}
      </TabPanel>

      {panel?.tipo === "invitar" && <InvitarForm key={editor.n} open={editor.abierto} onClose={editor.cerrar} roles={roles} onDone={alGuardar} />}
      {panel?.tipo === "rol-usuario" && (
        <CambiarRolForm key={editor.n} open={editor.abierto} onClose={editor.cerrar} usuario={panel.usuario} roles={roles} onDone={() => alGuardar()} />
      )}
      {panel?.tipo === "rol" && (
        <RolForm
          key={editor.n}
          open={editor.abierto}
          onClose={editor.cerrar}
          rol={panel.rol}
          esMiRol={Boolean(panel.rol && panel.rol.id === miRolId)}
          onSaved={() => alGuardar()}
        />
      )}

      <ConfirmDialog
        open={Boolean(dandoDeBaja)}
        onClose={() => setDandoDeBaja(null)}
        onConfirm={async () => {
          if (dandoDeBaja) await ejecutar(() => cambiarActivo({ id: dandoDeBaja.id, activo: false }), "Usuario dado de baja.");
        }}
        title="Dar de baja al usuario"
        description={
          dandoDeBaja
            ? `${nombreDe(dandoDeBaja)} pierde el acceso al instante, aunque tenga la sesión abierta. Sus registros (ventas, bitácora) se conservan. Lo podés reactivar cuando quieras.`
            : ""
        }
        confirmText="Dar de baja"
        variant="danger"
      />
      <ConfirmDialog
        open={Boolean(borrandoRol)}
        onClose={() => setBorrandoRol(null)}
        onConfirm={async () => {
          if (borrandoRol) await ejecutar(() => borrarRol({ id: borrandoRol.id }), "Rol borrado.");
        }}
        title="Borrar rol"
        description={borrandoRol ? `Se borra el rol "${borrandoRol.nombre}". Solo se puede si nadie lo tiene asignado.` : ""}
        confirmText="Borrar"
        variant="danger"
      />
    </div>
  );
}

/** El rol de un usuario: el escudo marca al Administrador (además del nombre). Sin rol, "Sin rol". */
function RolCelda({ rol }: { rol: RolFila | undefined }) {
  if (!rol) return <span className="text-(--crm-text-2)">Sin rol</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {rol.es_admin && <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-(--crm-text-2)" />}
      <span className="truncate">{rol.nombre}</span>
    </span>
  );
}

/**
 * Un usuario (MASTER.md §10.18). Lo que el contenedor esconde pasa a la línea de apoyo bajo el nombre: < 60rem el mail;
 * < 45rem también el estado (solo si no es "Activo": repetirlo en cada fila es ruido); < 30rem también el rol. Un usuario
 * de baja lleva el nombre en `--crm-text-2` además del punto + "De baja" (la opacidad bajaba el contraste).
 */
function FilaUsuario({ usuario: u, rol, esYo, menu }: { usuario: UsuarioFila; rol: RolFila | undefined; esYo: boolean; menu: MenuItem[] | null }) {
  const estado = estadoUsuario(u);
  const nombre = nombreDe(u);
  return (
    <Tr data-id={u.id}>
      <Td className="py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={nombre || "?"} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <Tooltip content={nombre} onlyWhenTruncated>
                <span className={cn("block min-w-0 truncate font-medium", estado === "baja" && "text-(--crm-text-2)")}>{nombre}</span>
              </Tooltip>
              {esYo && <span className="shrink-0 text-(--crm-text-2)">(vos)</span>}
            </div>
            {/* Puede ocupar dos renglones en el celular: el mail no se recorta. */}
            <div className={cn(TYPE.meta, "whitespace-normal break-words text-(--crm-text-2) @[60rem]:hidden [&>span]:mr-3")}>
              {estado !== "activo" && (
                <span className="@[45rem]:hidden">
                  <StatusDot tone={TONO_ESTADO[estado]} className="align-[-1px]">
                    {TEXTO_ESTADO[estado]}
                  </StatusDot>
                </span>
              )}
              <span className="@[30rem]:hidden">{rol?.nombre ?? "Sin rol"}</span>
              {u.email && <span>{u.email}</span>}
            </div>
          </div>
        </div>
      </Td>
      <Td hideBelow="lg">
        <Tooltip content={u.email ?? ""} onlyWhenTruncated>
          <span className="block truncate text-(--crm-text-2)">{u.email}</span>
        </Tooltip>
      </Td>
      <Td hideBelow="sm">
        <RolCelda rol={rol} />
      </Td>
      <Td hideBelow="md">
        <StatusDot tone={TONO_ESTADO[estado]}>{TEXTO_ESTADO[estado]}</StatusDot>
      </Td>
      <Td className="overflow-visible px-1">
        {menu && (
          <div className="flex justify-end">
            <Menu label={`Acciones de ${nombre}`} size="sm" items={menu} />
          </div>
        )}
      </Td>
    </Tr>
  );
}

/**
 * La tab Roles: la tabla de roles (nombre, descripción completa, cuántos usuarios, sus acciones; el Administrador es fijo)
 * y la matriz de permisos por rol (un permiso por fila, agrupados como en el formulario —un `<tbody>` por grupo—; un rol por
 * columna; "Sí" con tilde o "—"). La matriz es su propio scroller (la cabecera queda fija al bajar) y no se estira más que
 * 240 + 128 por rol. En el celular (< 30rem de contenedor) muestra UN rol por vez, elegido arriba ("Ver el rol"): es la
 * misma matriz, columna por columna, sin scroll de costado.
 */
function Roles({
  roles,
  usosPorRol,
  onEditar,
  onBorrar,
}: {
  roles: RolFila[];
  usosPorRol: Record<string, number>;
  onEditar: (r: RolFila) => void;
  onBorrar: (r: RolFila) => void;
}) {
  const [rolVisto, setRolVisto] = React.useState(roles[0]?.id ?? "");
  // En el celular se ve una sola columna de rol: la elegida. Desde 30rem, todas.
  const columna = (id: string) => (id === rolVisto ? "" : "hidden @[30rem]:table-cell");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-3">
      <section className="flex shrink-0 flex-col">
        <SectionBar title="Roles" count={roles.length} />
        <DataTable label="Roles">
          <THead>
            <Th>Rol</Th>
            <Th hideBelow="md">Descripción</Th>
            <Th width={96} align="right">
              Usuarios
            </Th>
            <Th width={80}>
              <span className="sr-only">Acciones</span>
            </Th>
          </THead>
          <TBody>
            {roles.map((r) => {
              const usos = usosPorRol[r.id] ?? 0;
              return (
                <Tr key={r.id} data-id={r.id}>
                  <Td className="whitespace-normal py-1.5">
                    <RolCelda rol={r} />
                    {/* Con poco ancho la descripción va debajo del nombre, entera (en el celular no hay tooltip). */}
                    {r.descripcion && <div className={cn(TYPE.meta, "text-(--crm-text-2) @[45rem]:hidden")}>{r.descripcion}</div>}
                  </Td>
                  <Td hideBelow="md" className="whitespace-normal py-1.5 text-(--crm-text-2)">
                    {r.descripcion ?? "—"}
                  </Td>
                  <Td align="right">
                    <CellNumber>{usos}</CellNumber>
                    <span className="sr-only">{usos === 1 ? " usuario" : " usuarios"}</span>
                  </Td>
                  <Td className="overflow-visible px-1">
                    <div className="flex justify-end">
                      {r.es_admin ? (
                        <Tooltip content="El rol Administrador no se puede modificar">
                          <span className="inline-flex">
                            <Tag>
                              <Lock aria-hidden="true" strokeWidth={1.75} className="mr-1 inline size-3 align-[-1px]" />
                              Fijo
                            </Tag>
                            <span className="sr-only">: el rol Administrador no se puede modificar</span>
                          </span>
                        </Tooltip>
                      ) : (
                        <Menu
                          label={`Acciones del rol ${r.nombre}`}
                          size="sm"
                          items={[
                            { label: "Editar", icon: Pencil, onSelect: () => onEditar(r) },
                            { label: "Borrar", icon: Trash2, variant: "danger", onSelect: () => onBorrar(r) },
                          ]}
                        />
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </DataTable>
      </section>

      <section className="@container flex min-h-60 flex-1 flex-col">
        <SectionBar
          title="Permisos por rol"
          count={PERMISOS.length}
          actions={
            <div className="@[30rem]:hidden">
              <Select
                dense
                aria-label="Ver el rol"
                className="w-44"
                value={rolVisto}
                onChange={setRolVisto}
                options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
              />
            </div>
          }
        />
        {/* Ancho tope: 240 + 128 por rol (en pantallas anchas las columnas no se estiran a 260 px). */}
        <div className="flex min-h-0 flex-col" style={{ maxWidth: 242 + roles.length * 128 }}>
          <DataTable label="Permisos por rol" className="min-h-0">
            <THead>
              {/* La columna del permiso queda fija si la matriz scrollea de costado (entre 30 y 45rem con muchos roles). */}
              <Th className="sticky left-0 z-(--crm-z-sticky) @[30rem]:w-60">Permiso</Th>
              {roles.map((r) => (
                <Th key={r.id} width={128} align="center" className={cn("whitespace-normal", columna(r.id))}>
                  {/* Hasta dos renglones ("Responsable comercial" no entra en 128); un nombre más largo, con tooltip. */}
                  <Tooltip content={r.nombre} onlyWhenTruncated>
                    <span className="line-clamp-2 break-words">{r.nombre}</span>
                  </Tooltip>
                </Th>
              ))}
            </THead>
            {GRUPOS.map(([grupo, permisos]) => (
              <tbody key={grupo} className="[&:last-child>tr:last-child>*]:border-b-0">
                <tr>
                  <th scope="rowgroup" className={cn(TYPE.th, "sticky left-0 h-7 border-b border-(--crm-border) bg-(--crm-panel-2) px-3 text-left")}>
                    {grupo}
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} aria-hidden="true" className={cn("border-b border-(--crm-border) bg-(--crm-panel-2)", columna(r.id))} />
                  ))}
                </tr>
                {permisos.map((p) => (
                  <Tr key={p.clave}>
                    <th
                      scope="row"
                      className="sticky left-0 border-b border-(--crm-border) bg-(--crm-panel) px-3 py-1 text-left align-middle font-normal group-hover/row:bg-[image:linear-gradient(var(--crm-hover),var(--crm-hover))]"
                    >
                      {p.etiqueta}
                    </th>
                    {roles.map((r) => (
                      <Td key={r.id} align="center" className={columna(r.id)}>
                        {r.permisos.includes(p.clave) ? (
                          <>
                            <Check aria-hidden="true" strokeWidth={2} className="inline size-4 text-(--crm-text)" />
                            <span className="sr-only">Sí</span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true" className="text-(--crm-text-2)">
                              —
                            </span>
                            <span className="sr-only">No</span>
                          </>
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            ))}
          </DataTable>
        </div>
      </section>
    </div>
  );
}

/** Link de activación para compartir a mano cuando no hay SMTP configurado (mismo texto y acciones de siempre). */
function LinkManual({ link, onClose }: { link: string; onClose: () => void }) {
  const { showToast } = useCrmToast();
  return (
    <InlineBanner
      tone="info"
      title="El envío de mails no está configurado"
      className="my-2"
      action={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Compartile este link a la persona por otro medio. Es personal y vence en poco tiempo.</p>
      <div className="mt-2 flex gap-2">
        <Input readOnly dense aria-label="Link de activación" value={link} className={cn(TYPE.mono, "sm:text-[12px]")} onFocus={(e) => e.target.select()} />
        <Button
          size="sm"
          icon={Copy}
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => showToast("Link copiado.", "success"),
              () => showToast("No se pudo copiar: seleccionalo a mano.", "error"),
            );
          }}
        >
          Copiar
        </Button>
      </div>
    </InlineBanner>
  );
}

function InvitarForm({
  open,
  onClose,
  roles,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  roles: RolFila[];
  onDone: (linkManual?: string) => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [rolId, setRolId] = React.useState(() => roles.find((r) => r.nombre === "Vendedor")?.id ?? roles[0]?.id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  async function guardar(e: React.FormEvent) {
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
    <FormDrawer open={open} onClose={onClose} title="Invitar usuario" saving={saving} error={error} submitLabel="Enviar invitación" onSubmit={(e) => void sinTrabarse(() => guardar(e), (m) => {
        setSaving(false);
        setError(m);
      })}>
      <CampoTexto id="inv-nombre" label="Nombre y apellido" required value={nombre} onChange={setNombre} />
      <CampoTexto id="inv-email" label="Email" type="email" inputMode="email" required placeholder="persona@empresa.com" value={email} onChange={setEmail} />
      <CampoOpciones id="inv-rol" label="Rol" required options={roles.map((r) => ({ value: r.id, label: r.nombre }))} value={rolId} onChange={setRolId} />
      <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
        Le llega un mail para elegir su contraseña y activar la cuenta. Hasta que lo haga, figura como &quot;invitación pendiente&quot;.
      </p>
    </FormDrawer>
  );
}

function CambiarRolForm({
  open,
  onClose,
  usuario,
  roles,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  usuario: UsuarioFila;
  roles: RolFila[];
  onDone: () => void;
}) {
  const [rolId, setRolId] = React.useState(usuario.rol_id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  async function guardar(e: React.FormEvent) {
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
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Cambiar rol"
      description={usuario.nombre ?? usuario.email ?? undefined}
      saving={saving}
      error={error}
      onSubmit={(e) => void sinTrabarse(() => guardar(e), (m) => {
        setSaving(false);
        setError(m);
      })}
    >
      <CampoOpciones id="cambiar-rol" label="Rol" required options={roles.map((r) => ({ value: r.id, label: r.nombre }))} value={rolId} onChange={setRolId} />
      {elegido && (
        <div className="flex flex-col gap-2">
          {elegido.descripcion && <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>{elegido.descripcion}</p>}
          <ul aria-label={`Permisos de ${elegido.nombre}`} className="flex flex-wrap gap-1.5">
            {PERMISOS.filter((p) => elegido.permisos.includes(p.clave)).map((p) => (
              <li key={p.clave}>
                <Tag>{p.etiqueta}</Tag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormDrawer>
  );
}
