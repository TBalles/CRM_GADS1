"use client";

import * as React from "react";
import { Input, cn } from "./UIComponents";
import { maskMoney, offsetAfterDigits } from "@/lib/money";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Masked string — seed it with maskFromNumber() when editing. */
  value: string;
  /** Receives the masked string; run it through parseMoney() on submit. */
  onChange: (value: string) => void;
}

/**
 * Money field with an es-AR mask (23.423.424,56). Never `type="number"`
 * (DESIGN.md §3.10 / golden rule #4).
 *
 * The mask reformats on every keystroke, and a controlled input whose value is
 * rewritten puts the caret back at the end — which made editing the middle of
 * an existing amount impossible. So the caret is anchored to a DIGIT COUNT
 * rather than a character offset: count the digits before the caret, re-mask,
 * then put the caret after that same digit. Separators the mask inserts or
 * removes shift around it without dragging the caret along.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  className,
  ...props
}: MoneyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const caretRef = React.useRef<number | null>(null);

  // Restore the caret after React has written the new value to the DOM.
  React.useLayoutEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (caret == null) return;
    const el = inputRef.current;
    // Don't steal the caret if focus moved on while the value was updating.
    if (el && document.activeElement === el) el.setSelectionRange(caret, caret);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
    const masked = maskMoney(raw);
    caretRef.current = offsetAfterDigits(masked, digitsBefore);
    onChange(masked);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn("pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
