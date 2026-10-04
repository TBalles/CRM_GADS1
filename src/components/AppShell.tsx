"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Boxes,
  Building2,
  Contact,
  Funnel,
  Gauge,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  UsersRound,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { rutasVisibles, type Ruta } from "@/lib/navegacion";
import { cn } from "@/lib/utils";
import { GoalMark } from "./Logo";
import { MarcasCancha } from "./Cancha";
import { Avatar, AvatarFallback, Button, initials } from "./ui/UIComponents";
import { useModalAnimation } from "./ui/overlay";
import ConfirmModal from "./ConfirmModal";
import PaletaBusqueda from "./PaletaBusqueda";
import ThemeToggle from "./ThemeToggle";

/**
 * Cada seccion aparece solo si el rol tiene los permisos para verla (la lista y sus permisos
 * viven en `src/lib/navegacion.ts`, la misma que usa la busqueda global). Es solo comodidad: la
 * autorizacion real la hacen la base (RLS) y cada pagina y Server Action en el servidor. Ocultar
 * un link no protege nada.
 */
const ICONOS: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/empresas": Building2,
  "/contactos": Contact,
  "/oportunidades": Handshake,
  "/productos": Boxes,
  "/ventas": Receipt,
  "/alertas": BellRing,
  "/tablero-comercial": Gauge,
  "/embudo": Funnel,
  "/usuarios": UsersRound,
  "/configuracion": Settings,
};

/**
 * The shell is dressed as the pitch (`.cesped`, same surface as the login
 * panel), in BOTH themes. The kit's focus ring is brand green with a
 * background-coloured offset, which vanishes on green; on the pitch the ring
 * is the bright line green with a pitch-coloured offset.
 */
const focoCancha =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-line focus-visible:ring-offset-2 focus-visible:ring-offset-pitch";
const togglePitch = cn("text-white/75 hover:bg-white/[0.07] hover:text-white", focoCancha);

/** "Tuco & Nito" with the "&" in line green, as on the landing. */
function Wordmark() {
  const [antes, despues] = APP_NAME.split("&");
  if (despues === undefined) return <>{APP_NAME}</>;
  return (
    <>
      {antes}
      <span className="text-pitch-line">&amp;</span>
      {despues}
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The active item used to be a solid brand-filled block. A saturated
        // slab in the sidebar is the loudest element on screen competing with
        // the content it is supposed to introduce, and it is the single most
        // recognisable tell of a generated dashboard. Now: a faint brand wash,
        // the icon in brand colour, and a 3px bar at the edge. Three quiet
        // signals instead of one shout -- and the state was never colour-only
        // anyway, aria-current carries it. On the pitch the wash is white and
        // the bar is a chalk line in line green.
        "group relative flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
        focoCancha,
        active
          ? "bg-white/[0.1] font-semibold text-white"
          : "font-medium text-white/75 hover:bg-white/[0.07] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-pitch-line",
            collapsed ? "left-1" : "left-0",
          )}
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-pitch-line" : "text-white/60 group-hover:text-white",
        )}
      />
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </Link>
  );
}

/** Brand lockup: isotype tile + wordmark. */
function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      title="Ir a la página de inicio"
      className={cn("flex min-w-0 items-center gap-2.5 rounded-lg", focoCancha)}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/20">
        <GoalMark className="h-[19px] w-[19px]" />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-display text-base tracking-tight">
            <Wordmark />
          </span>
          <span className="block truncate text-[10px] uppercase tracking-wider text-white/65">
            Equipamiento deportivo
          </span>
        </span>
      )}
    </Link>
  );
}

