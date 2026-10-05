"use client";

import * as React from "react";
import { caretAfterMask, maskMoney } from "@/lib/money";
import { Input } from "./Field";
import { cn } from "./cx";

/**
 * Monto con la máscara es-AR (23.423.424,56) en el `Input` de CRM 2.0 (MASTER.md §10.2: nunca `type="number"`). La
 * máscara y el cálculo del cursor son los de `lib/money` (`caretAfterMask`, probado en money.check.ts): el cursor queda
 * atado a la CANTIDAD de dígitos, así se puede editar el medio de un monto sin que salte al final, y después de una coma
 * decimal sigue después de ella. Un carácter rechazado (una letra) no cambia el valor ni mueve el cursor. El "$" va en
 * gris adentro.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** El texto con máscara (sembrarlo con `maskFromNumber()` al editar). */
  value: string;
  /** Recibe el texto con máscara; al guardar, `parseMoney()`. */
  onChange: (value: string) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const cursor = React.useRef<number | null>(null);

  // El cursor se repone después de que React escribió el valor nuevo en el DOM.
  React.useLayoutEffect(() => {
    const c = cursor.current;
    cursor.current = null;
    if (c == null) return;
    if (ref.current && document.activeElement === ref.current) ref.current.setSelectionRange(c, c);
  }, [value]);

  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--crm-text-2)">
        $
      </span>
      <Input
        {...props}
        ref={ref}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const el = e.target;
          const crudo = el.value;
          const enmascarado = maskMoney(crudo);
          const caret = el.selectionStart ?? crudo.length;
          if (enmascarado === value) {
            // Nada cambió (carácter rechazado): React repone el valor controlado y el cursor saltaría al final; el
            // efecto de abajo no corre porque `value` no cambió, así que se repone acá, después de ese reseteo, donde
            // estaba antes de tipear.
            const antes = Math.max(0, Math.min(value.length, caret - (crudo.length - value.length)));
            requestAnimationFrame(() => {
              if (document.activeElement === el) el.setSelectionRange(antes, antes);
            });
            return;
          }
          cursor.current = caretAfterMask(crudo, caret, enmascarado);
          onChange(enmascarado);
        }}
        className={cn("pl-7 font-(family-name:--crm-font-mono) tabular-nums", className)}
      />
    </div>
  );
}
