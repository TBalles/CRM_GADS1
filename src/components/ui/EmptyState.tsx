import { cn } from "@/lib/utils";

/**
 * Canonical empty state: dashed border + icon in a circle (DESIGN.md §9.3).
 * `compact` is the inside-a-card / inside-a-table variant.
 */
export const EmptyState = ({
  icon: Icon,
  text,
  hint,
  action,
  compact,
  className,
}: {
  icon: React.ElementType;
  text: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) => {
  if (compact) {
    return (
      <div className={cn("flex flex-col items-center py-12 text-center", className)}>
        <Icon className="mb-3 h-10 w-10 stroke-1 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{text}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/5 p-12",
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="text-center text-sm font-medium text-muted-foreground">{text}</p>
      {hint && <p className="mt-1 text-center text-xs text-muted-foreground/70">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
