"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export { cn };

/* ============================================================================
   Modal animation (DESIGN.md §2)
   ========================================================================== */

const MODAL_DURATION = 200;

/**
 * Keeps a modal mounted for the length of its exit animation. Pair the
 * returned classes with the keyframes in globals.css.
 */
export function useModalAnimation(isOpen: boolean) {
  const [closing, setClosing] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(isOpen);

  // Adjust state during render rather than in an effect (the pattern React
  // documents for reacting to a prop change): going from open to closed starts
  // the exit animation. `visible` is derived, not stored, so the two can never
  // disagree.
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    setClosing(prevOpen && !isOpen);
  }

  React.useEffect(() => {
    if (!closing) return;
    // setState from a callback, so it doesn't cascade renders.
    const t = setTimeout(() => setClosing(false), MODAL_DURATION);
    return () => clearTimeout(t);
  }, [closing]);

  return {
    visible: isOpen || closing,
    overlayClass: closing ? "overlay-exit" : "overlay-enter",
    modalClass: closing ? "modal-exit" : "modal-enter",
  };
}

/* ============================================================================
   Anchored portal (DESIGN.md §8.4 — the kit prescribes extracting this
   instead of re-implementing popover positioning in every dropdown)
   ========================================================================== */

export type AnchorCoords = { top: number; left: number; width: number };

/**
 * Positions a portaled panel under a trigger, flipping above it when there is
 * no room below, and closes on outside mousedown / scroll / Escape.
 */
export function useAnchoredPortal(panelHeight: number) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<AnchorCoords>({ top: 0, left: 0, width: 0 });

  const measure = React.useCallback((): AnchorCoords => {
    const el = triggerRef.current;
    if (!el) return { top: 0, left: 0, width: 0 };
    const r = el.getBoundingClientRect();
    const flip = r.bottom + panelHeight > window.innerHeight && r.top - panelHeight > 0;
    return {
      top: flip ? r.top - panelHeight - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
    };
  }, [panelHeight]);

  const openPanel = React.useCallback(() => {
    setCoords(measure());
    setOpen(true);
  }, [measure]);

  React.useEffect(() => {
    if (!open) return;
    const reposition = () => setCoords(measure());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, measure]);

  return { open, setOpen, openPanel, triggerRef, panelRef, coords };
}

/** Shared shell for every portaled popover panel. */
export const popoverPanelClass =
  "bg-popover text-popover-foreground border rounded-md shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100";

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

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "brand";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      brand: "bg-brand text-brand-foreground hover:bg-brand/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
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
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "brand";
}) => {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    brand: "border-transparent bg-brand text-brand-foreground",
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
