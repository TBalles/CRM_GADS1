import type { MouseEvent } from "react";

/**
 * Closes only when BOTH the mousedown and the click land on the overlay
 * itself, so a text selection that starts inside the panel and is released
 * over the backdrop doesn't dismiss it. A function, not a hook, so it can be
 * called inside conditional JSX without breaking the rules of hooks.
 *
 * Usage: <div className="fixed inset-0 …" {...backdropClose(onClose)}>
 */
export function backdropClose(onClose: () => void) {
  let pressedOnBackdrop = false;
  return {
    onMouseDown: (e: MouseEvent) => {
      pressedOnBackdrop = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (pressedOnBackdrop && e.target === e.currentTarget) onClose();
      pressedOnBackdrop = false;
    },
  };
}
