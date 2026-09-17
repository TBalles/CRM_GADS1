"use client";

import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button, FieldLabel, Input, Textarea } from "./ui/UIComponents";
import { Select, type SelectOption } from "./ui/Select";
import { MoneyInput } from "./ui/MoneyInput";

/**
 * Field wrappers over the kit primitives (DESIGN.md §6.1 / §6.2). Every form
 * in the app composes these instead of restyling inputs per screen.
 *
 * All fields are controlled — the uncontrolled `defaultValue` path the old
 * version carried had no callers.
 */

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {error}
    </p>
  );
}

type BaseProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
};

export function Campo({
  id,
  label,
  required,
  error,
  className,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus,
  inputMode,
}: BaseProps & {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

export function CampoTextarea({
  id,
  label,
  required,
  error,
  className,
  value,
  onChange,
  placeholder,
  maxLength = 1000,
  rows = 3,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <Textarea
        id={id}
        name={id}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

export function CampoSelect({
  id,
  label,
  required,
  error,
  className,
  value,
  onChange,
  options,
  placeholder,
  searchable,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
}) {
  return (
    <div className={className}>
      <FieldLabel id={`${id}-label`} required={required}>
        {label}
      </FieldLabel>
      <Select
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchable={searchable}
        aria-invalid={Boolean(error)}
        aria-labelledby={`${id}-label`}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

/** Amounts always go through the mask — never `type="number"` (golden rule #4). */
export function CampoMoney({
  id,
  label,
  required,
  error,
  className,
  value,
  onChange,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <MoneyInput
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

/** Form-level error banner (DESIGN.md §6.2). */
export function FormBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-r-md border-l-4 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-2"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

/**
 * Action bar pinned to the bottom of a Drawer form (DESIGN.md §5.7). The
 * negative offsets cancel the Drawer body's `p-5` so it sits flush against the
 * panel edges; `flex-col-reverse` stacks the buttons full-width on mobile with
 * the submit on top (§5.5).
 */
export function FormActions({
  saving,
  onCancel,
  submitLabel = "Guardar",
}: {
  saving: boolean;
  onCancel: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="sticky -bottom-5 -mx-5 -mb-5 mt-6 flex flex-col-reverse gap-2 border-t bg-background/95 p-4 backdrop-blur-sm sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
        className="w-full sm:w-auto"
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={saving} className="w-full gap-2 sm:w-auto sm:min-w-[140px]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Guardando…" : submitLabel}
      </Button>
    </div>
  );
}

/** Grouping box for a set of related fields (DESIGN.md §6.1). */
export function CampoGrupo({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-brand" />}
        {title}
      </h3>
      {children}
    </div>
  );
}
