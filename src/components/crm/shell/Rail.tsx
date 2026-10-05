"use client";

import * as React from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  UsersRound,
} from "lucide-react";
import { GoalMark } from "@/components/Logo";
import { APP_NAME } from "@/lib/brand";
import { SECCIONES_PLATAFORMA, seccionesVisibles } from "@/lib/navegacion";
import { IconButton } from "../Button";
import { Tooltip } from "../Tooltip";
import { FOCUS, cn } from "../cx";

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
  "/admin": Building2,
};

const DESKTOP = "(min-width: 1280px)";
const suscribir = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * ¿Se ve solo el ícono? Con la preferencia "colapsado", o siempre entre 768 y 1279 px (ahí el rail no se expande).
 * Solo decide si los ítems muestran Tooltip: el ancho lo resuelve CSS, así el HTML del servidor es el mismo en
 * cualquier ancho y no hay diferencia de hidratación (en el servidor se asume escritorio; el tooltip no se dibuja ahí).
 */
function useSoloIconos(colapsado: boolean) {
  const desktop = React.useSyncExternalStore(suscribir, () => window.matchMedia(DESKTOP).matches, () => true);
  return colapsado || !desktop;
}

/**
 * Contenido del rail (MASTER.md §10.11): marca, `nav` "Secciones" agrupada por `lib/navegacion.ts` (mismos permisos
 * que siempre; una sección sin ítems no aparece) y, arriba junto a la marca, colapsar/expandir.
 *
 * `modo="rail"`: el `aside` de escritorio. Ancho 216 o 52 según la preferencia desde 1280 px; 52 fijo entre 768 y
 * 1279; oculto debajo de 768. Todo por CSS a partir de `colapsado` (que viene de la cookie leída en el servidor).
 * `modo="cajon"`: el mismo contenido, siempre expandido, dentro del cajón de mobile.
 *
 * Los links llevan `aria-label` con su nombre: con el texto oculto (solo ícono) el nombre accesible es el mismo
 * ("Empresas", "Configuración"…), que es el contrato de E2E y del manual.
 */
export function RailNav({
  permisos,
  modo,
  colapsado = false,
  onToggle,
  onNavigate,
  controlsId,
  organizacion,
  plataforma = false,
}: {
  permisos: string[];
  modo: "rail" | "cajon";
  colapsado?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  /** id del `aside` que el botón de colapso controla (`aria-controls`). */
  controlsId?: string;
  /** Nombre de la organización (ya lo tiene la sesión): segunda línea de la marca. */
  organizacion?: string | null;
  /** Panel del superadmin (`/admin`): el rail de una sola sección ("Plataforma"), sin las pantallas del CRM. */
  plataforma?: boolean;
}) {
  const pathname = usePathname();
  const soloIconosJs = useSoloIconos(colapsado);
  const soloIconos = modo === "rail" && soloIconosJs;
  const secciones = plataforma ? SECCIONES_PLATAFORMA : seccionesVisibles(permisos);
  const activa = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Lo que solo se ve con el rail expandido: en el cajón siempre; en el rail, desde 1280 y sin la preferencia.
  const expandido = modo === "cajon" ? "" : colapsado ? "hidden" : "hidden xl:block";

  return (
    <>
      <div className="relative shrink-0">
        <div className={cn("flex h-12 items-center border-b border-(--crm-border) px-2", modo === "rail" && onToggle && !colapsado && "xl:pr-11", modo === "cajon" && "pr-11")}>
          <Tooltip content={`${APP_NAME}: ir a la página de inicio`} side="right" disabled={!soloIconos}>
            <Link
              href="/"
              aria-label={`${APP_NAME}: ir a la página de inicio`}
              className={cn(FOCUS, "flex h-10 min-w-0 flex-1 items-center rounded-(--crm-radius-sm)")}
            >
              <span className="flex w-9 shrink-0 justify-center text-(--crm-accent)">
                <GoalMark className="size-5" />
              </span>
              <span className={cn(expandido, "min-w-0 pr-1")}>
                <span className="block truncate text-[15px] font-semibold leading-5 tracking-[-0.01em] text-(--crm-text)">{APP_NAME}</span>
                {organizacion && <span className="block truncate text-[12px] leading-4 text-(--crm-text-2)">{organizacion}</span>}
              </span>
            </Link>
          </Tooltip>
        </div>
        {modo === "rail" && onToggle && (
          // Un solo botón en la misma posición del árbol (expandido: arriba a la derecha, sobre la franja de la marca;
          // colapsado: su propia fila debajo), así no se desmonta al alternar y el foco del teclado se queda en él.
          // Entre 768 y 1279 el rail no se expande: solo existe desde 1280.
          <div className={cn("hidden xl:flex", colapsado ? "justify-center border-b border-(--crm-border) py-2" : "absolute right-2 top-2")}>
            <Tooltip content={colapsado ? "Expandir menú" : "Colapsar menú"} side="right">
              <IconButton
                label={colapsado ? "Expandir menú" : "Colapsar menú"}
                icon={colapsado ? PanelLeftOpen : PanelLeftClose}
                onClick={onToggle}
                aria-expanded={!colapsado}
                aria-controls={controlsId}
              />
            </Tooltip>
          </div>
        )}
      </div>

      <nav aria-label="Secciones" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {secciones.map((s, i) => (
          <div key={s.titulo} role="group" aria-label={s.titulo} className="flex flex-col">
            {/* Rótulo visible con el rail expandido; colapsado, un divisor (el grupo sigue nombrado por aria-label). */}
            <p aria-hidden="true" className={cn(expandido, "px-2 pb-1 pt-4 text-[12px] font-medium leading-4 text-(--crm-text-2)")}>
              {s.titulo}
            </p>
            {modo === "rail" && (
              <div
                aria-hidden="true"
                className={cn(colapsado ? "block" : "block xl:hidden", i === 0 ? "h-2" : "mx-2 my-2 border-t border-(--crm-border)")}
              />
            )}
            <ul className="flex flex-col gap-px">
              {s.rutas.map((r) => {
                const Icono = ICONOS[r.href];
                const actual = activa(r.href);
                return (
                  <li key={r.href}>
                    <Tooltip content={r.label} side="right" disabled={!soloIconos}>
                      <Link
                        href={r.href}
                        onClick={onNavigate}
                        aria-label={r.label}
                        aria-current={actual ? "page" : undefined}
                        className={cn(
                          FOCUS,
                          "flex h-8 items-center rounded-(--crm-radius-sm) text-[14px] leading-5 transition-colors duration-(--crm-dur-fast) ease-(--crm-ease)",
                          actual
                            ? "bg-(--crm-selected) font-medium text-(--crm-accent-text) shadow-[inset_2px_0_0_var(--crm-accent)]"
                            : "text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
                        )}
                      >
                        <span className="flex w-9 shrink-0 justify-center">
                          {Icono && <Icono aria-hidden="true" strokeWidth={1.75} className="size-4" />}
                        </span>
                        <span className={cn(expandido, "truncate pr-2")}>{r.label}</span>
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

    </>
  );
}
