import * as React from "react";
import { AlertCircle, Check } from "lucide-react";
import { DISABLED, FIELD, FOCUS, TYPE, cn } from "./cx";

/**
 * Controles de formulario de CRM 2.0 (MASTER.md §10.2). Sin "use client": los nativos no necesitan hooks.
 * Mismo borde, mismo radio y el mismo anillo de foco en todos. Label arriba, ayuda y error abajo.
 */

/** Lo que `Field` le pasa al control: id, descripción (ayuda/error) e invalidez ya cableados. */
export type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

/**
 * Campo: label + control + ayuda + error. El control lo dibuja quien llama con las props que recibe, así el id
 * (`#nombre`, `#empresa_id`…, que usan E2E y el manual) y el `aria-describedby` quedan siempre bien atados.
 *
 *   <Field id="nombre" label="Nombre" required error={errores.nombre}>
 *     {(p) => <Input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
 *   </Field>
 *
 * Para un Select (un botón con `role=combobox`) el segundo argumento es el id del label: `aria-labelledby={labelId}`.
 */
export function Field({
  id,
  label,
  help,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: ControlProps, labelId: string) => React.ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id} id={`${id}-label`} required={required}>
        {label}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required }, `${id}-label`)}
      {help && !error && (
        <p id={helpId} className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          {help}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function Label({
  required,
  className,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("text-[13px] font-medium leading-[18px] text-(--crm-text)", className)} {...props}>
      {children}
      {/* El asterisco es visual: la obligatoriedad la anuncia el `required` del control. */}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-(--crm-danger)">
          *
        </span>
      )}
    </label>
  );
}

/** Error de un campo. `role="alert"` como hoy (form.tsx): se anuncia al aparecer. */
export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className={cn(TYPE.meta, "flex items-start gap-1 text-(--crm-danger)")}>
      <AlertCircle aria-hidden="true" strokeWidth={1.75} className="mt-px size-3.5 shrink-0" />
      {error}
    </p>
  );
}

type InputProps = React.ComponentProps<"input"> & { dense?: boolean };

/** Input de 32 px (28 con `dense`, para toolbars). Para montos, el MoneyInput de siempre (nunca `type="number"`). */
export function Input({ dense, className, type = "text", ...props }: InputProps) {
  return <input type={type} className={cn(FIELD, dense ? "h-7" : "h-8", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(FIELD, "resize-y py-1.5 leading-5", className)} {...props} />;
}

type CheckProps = Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode;
  /** Texto de apoyo debajo del label. */
  description?: React.ReactNode;
};

/** Checkbox nativo (teclado, formularios y lectores de pantalla gratis) con la caja dibujada por CSS. */
export function Checkbox({ label, description, className, id, ...props }: CheckProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-start gap-2 has-disabled:cursor-not-allowed", className)}>
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          className={cn(
            "peer size-4 cursor-pointer appearance-none rounded-(--crm-radius-sm) border border-(--crm-border-strong) bg-(--crm-panel)",
            "checked:border-(--crm-accent) checked:bg-(--crm-accent) aria-invalid:border-(--crm-danger)",
            FOCUS,
            DISABLED,
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none invisible absolute inset-0.5 size-3 text-(--crm-on-accent) peer-checked:visible"
        />
      </span>
      <ChoiceText label={label} description={description} />
    </label>
  );
}

/** Radio nativo. Agruparlos en `<RadioGroup>` (fieldset + legend): las flechas ya funcionan entre radios del mismo `name`. */
export function Radio({ label, description, className, id, ...props }: CheckProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-start gap-2 has-disabled:cursor-not-allowed", className)}>
      <input
        id={id}
        type="radio"
        className={cn(
          "mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-(--crm-border-strong) bg-(--crm-panel)",
          "checked:border-[5px] checked:border-(--crm-accent)",
          FOCUS,
          DISABLED,
        )}
        {...props}
      />
      <ChoiceText label={label} description={description} />
    </label>
  );
}

export function RadioGroup({ legend, children, className }: { legend: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend className="mb-1 text-[13px] font-medium leading-[18px]">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Interruptor: checkbox nativo con `role="switch"` (Espacio lo cambia; el lector anuncia "activado/desactivado"). */
export function Switch({ label, description, className, id, ...props }: CheckProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-start gap-2 has-disabled:cursor-not-allowed", className)}>
      <span className="relative mt-0.5 inline-flex h-4 w-7 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className={cn(
            "peer h-4 w-7 cursor-pointer appearance-none rounded-full border border-(--crm-border-strong) bg-(--crm-panel-2)",
            "transition-colors duration-(--crm-dur-fast) checked:border-(--crm-accent) checked:bg-(--crm-accent)",
            FOCUS,
            DISABLED,
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 size-3 rounded-full bg-(--crm-text-2) transition-transform duration-(--crm-dur-fast) ease-(--crm-ease) peer-checked:translate-x-3 peer-checked:bg-(--crm-on-accent) motion-reduce:transition-none"
        />
      </span>
      <ChoiceText label={label} description={description} />
    </label>
  );
}

function ChoiceText({ label, description }: { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[14px] leading-5">{label}</span>
      {description && <span className={cn(TYPE.meta, "text-(--crm-text-2)")}>{description}</span>}
    </span>
  );
}
