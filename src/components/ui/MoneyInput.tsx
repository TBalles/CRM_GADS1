"use client";

import * as React from "react";
import { Input, cn } from "./UIComponents";
import { maskMoney } from "@/lib/money";

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
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(maskMoney(e.target.value))}
        placeholder={placeholder}
        className={cn("pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  ),
);
MoneyInput.displayName = "MoneyInput";
