/**
 * Sumar UI Kit primitives (DESIGN.md §3).
 *
 * NO "use client" here on purpose: these are pure presentational components,
 * so they stay shared and render on either side of the RSC boundary. Marking
 * this module client-only made every primitive a client component, and then
 * passing an icon component from a Server Component -- <SectionTitle
 * icon={Layers}> in the dashboard -- crossed the boundary and threw, because a
 * lucide icon is a forwardRef object rather than a plain one.
 *
 * Overlay hooks live in ./overlay.ts, which is the client-only module.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export { cn };

/* ============================================================================
   Card
   ========================================================================== */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

/* ============================================================================
   Button
   ========================================================================== */

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `primary` aliases the brand colour, so the default button IS the green one.
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

/**
 * The button's classes, without the <button> element.
 *
 * For a link that has to LOOK like a button — a nav CTA, an `<a href>` — use
 * this on the anchor instead of wrapping it in a <Button>. A <button> around
 * an <a> is invalid HTML (interactive inside interactive) and screen readers
 * announce the pair inconsistently. Same clothes, right element.
 */
export function buttonClass({
  variant = "default",
  size = "default",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button ref={ref} className={buttonClass({ variant, size, className })} {...props} />
  ),
);
Button.displayName = "Button";

/* ============================================================================
   Input / Textarea
   ========================================================================== */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground resize-none aria-invalid:border-destructive",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Canonical field label (DESIGN.md §6.1). */
export const FieldLabel = ({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) => (
  <label className={cn("text-xs font-medium text-muted-foreground mb-1 block", className)} {...props}>
    {children}
    {required && <span className="text-destructive ml-0.5">*</span>}
  </label>
);

/* ============================================================================
   Badge
   ========================================================================== */

export const Badge = ({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}) => {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "text-foreground",
    success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
};

/* ============================================================================
   Pill
   ========================================================================== */

/**
 * Colored pill for categorical values (categories, roles, types, states).
 * Unlike Badge, which is one neutral grey, each value gets its own hue so a
 * column of categories can be scanned by color.
 */
const TONOS = {
  violeta: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  azul: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  cian: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300",
  verde: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  lima: "bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300",
  ambar: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  naranja: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  rosa: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  rojo: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  gris: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
} as const;

export type Tono = keyof typeof TONOS;

// Hues for free text. Red and grey stay out: they read as "error" and "off".
const TONOS_AUTO: Tono[] = ["violeta", "azul", "cian", "verde", "lima", "ambar", "naranja", "rosa", "indigo"];

/**
 * Stable hue for a free-text value: the same text always gets the same color,
 * with no per-value configuration. Case and accents are ignored so "Arcos" and
 * "arcos" match.
 * ponytail: 9 hues, so two different values can share one; if that bothers,
 * store a color per category in the DB like etapas.color.
 */
export function tonoPara(texto: string): Tono {
  const clave = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  let h = 0;
  for (const c of clave) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TONOS_AUTO[Math.abs(h) % TONOS_AUTO.length];
}

export const Pill = ({
  className,
  tono,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  /** Fixed hue. Without it, derived from the text of `children`. */
  tono?: Tono;
}) => (
  <span
    className={cn(
      "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
      TONOS[tono ?? (typeof children === "string" ? tonoPara(children) : "gris")],
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

/* ============================================================================
   Table
   ========================================================================== */

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-4 py-3 align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

/* ============================================================================
   Avatar
   ========================================================================== */

export const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

export const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase",
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = "AvatarFallback";

/** First letters of a person/company name, for an AvatarFallback. */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

/* ============================================================================
   Section title (DESIGN.md §4.6)
   ========================================================================== */

export const SectionTitle = ({
  icon: Icon,
  children,
  right,
  className,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-brand" />
      <h3 className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
    </div>
    {right}
  </div>
);
