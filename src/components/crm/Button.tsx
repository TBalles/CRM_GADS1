import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { DISABLED, FOCUS, cn } from "./cx";

/**
 * Botones de CRM 2.0 (MASTER.md §10.1). Sin "use client" ni hooks: se pueden usar desde server components
 * (p. ej. con `type="submit"` o pasando un ícono de lucide, que no cruza la frontera RSC).
 *
 * - Un solo `primary` por pantalla. `danger` solo para la acción que destruye o da de baja.
 * - Alto 32 (`md`), 28 (`sm`, toolbars y filas), 36 (`lg`, footers de drawer en mobile).
 * - `loading`: bloquea, marca `aria-busy` y cambia el ícono por el indicador. El texto lo cambia quien llama
 *   ("Guardando…"), así el nombre accesible dice lo que pasa. Bloquea con `aria-disabled` + un guardia en el clic, NO con
 *   `disabled` (Lote F): un botón que se deshabilita con el foco adentro tira el foco al `body` (el lector de pantalla y el
 *   teclado pierden el lugar a mitad del guardado). El guardia cancela el clic, también el que el navegador dispara en el
 *   botón de envío al apretar Enter en un campo (envío implícito): un segundo Enter no manda el formulario dos veces.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTES: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-(--crm-accent) text-(--crm-on-accent) hover:bg-(--crm-accent-hover)",
  secondary:
    "border-(--crm-border) bg-(--crm-panel) text-(--crm-text) hover:border-(--crm-border-strong) hover:bg-(--crm-panel-2)",
  ghost: "border-transparent bg-transparent text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
  danger: "border-transparent bg-(--crm-danger) text-(--crm-on-danger) hover:bg-(--crm-danger-hover)",
};

const TAMANIOS: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2 text-[13px]",
  md: "h-8 gap-2 px-3 text-[14px]",
  lg: "h-9 gap-2 px-4 text-[14px]",
};

/** Las clases de un botón, para un `<Link>` que se ve como botón. */
export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-(--crm-radius-sm) border font-medium leading-none",
    "transition-colors duration-(--crm-dur-fast) ease-(--crm-ease) [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTES[variant],
    TAMANIOS[size],
    FOCUS,
    DISABLED,
    className,
  );
}

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícono de lucide a la izquierda (16 px, decorativo). */
  icon?: React.ElementType;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  type = "button",
  disabled,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        Icon && <Icon aria-hidden="true" strokeWidth={1.75} />
      )}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<React.ComponentProps<"button">, "children" | "aria-label"> & {
  /** Nombre accesible. Obligatorio: un botón de ícono sin nombre no existe para un lector de pantalla. */
  label: string;
  icon: React.ElementType;
  variant?: Exclude<ButtonVariant, "danger">;
  size?: "sm" | "md";
};

/**
 * Botón de solo ícono (cerrar, `⋮`, acciones de fila). Cuadrado de 32 (28 en `sm`). Para mostrar el nombre al
 * pasar el mouse, envolverlo en `<Tooltip content={label}>`: nunca `title=` (lo captura el TooltipHost legacy).
 */
export function IconButton({ label, icon: Icon, variant = "ghost", size = "md", type = "button", className, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={buttonClass({ variant, size, className: cn(size === "sm" ? "w-7 px-0" : "w-8 px-0", className) })}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} />
    </button>
  );
}

type FilterChipProps = Omit<React.ComponentProps<"button">, "children" | "value"> & {
  /** Nombre del filtro ("Estado"). */
  label: string;
  /** Valor aplicado ("Activo"). Sin valor, el chip muestra solo el nombre. */
  value?: string;
};

/**
 * Chip de filtro de la toolbar (MASTER.md §10.12): disparador de un `Popover`. Chip sólido de hairline, 28 de alto;
 * con valor, el valor va en el color de acento ("Estado: **Activo**"). Sin bordes punteados ni rellenos de color.
 * El nombre accesible es el texto visible ("Estado: Activo").
 */
export function FilterChip({ label, value, type = "button", className, ...props }: FilterChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel) pl-2 pr-1.5 text-[13px] whitespace-nowrap",
        "transition-colors duration-(--crm-dur-fast) ease-(--crm-ease) hover:border-(--crm-border-strong) hover:bg-(--crm-hover)",
        "aria-expanded:border-(--crm-border-strong)",
        FOCUS,
        DISABLED,
        className,
      )}
      {...props}
    >
      <span className={value ? "text-(--crm-text-2)" : "text-(--crm-text)"}>{value ? `${label}:` : label}</span>
      {value && <span className="font-medium text-(--crm-accent-text)">{value}</span>}
      <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-3.5 text-(--crm-text-2)" />
    </button>
  );
}
