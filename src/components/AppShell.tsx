"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Boxes,
  Building2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { GoalMark } from "./Logo";
import { Avatar, AvatarFallback, Button, initials } from "./ui/UIComponents";
import { useModalAnimation } from "./ui/overlay";
import ConfirmModal from "./ConfirmModal";
import ThemeToggle from "./ThemeToggle";

/**
 * Cada seccion aparece solo si el rol tiene el permiso para verla. Es solo
 * comodidad: la autorizacion real la hacen la base (RLS) y cada pagina y
 * Server Action en el servidor. Ocultar un link no protege nada.
 */
const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, permiso: "tablero.ver" },
  { href: "/empresas", label: "Empresas", icon: Building2, permiso: "clientes.ver" },
  { href: "/oportunidades", label: "Oportunidades", icon: Handshake, permiso: "oportunidades.ver" },
  { href: "/productos", label: "Productos", icon: Boxes, permiso: "productos.ver" },
  { href: "/ventas", label: "Ventas", icon: Receipt, permiso: "ventas.ver" },
  { href: "/alertas", label: "Alertas", icon: BellRing, permiso: "alertas.ver" },
  { href: "/usuarios", label: "Usuarios", icon: UsersRound, permiso: "usuarios.gestionar" },
] as const;

const NAV_ADMIN = { href: "/admin", label: "Clientes", icon: ShieldCheck };

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
        "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </Link>
  );
}

/** Brand lockup: isotype tile + wordmark. */
function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" title="Ir a la página de inicio" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
        <GoalMark className="h-[19px] w-[19px]" />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold tracking-tight">{APP_NAME}</span>
          <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
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
  esSuperadmin,
  children,
}: {
  nombre: string;
  organizacion: string | null;
  rol: string | null;
  permisos: string[];
  esSuperadmin: boolean;
  children: React.ReactNode;
}) {
  const nav = [
    ...NAV.filter((n) => permisos.includes(n.permiso)),
    ...(esSuperadmin ? [NAV_ADMIN] : []),
  ];
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const signoutRef = useRef<HTMLFormElement>(null);
  const drawer = useModalAnimation(mobileOpen);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = nav.find((n) => isActive(n.href));

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const navList = (onNavigate?: () => void, isCollapsed?: boolean) => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => (
        <NavItem
          key={item.href}
          {...item}
          active={isActive(item.href)}
          collapsed={isCollapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );

  const userBlock = (isCollapsed?: boolean) => (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-2",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-brand/10 text-brand">{initials(nombre)}</AvatarFallback>
      </Avatar>
      {!isCollapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-semibold">{nombre}</span>
          <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {[rol, organizacion].filter(Boolean).join(" · ") || (esSuperadmin ? "Superadmin" : "Sesión activa")}
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
          "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
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
        "w-full justify-start px-3 text-destructive hover:bg-destructive/10 hover:text-destructive",
        isCollapsed && "justify-center px-0",
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span className="ml-3">Cerrar sesión</span>}
    </Button>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "z-20 hidden h-full shrink-0 flex-col border-r bg-card transition-all duration-300 ease-in-out md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Logo collapsed={collapsed} />
          {!collapsed && collapseButton()}
        </div>

        {/* Collapsed there is no room beside the logo, so the toggle gets its
            own row directly under it — it stays at the top either way, and
            outside the scroll area so it can never scroll out of reach. */}
        {collapsed && <div className="shrink-0 border-b p-2">{collapseButton()}</div>}

        <div className="flex-1 overflow-y-auto p-3">{navList(undefined, collapsed)}</div>

        <div className="shrink-0 border-t p-3">
          {userBlock(collapsed)}
          <div className="mt-1 space-y-1">
            <ThemeToggle collapsed={collapsed} />
            {logoutButton(collapsed)}
          </div>
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────── */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="-ml-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="truncate text-lg font-bold tracking-tight">
            {current?.label ?? APP_NAME}
          </span>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-brand/10 text-brand">{initials(nombre)}</AvatarFallback>
        </Avatar>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {drawer.visible && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${drawer.overlayClass}`}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              "absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col border-r bg-card shadow-2xl",
              drawer.modalClass === "modal-exit" ? "drawer-exit-left" : "drawer-enter-left",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b px-3">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{navList(() => setMobileOpen(false))}</div>
            <div className="shrink-0 border-t p-3">
              {userBlock()}
              <div className="mt-1 space-y-1">
                <ThemeToggle />
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
      <main className="min-w-0 flex-1 overflow-y-auto bg-secondary/30 p-3 pt-[4.75rem] md:p-8 md:pt-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

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
