"use client";

import * as React from "react";
import { CrmPortal } from "./portal";
import { UI_ROOT, cn } from "./cx";

const ABRIR_MS = 250;
const CERRAR_MS = 100;
const PAD = 8;

/**
 * Tooltip de CRM 2.0 (MASTER.md §10.4): texto corto que nombra o completa, nunca información que no esté en otro
 * lado. Se abre con hover (250 ms) y con foco; se cierra con Escape, al salir o al hacer scroll; se puede pasar el
 * mouse por encima sin que se cierre (WCAG 1.4.13). Va a `#crm-portal`, encima de todo (`--crm-z-tooltip`).
 *
 * El hijo tiene que ser UN elemento; recibe `aria-describedby` mientras el tooltip está visible.
 * `onlyWhenTruncated`: solo aparece si el hijo está recortado (celdas con `truncate`).
 * `disabled`: no aparece (p. ej. el ítem del rail expandido, cuyo texto ya se ve). No cambia el markup.
 * `side="right"`: a la derecha y centrado en alto (rail colapsado); por defecto arriba (abajo si no entra).
 *
 * No usar `title=` en CRM 2.0: el TooltipHost legacy del layout raíz lo convierte en su propio globo.
 */
export function Tooltip({
  content,
  children,
  onlyWhenTruncated = false,
  disabled = false,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  onlyWhenTruncated?: boolean;
  disabled?: boolean;
  side?: "top" | "right";
}) {
  const id = React.useId();
  const wrap = React.useRef<HTMLSpanElement>(null);
  const tip = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const [abierto, setAbierto] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  const objetivo = () => wrap.current?.firstElementChild as HTMLElement | null;

  const programar = (abrir: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        if (abrir) {
          if (disabled) return;
          const el = objetivo();
          if (!el) return;
          if (onlyWhenTruncated && el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
        }
        setAbierto(abrir);
      },
      abrir ? ABRIR_MS : CERRAR_MS,
    );
  };

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  React.useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    // En captura y con preventDefault: este Escape cierra SOLO el tooltip (WCAG 1.4.13), no el drawer o el diálogo
    // de abajo (las capas ignoran un Escape ya atendido). El siguiente Escape ya cierra la capa.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      cerrar();
    };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierto]);

  // Arriba y centrado; abajo si no entra. Se mide antes de pintar.
  React.useLayoutEffect(() => {
    // Cerrado no se dibuja: la posición vieja no importa (se recalcula antes de pintar la próxima vez).
    if (!abierto) return;
    const el = objetivo();
    const t = tip.current;
    if (!el || !t) return;
    const r = el.getBoundingClientRect();
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    const derecha = side === "right";
    const top = derecha
      ? Math.max(PAD, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - PAD))
      : r.top - h - 6 > PAD
        ? r.top - h - 6
        : r.bottom + 6;
    const left = derecha ? r.right + 8 : Math.max(PAD, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - PAD));
    // Medir el DOM y posicionar antes de pintar: el caso para el que existe useLayoutEffect.
    setPos({ left, top });
  }, [abierto, side]);

  return (
    <>
      <span
        ref={wrap}
        className="contents"
        onPointerEnter={() => programar(true)}
        onPointerLeave={() => programar(false)}
        onFocus={() => programar(true)}
        onBlur={() => programar(false)}
      >
        {React.cloneElement(children, { "aria-describedby": abierto ? id : children.props["aria-describedby"] })}
      </span>
      {abierto && (
        <CrmPortal>
          <div
            ref={tip}
            id={id}
            role="tooltip"
            onPointerEnter={() => window.clearTimeout(timer.current)}
            onPointerLeave={() => programar(false)}
            style={{ position: "fixed", left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? undefined : "hidden" }}
            className={cn(
              UI_ROOT,
              "z-(--crm-z-tooltip) max-w-72 rounded-(--crm-radius-sm) bg-(--crm-inverse) px-2 py-1 text-[12px] leading-4 font-medium text-(--crm-on-inverse)",
              "animate-[crm-fade_var(--crm-dur-fast)_var(--crm-ease)] motion-reduce:animate-none",
            )}
          >
            {content}
          </div>
        </CrmPortal>
      )}
    </>
  );
}
