import type { MouseEvent } from "react";

/**
 * Closes only when BOTH the mousedown and the click land on the overlay
 * itself, so a text selection that starts inside the panel and is released
 * over the backdrop doesn't dismiss it. A function, not a hook, so it can be
 * called inside conditional JSX without breaking the rules of hooks.
 *
 * The "was it pressed on the backdrop" flag is parked on the overlay node
 * rather than in a closure: `{...backdropClose(onClose)}` is re-evaluated on
 * every render, so a closure-held flag is lost if anything re-renders between
 * the mousedown and the click, and the overlay stops closing.
 *
 * Usage: <div className="fixed inset-0 …" {...backdropClose(onClose)}>
 */
const FLAG = "backdropPressed";

export function backdropClose(onClose: () => void) {
  return {
    onMouseDown: (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).dataset[FLAG] = String(e.target === e.currentTarget);
    },
    onClick: (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const pressedOnBackdrop = el.dataset[FLAG] === "true";
      delete el.dataset[FLAG];
      if (pressedOnBackdrop && e.target === e.currentTarget) onClose();
    },
  };
}
