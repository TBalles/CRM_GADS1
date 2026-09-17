"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn, popoverPanelClass, useAnchoredPortal } from "./UIComponents";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional dot colour, used by the funnel-stage selects. */
  color?: string | null;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Renders a filter box above the list once there are enough options. */
  searchable?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
}

const ROW_H = 34;
const MAX_PANEL = 260;

/**
 * Replacement for a native `<select>`: portaled panel that escapes any
 * `overflow: hidden` ancestor, flips above the trigger when there's no room
 * below, and marks the active option with a check (DESIGN.md §3.9 / §8.4).
 */
export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  className,
  disabled = false,
  searchable,
  id,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
}) => {
  const showSearch = searchable ?? options.length > 8;
  const panelHeight = Math.min(options.length * ROW_H + (showSearch ? 48 : 8), MAX_PANEL);
  const { open, setOpen, openPanel, triggerRef, panelRef, coords } = useAnchoredPortal(panelHeight);
  const [query, setQuery] = React.useState("");
  const listboxId = React.useId();

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 90 }}
          className={popoverPanelClass}
        >
          {showSearch && (
            <div className="relative border-b p-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar opción"
                className="h-8 w-full rounded-sm bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Sin resultados</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    option.value === value
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {option.color && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.value === value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        // `combobox` (not a plain button) is the role that actually describes a
        // select-like control, and it's the one that supports aria-invalid.
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-labelledby={ariaLabelledBy}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          // Reset the filter on open, so each opening starts fresh without
          // needing an effect to watch `open`.
          setQuery("");
          openPanel();
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
          open && "border-primary/50 ring-2 ring-primary/20",
          ariaInvalid && "border-destructive",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.color && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
        />
      </button>
      {panel}
    </>
  );
};
