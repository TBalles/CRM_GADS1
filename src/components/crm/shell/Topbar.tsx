"use client";

import * as React from "react";
import { LogOut, Menu as MenuIcon, Moon, Search, Sun } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { IconButton, buttonClass } from "../Button";
import { Menu } from "../Menu";
import { Avatar } from "../Status";
import { Tooltip } from "../Tooltip";
import { FOCUS, TYPE, UI_ROOT, cn } from "../cx";
import { Kbd } from "./CommandPalette";
import { Breadcrumb, useMigas } from "./Crumbs";

const noop = () => () => {};

// ── Tema ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Mismo mecanismo que siempre: la clase `dark` en <html> (la pone el script anti-parpadeo del layout raíz) y
// `localStorage.theme`. Se lee con useSyncExternalStore: en el servidor y en la hidratación es `null` (desconocido),
// después el valor real; el botón y el ítem del menú se mantienen sincronizados aunque cambie desde otro lado.
const suscribirTema = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};

function useTemaOscuro(): boolean | null {
  return React.useSyncExternalStore(suscribirTema, () => document.documentElement.classList.contains("dark"), () => null);
}

function cambiarTema(oscuro: boolean) {
  document.documentElement.classList.toggle("dark", oscuro);
  try {
    localStorage.setItem("theme", oscuro ? "dark" : "light");
  } catch {
    // localStorage puede fallar en modo privado: el cambio vale para esta sesión.
  }
}

/** "Modo claro. Cambiar a modo oscuro": el estado y la acción, como el ThemeToggle de siempre (lo usa el manual). */
function ThemeButton({ className }: { className?: string }) {
  const oscuro = useTemaOscuro();
  const accion = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  const Icono = oscuro ? Moon : Sun;
  return (
    <Tooltip content={accion}>
      <button
        type="button"
        onClick={() => cambiarTema(!oscuro)}
        aria-label={oscuro === null ? accion : `${oscuro ? "Modo oscuro" : "Modo claro"}. ${accion}`}
        className={buttonClass({ variant: "ghost", className: cn("w-8 px-0", className) })}
      >
        {oscuro === null ? <span className="size-4" /> : <Icono aria-hidden="true" strokeWidth={1.75} />}
      </button>
    </Tooltip>
  );
}

function UserMenu({
  nombre,
  rol,
  organizacion,
  onSalir,
}: {
  nombre: string;
  rol: string | null;
  organizacion: string | null;
  onSalir: () => void;
}) {
  const oscuro = useTemaOscuro();
  const rolOrg = [rol, organizacion].filter(Boolean).join(" · ") || "Sesión activa";
  return (
    <Menu
      label="Menú de usuario"
      triggerLabel={`Menú de usuario (${nombre})`}
      variant="ghost"
      triggerClassName="px-1 lg:pr-2"
      triggerDescription={rolOrg}
      header={
        <>
          <p className="truncate font-medium text-(--crm-text)">{nombre}</p>
          <p className={cn(TYPE.meta, "truncate text-(--crm-text-2)")}>{rolOrg}</p>
        </>
      }
      items={[
        {
          label: oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
          icon: oscuro ? Sun : Moon,
          onSelect: () => cambiarTema(!oscuro),
        },
        { label: "Cerrar sesión", icon: LogOut, variant: "danger", onSelect: onSalir },
      ]}
    >
      <Avatar name={nombre} size="sm" />
      <span className="hidden max-w-40 truncate text-[13px] font-medium text-(--crm-text) lg:inline">{nombre}</span>
    </Menu>
  );
}

/**
 * Barra superior (MASTER.md §10.11): 48 px, `--crm-panel`, hairline inferior.
 * Escritorio: migas (o el nombre de la pantalla) a la izquierda · a la derecha, juntas, las herramientas globales:
 * búsqueda (Ctrl/Cmd+K, con forma de campo), tema y menú de usuario.
 * Mobile (< 768): hamburguesa, nombre de la sección, búsqueda y menú de usuario (que trae tema y cerrar sesión).
 * Los disparadores de la búsqueda llevan `data-paleta-disparador`: la paleta les devuelve el foco al cerrar.
 */
export function Topbar({
  nombre,
  rol,
  organizacion,
  onMenu,
  onBuscar,
  onSalir,
  className,
}: {
  nombre: string;
  rol: string | null;
  organizacion: string | null;
  onMenu: () => void;
  /** Sin `onBuscar` (panel de plataforma) no hay búsqueda global. */
  onBuscar?: () => void;
  onSalir: () => void;
  className?: string;
}) {
  // ⌘ en Mac, Ctrl en el resto. useSyncExternalStore evita el desfase de hidratación (el servidor no sabe la plataforma).
  const esMac = React.useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  const seccion = useMigas()[0]?.label ?? APP_NAME;
  const disparador = {
    "data-paleta-disparador": "",
    onClick: onBuscar,
    "aria-haspopup": "dialog" as const,
    "aria-keyshortcuts": "Control+K Meta+K",
  };

  return (
    <header
      data-app-chrome
      className={cn(UI_ROOT, "flex h-12 min-w-0 items-center gap-2 border-b border-(--crm-border) bg-(--crm-panel) px-2 md:gap-4 md:px-4", className)}
    >
      <IconButton label="Abrir menú" icon={MenuIcon} onClick={onMenu} className="md:hidden" />
      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold md:hidden">{seccion}</p>

      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumb />
      </div>

      {onBuscar && (
        <button
          type="button"
          {...disparador}
          aria-label="Buscar"
          className={cn(
            FOCUS,
            "hidden h-8 w-56 shrink-0 cursor-pointer items-center gap-2 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) pl-3 pr-1.5 text-(--crm-text-2) transition-colors duration-(--crm-dur-fast) ease-(--crm-ease) hover:border-(--crm-border-strong) hover:text-(--crm-text) md:flex lg:w-72",
          )}
        >
          <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          <span className="flex-1 text-left text-[13px]">Buscar…</span>
          <Kbd>{esMac ? "⌘ K" : "Ctrl K"}</Kbd>
        </button>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {onBuscar && <IconButton label="Buscar" icon={Search} {...disparador} className="md:hidden" />}
        <ThemeButton className="hidden md:inline-flex" />
        <span aria-hidden="true" className="mx-1 hidden h-5 border-l border-(--crm-border) md:block" />
        <UserMenu nombre={nombre} rol={rol} organizacion={organizacion} onSalir={onSalir} />
      </div>
    </header>
  );
}