export default function AppShell({
  nombre,
  organizacion,
  rol,
  permisos,
  children,
}: {
  nombre: string;
  organizacion: string | null;
  rol: string | null;
  permisos: string[];
  children: React.ReactNode;
}) {
  const nav = rutasVisibles(permisos);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busqueda, setBusqueda] = useState(false);
  // ⌘ en Mac, Ctrl en el resto. useSyncExternalStore evita el desfase de hidratacion (el servidor no sabe la plataforma).
  const esMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const idGrupoEquipo = useId();
  const signoutRef = useRef<HTMLFormElement>(null);
  const drawer = useModalAnimation(mobileOpen);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = nav.find((n) => isActive(n.href));

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Ctrl/Cmd+K abre (o cierra) la busqueda global desde cualquier pantalla.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Mantener apretado el atajo no abre y cierra en bucle.
        if (e.repeat) return;
        // Con un panel o un modal abierto (formulario, confirmacion, cierre de oportunidad) el atajo no se mete encima.
        const otroModal = [...document.querySelectorAll('[aria-modal="true"]')].some((el) => !el.hasAttribute("data-paleta"));
        if (otroModal) return;
        setBusqueda((v) => !v);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const navList = (onNavigate?: () => void, isCollapsed?: boolean) => {
    // El menu se dibuja dos veces (escritorio y cajon movil): cada uno con su id.
    const idEquipo = `${idGrupoEquipo}-${onNavigate ? "movil" : "escritorio"}`;
    const item = (r: Ruta) => (
      <NavItem
        key={r.href}
        href={r.href}
        label={r.label}
        icon={ICONOS[r.href]}
        active={isActive(r.href)}
        collapsed={isCollapsed}
        onNavigate={onNavigate}
      />
    );
    const generales = nav.filter((r) => !r.grupo);
    const equipo = nav.filter((r) => r.grupo === "Equipo");
    // Las rutas del equipo van agrupadas, entre las generales y la administracion (usuarios y configuracion).
    const antes = generales.filter((r) => r.href !== "/usuarios" && r.href !== "/configuracion");
    const despues = generales.filter((r) => r.href === "/usuarios" || r.href === "/configuracion");
    return (
      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {antes.map(item)}
        {equipo.length > 0 && (
          <div
            role="group"
            aria-labelledby={isCollapsed ? undefined : idEquipo}
            aria-label={isCollapsed ? "Equipo" : undefined}
            className="flex flex-col gap-1"
          >
            {isCollapsed ? (
              <div aria-hidden="true" className="mx-2 my-1 border-t border-white/15" />
            ) : (
              <p id={idEquipo} className="px-3 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/65">
                Equipo
              </p>
            )}
            {equipo.map(item)}
          </div>
        )}
        {despues.length > 0 && equipo.length > 0 && <div aria-hidden="true" className="mx-2 my-1 border-t border-white/10" />}
        {despues.map(item)}
      </nav>
    );
  };

  /** El boton de la busqueda global. `data-paleta-disparador` deja al dialogo devolverle el foco al cerrar. */
  const botonBusqueda = (isCollapsed?: boolean) => (
    <button
      type="button"
      data-paleta-disparador=""
      onClick={() => setBusqueda(true)}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="Buscar"
      title={isCollapsed ? `Buscar (${esMac ? "⌘" : "Ctrl"} K)` : undefined}
      className={cn(
        "flex w-full items-center rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white",
        focoCancha,
        isCollapsed && "justify-center px-0",
      )}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
        <>
          <span className="ml-3 flex-1 text-left">Buscar…</span>
          <kbd className="rounded border border-white/20 px-1.5 font-mono text-[10px] text-white/65">{esMac ? "⌘ K" : "Ctrl K"}</kbd>
        </>
      )}
    </button>
  );

  const userBlock = (isCollapsed?: boolean) => (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-2",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-white/10 text-white ring-1 ring-white/15">{initials(nombre)}</AvatarFallback>
      </Avatar>
      {!isCollapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-semibold text-white">{nombre}</span>
          <span className="block truncate text-[10px] uppercase tracking-wider text-white/65">
            {[rol, organizacion].filter(Boolean).join(" · ") || "Sesión activa"}
          </span>
        </span>
      )}
    </div>
  );

  /** Collapse / expand the rail. Always rendered at the top of the sidebar. */
  const collapseButton = () => {
    const label = collapsed ? "Expandir menú" : "Colapsar menú";
    const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
    return (
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        title={label}
        aria-label={label}
        aria-expanded={!collapsed}
        className={cn(
          "rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white",
          focoCancha,
          collapsed && "flex w-full justify-center",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  };

  const logoutButton = (isCollapsed?: boolean) => (
    <Button
      variant="ghost"
      onClick={() => setConfirmLogout(true)}
      title={isCollapsed ? "Cerrar sesión" : undefined}
      aria-label="Cerrar sesión"
      className={cn(
        // --destructive is ~3.4:1 on the pitch: a lighter red keeps AA.
        "w-full justify-start px-3 text-red-300 hover:bg-red-400/15 hover:text-red-200",
        focoCancha,
        isCollapsed && "justify-center px-0",
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span className="ml-3">Cerrar sesión</span>}
    </Button>
  );

  return (
    <div data-app-shell className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      {/* The sidebar is the pitch: same surface as the login panel, with the
          full markings under the nav at 5% white. In both themes — it is the
          brand's permanent frame, and the content area keeps the user's theme. */}
      <aside
        data-app-chrome
        className={cn(
          "cesped relative z-20 hidden h-full shrink-0 flex-col overflow-hidden border-r border-black/20 transition-all duration-300 ease-in-out md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <MarcasCancha className="text-white/[0.05]" />
        <div
          className={cn(
            "relative flex h-16 shrink-0 items-center border-b border-white/10 px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Logo collapsed={collapsed} />
          {!collapsed && collapseButton()}
        </div>

        {/* Collapsed there is no room beside the logo, so the toggle gets its
            own row directly under it — it stays at the top either way, and
            outside the scroll area so it can never scroll out of reach. */}
        {collapsed && <div className="relative shrink-0 border-b border-white/10 p-2">{collapseButton()}</div>}

        <div className="relative shrink-0 px-3 pt-3">{botonBusqueda(collapsed)}</div>
        <div className="relative flex-1 overflow-y-auto p-3">{navList(undefined, collapsed)}</div>

        <div className="relative shrink-0 border-t border-white/10 p-3">
          {userBlock(collapsed)}
          <div className="mt-1 space-y-1">
            <ThemeToggle collapsed={collapsed} className={togglePitch} />
            {logoutButton(collapsed)}
          </div>
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────── */}
      <header data-app-chrome className="cesped fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-black/20 px-4 [--cesped-angulo:90deg] md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className={cn("-ml-2 rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white", focoCancha)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="truncate font-display text-xl tracking-tight">
            {current?.label ?? APP_NAME}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-paleta-disparador=""
            onClick={() => setBusqueda(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            aria-label="Buscar"
            className={cn("rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white", focoCancha)}
          >
            <Search aria-hidden="true" className="h-5 w-5" />
          </button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-white/10 text-white ring-1 ring-white/15">{initials(nombre)}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {drawer.visible && (
        <div data-app-chrome className="fixed inset-0 z-40 md:hidden">
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${drawer.overlayClass}`}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              "cesped absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col overflow-hidden border-r border-black/20 shadow-2xl",
              drawer.modalClass === "modal-exit" ? "drawer-exit-left" : "drawer-enter-left",
            )}
          >
            <MarcasCancha className="text-white/[0.05]" />
            <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className={cn("rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white", focoCancha)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto p-3">{navList(() => setMobileOpen(false))}</div>
            <div className="relative shrink-0 border-t border-white/10 p-3">
              {userBlock()}
              <div className="mt-1 space-y-1">
                <ThemeToggle className={togglePitch} />
                {logoutButton()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {/* The scroll container. `pt` clears the fixed mobile header from inside
          the scroll area — a margin would push the box past the shell, which is
          overflow-hidden. `md:pt-8` is explicit because `md:p-8` alone does not
          beat `pt-*` in Tailwind's output order. */}
      {/* `bg-background` is now the tinted canvas the whole elevation system
          rests on, so the content area no longer needs `bg-secondary/30` to
          fake a step away from white. Sidebar (card white) → canvas (tinted) →
          cards (white, lifted) is one coherent ladder. */}
      <main data-app-main className="min-w-0 flex-1 overflow-y-auto bg-background p-3 pt-[4.75rem] md:p-8 md:pt-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <PaletaBusqueda abierta={busqueda} onCerrar={() => setBusqueda(false)} permisos={permisos} />

      {/* Logout goes through a confirm before the POST that clears the session. */}
      <form ref={signoutRef} action="/auth/signout" method="post" className="hidden" />
      <ConfirmModal
        isOpen={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => signoutRef.current?.requestSubmit()}
        title="Cerrar sesión"
        description="Vas a salir del CRM. Vas a tener que ingresar tus credenciales de nuevo para volver."
        confirmText="Cerrar sesión"
        variant="danger"
        icon={<LogOut className="h-6 w-6" />}
      />
    </div>
  );
}
