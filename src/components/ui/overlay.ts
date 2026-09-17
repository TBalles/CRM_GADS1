"use client";

import * as React from "react";

/**
 * Overlay behaviour for modals, drawers and popovers.
 *
 * These are hooks, so this module is client-only. They live apart from
 * UIComponents.tsx on purpose: marking that file "use client" to host them
 * turned every pure primitive in it into a client component, which made
 * passing an icon component from a Server Component (e.g. <SectionTitle
 * icon={Layers}> in the dashboard) cross the RSC boundary and throw, since a
 * lucide icon is a forwardRef object, not a plain one.
 */

const MODAL_DURATION = 200;

/**
 * Keeps a modal mounted for the length of its exit animation. Pair the
 * returned classes with the keyframes in globals.css.
 */
export function useModalAnimation(isOpen: boolean) {
  const [closing, setClosing] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(isOpen);

  // Adjust state during render rather than in an effect (the pattern React
  // documents for reacting to a prop change): going from open to closed starts
  // the exit animation. `visible` is derived, not stored, so the two can never
  // disagree.
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    setClosing(prevOpen && !isOpen);
  }

  React.useEffect(() => {
    if (!closing) return;
    // setState from a callback, so it doesn't cascade renders.
    const t = setTimeout(() => setClosing(false), MODAL_DURATION);
    return () => clearTimeout(t);
  }, [closing]);

  return {
    visible: isOpen || closing,
    overlayClass: closing ? "overlay-exit" : "overlay-enter",
    modalClass: closing ? "modal-exit" : "modal-enter",
  };
}

export type AnchorCoords = { top: number; left: number; width: number };

/**
 * Positions a portaled panel under a trigger, flipping above it when there is
 * no room below, and closes on outside mousedown / scroll / Escape.
 *
 * DESIGN.md §8.4 prescribes extracting exactly this instead of re-implementing
 * popover positioning in every dropdown.
 */
export function useAnchoredPortal(panelHeight: number) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<AnchorCoords>({ top: 0, left: 0, width: 0 });

  const measure = React.useCallback((): AnchorCoords => {
    const el = triggerRef.current;
    if (!el) return { top: 0, left: 0, width: 0 };
    const r = el.getBoundingClientRect();
    const flip = r.bottom + panelHeight > window.innerHeight && r.top - panelHeight > 0;
    return {
      top: flip ? r.top - panelHeight - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
    };
  }, [panelHeight]);

  const openPanel = React.useCallback(() => {
    setCoords(measure());
    setOpen(true);
  }, [measure]);

  React.useEffect(() => {
    if (!open) return;
    const reposition = () => setCoords(measure());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, measure]);

  return { open, setOpen, openPanel, triggerRef, panelRef, coords };
}

/** Shared shell for every portaled popover panel. */
export const popoverPanelClass =
  "bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100";
