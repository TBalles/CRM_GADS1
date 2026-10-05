"use client";

import * as React from "react";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { backdropClose } from "@/components/ui/backdropClose";
import { CrmPortal } from "../portal";
import { useLayer, useModalFocus, usePresence, useScrollLock } from "../overlay";
import { IconButton } from "../Button";
import { ConfirmDialog } from "../Dialog";
import { CrmToastProvider } from "../Toast";
import { UI_ROOT, cn } from "../cx";
import { CommandPalette } from "./CommandPalette";
import { CrumbsProvider } from "./Crumbs";
import { RailNav } from "./Rail";
import { Topbar } from "./Topbar";
import { cookieRail } from "./logica";

/** Cajón de mobile (< 768): el rail como capa modal desde la izquierda. Foco atrapado; Escape, el fondo, elegir un link
 *  o cualquier cambio de ruta (atrás del navegador, gesto de Android) lo cierran; el foco vuelve a la hamburguesa (o a
 *  donde estaba, si sigue en la página). Mismos hooks de capa que Drawer y Dialog. */
function Cajon({
  abierto,
  onCerrar,
  permisos,
  organizacion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  permisos: string[];
  organizacion: string | null;
}) {
  const { montada, cerrando } = usePresence(abierto, 200); // = --crm-dur-slow
  const panel = React.useRef<HTMLDivElement>(null);
  useLayer(abierto, onCerrar);
  useModalFocus(panel, abierto);
  useScrollLock(abierto);
  // Si la ventana pasa a 768 px o más con el cajón abierto, se cierra: oculto por CSS dejaría el foco atrapado en nada.
  React.useEffect(() => {
    if (!abierto) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const alCambiar = () => mq.matches && onCerrar();
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, [abierto, onCerrar]);
  if (!montada) return null;
  return (
    <CrmPortal>
      <div
        data-app-chrome
        className={cn(
          UI_ROOT,
          "fixed inset-0 z-(--crm-z-drawer) bg-(--crm-scrim) md:hidden",
          cerrando ? "animate-[crm-fade_var(--crm-dur-slow)_var(--crm-ease)_reverse_forwards]" : "animate-[crm-fade_var(--crm-dur-slow)_var(--crm-ease)]",
          "motion-reduce:animate-none",
        )}
        {...backdropClose(onCerrar)}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          tabIndex={-1}
          className={cn(
            "relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-(--crm-border) bg-(--crm-panel) shadow-(--crm-shadow-float) outline-none",
            cerrando
              ? "animate-[crm-slide-in-left_var(--crm-dur-slow)_var(--crm-ease)_reverse_forwards]"
              : "animate-[crm-slide-in-left_var(--crm-dur-slow)_var(--crm-ease)]",
            "motion-reduce:animate-none",
          )}
        >
          {/* Primero en el orden de Tab (y foco inicial); se ve arriba a la derecha, en la franja de la marca. */}
          <IconButton label="Cerrar menú" icon={X} onClick={onCerrar} className="absolute right-2 top-2" />
          <RailNav permisos={permisos} modo="cajon" onNavigate={onCerrar} organizacion={organizacion} />
        </div>
      </div>
    </CrmPortal>
  );
}

/**
 * Shell de CRM 2.0 (Etapa 2; MASTER.md §10.11): rail + topbar + área de trabajo, para TODO el CRM. El contenido legacy
 * se dibuja adentro como siempre (`(legacy)/layout.tsx` le da su ancho y padding de antes); las pantallas migradas
 * (`(crm2)`) usan el área completa.
 *
 * Contratos que se preservan:
 * - Impresión y capturas: `data-app-shell` en la raíz, `data-app-chrome` en todo lo que no va al papel (rail, topbar,
 *   cajón, paleta, avisos), `data-app-main` en el `<main>` que scrollea. `[data-app-shell]` y `[data-app-main]` son la grilla y el
 *   `<main>` mismos (sin envoltorios en el medio), así que las reglas `@media print` de globals.css (`display: block`,
 *   alto y overflow libres, padding 0) les llegan igual que antes. `[data-app-main] > div` alcanza al primer div del
 *   contenido: en `(legacy)` es el wrapper de su layout (ver ese archivo).
 * - `nav` "Secciones" con los links por nombre; Ctrl/Cmd+K con el contrato de siempre; cerrar sesión con confirmación
 *   y POST a `/auth/signout`.
 * - La fuente Plex va SOLO en el chrome (rail, topbar, capas): el contenido legacy sigue con la fuente global.
 */
export default function AppFrame({
  nombre,
  organizacion,
  rol,
  permisos,
  railColapsado,
  children,
}: {
  nombre: string;
  organizacion: string | null;
  rol: string | null;
  permisos: string[];
  /** Preferencia guardada (cookie leída en el servidor): el primer pintado ya sale bien. */
  railColapsado: boolean;
  children: React.ReactNode;
}) {
  const [colapsado, setColapsado] = React.useState(railColapsado);
  const [cajon, setCajon] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState(false);
  const [salir, setSalir] = React.useState(false);
  const signoutRef = React.useRef<HTMLFormElement>(null);
  const cerrarCajon = React.useCallback(() => setCajon(false), []);
  const asideId = React.useId();
  // Cualquier cambio de ruta cierra el cajón (además del onNavigate de los links): atrás del navegador, gesto de
  // Android, un link del contenido. Ajuste de estado durante el render ante un cambio de prop (patrón de React).
  const pathname = usePathname();
  const [rutaVista, setRutaVista] = React.useState(pathname);
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setCajon(false);
  }

  const alternarRail = () => {
    const nuevo = !colapsado;
    setColapsado(nuevo);
    document.cookie = cookieRail(nuevo);
  };

  // Ctrl/Cmd+K abre (o cierra) la búsqueda global desde cualquier pantalla.
  React.useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Mantener apretado el atajo no abre y cierra en bucle.
        if (e.repeat) return;
        // Con un panel o un modal abierto (formulario, confirmación, cierre de oportunidad, cajón) el atajo no se mete encima.
        const otroModal = [...document.querySelectorAll('[aria-modal="true"]')].some((el) => !el.hasAttribute("data-paleta"));
        if (otroModal) return;
        setBusqueda((v) => !v);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  return (
    <CrumbsProvider>
      <CrmToastProvider>
        {/* El documento NUNCA scrollea: solo `<main>`. Un `position: absolute` sin ancestro posicionado (el `sr-only` de
            Tailwind, por ejemplo) toma como bloque contenedor el viewport, no lo recorta ni lo scrollea el `<main>`, y
            estira el DOCUMENTO; como `html` tiene `overflow-x: hidden` (globals.css), su `overflow-y` computa `auto` y la
            rueda (al llegar al final del `<main>` o sobre el rail) mueve la página entera con el shell adentro. Por eso:
            `relative` en el shell y en el `<main>` (todo absoluto queda contenido) y `overflow-clip` en el shell (a
            diferencia de `hidden`, no es un contenedor de scroll: ni un foco ni un scrollIntoView pueden correrlo). */}
        <div
          data-app-shell
          className="relative grid h-dvh grid-cols-[auto_minmax(0,1fr)] grid-rows-[48px_minmax(0,1fr)] overflow-clip bg-background text-foreground"
        >
          {/* Primer enfocable de la página. `fixed`: no ocupa celda de la grilla; aparece solo con el foco. Peso 400 a
              propósito: está en todo ancho (fuera de pantalla, pero maquetado), así el único archivo de Plex que se precarga
              (Sans 400) se usa siempre; en mobile ningún otro texto del chrome va en 400. */}
          <a
            href="#contenido"
            data-app-chrome
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("contenido")?.focus();
            }}
            className={cn(
              UI_ROOT,
              "fixed left-2 top-2 z-(--crm-z-tooltip) -translate-y-16 rounded-(--crm-radius-sm) bg-(--crm-accent) px-3 py-2 font-normal text-(--crm-on-accent) outline-none focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--crm-focus) motion-safe:transition-transform",
            )}
          >
            Saltar al contenido
          </a>

          <aside
            id={asideId}
            data-app-chrome
            className={cn(
              UI_ROOT,
              "col-start-1 row-span-2 row-start-1 hidden w-[52px] flex-col overflow-hidden border-r border-(--crm-border) bg-(--crm-panel) md:flex",
              "transition-[width] duration-(--crm-dur) ease-(--crm-ease) motion-reduce:transition-none",
              !colapsado && "xl:w-[216px]",
            )}
          >
            <RailNav
              permisos={permisos}
              modo="rail"
              colapsado={colapsado}
              onToggle={alternarRail}
              controlsId={asideId}
              organizacion={organizacion}
            />
          </aside>

          <Topbar
            className="col-start-2 row-start-1"
            nombre={nombre}
            rol={rol}
            organizacion={organizacion}
            onMenu={() => setCajon(true)}
            onBuscar={() => setBusqueda(true)}
            onSalir={() => setSalir(true)}
          />

          <main id="contenido" tabIndex={-1} data-app-main className="relative col-start-2 row-start-2 min-h-0 min-w-0 overflow-y-auto outline-none">
            {children}
          </main>
        </div>

        <Cajon abierto={cajon} onCerrar={cerrarCajon} permisos={permisos} organizacion={organizacion} />
        <CommandPalette abierta={busqueda} onCerrar={() => setBusqueda(false)} permisos={permisos} />

        {/* Cerrar sesión pasa por una confirmación antes del POST que borra la sesión. */}
        <form ref={signoutRef} action="/auth/signout" method="post" hidden />
        <ConfirmDialog
          open={salir}
          onClose={() => setSalir(false)}
          onConfirm={() => signoutRef.current?.requestSubmit()}
          title="Cerrar sesión"
          description="Vas a salir del CRM. Vas a tener que ingresar tus credenciales de nuevo para volver."
          confirmText="Cerrar sesión"
          variant="danger"
        />
      </CrmToastProvider>
    </CrumbsProvider>
  );
}
