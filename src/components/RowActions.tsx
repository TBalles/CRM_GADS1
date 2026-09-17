"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { cn, popoverPanelClass, useAnchoredPortal } from "./ui/UIComponents";

export type RowAction = {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "default" | "destructive";
};

const ROW_H = 34;
const PANEL_W = 176;

/**
 * The `⋮` row menu. Portaled so it escapes the `overflow-hidden` of the cards
 * and table wrappers it lives in (DESIGN.md §8.4).
 */
export default function RowActions({ items, label = "Más opciones" }: { items: RowAction[]; label?: string }) {
  const panelHeight = items.length * ROW_H + 8;
  const { open, setOpen, openPanel, triggerRef, panelRef, coords } = useAnchoredPortal(panelHeight);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openPanel();
        }}
        className={cn(
          "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          open && "bg-accent text-accent-foreground",
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              // Right-align the panel with the trigger: it sits at the row edge.
              top: coords.top,
              left: Math.max(8, coords.left + coords.width - PANEL_W),
              width: PANEL_W,
              zIndex: 90,
            }}
            className={popoverPanelClass}
          >
            <div className="p-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      item.onClick();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                      item.variant === "destructive"
                        ? "text-destructive hover:bg-destructive/10"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
