import { cn } from "@/lib/utils";
import { Card, CardContent } from "./UIComponents";

/**
 * The canonical metric tile (DESIGN.md §4.6 / golden rule #20). Icon + label
 * on top, big value, optional footer. `accent` paints the brand wash.
 *
 * Note: the kit's source pastes the brand hex inline; the brand colour lives
 * only in the `--brand` token here, per its own golden rule #2.
 */
export const KpiCard = ({
  icon: Icon,
  label,
  value,
  accent,
  badge,
  sub,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  badge?: string;
  sub?: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn(accent && "border-brand/20 bg-brand/[0.04]", className)}>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4 shrink-0", accent && "text-brand")} />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold tabular-nums tracking-tight", accent && "text-brand")}>
          {value}
        </span>
        {badge && (
          <span className="shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-xs font-bold text-brand-foreground">
            {badge}
          </span>
        )}
      </div>
      {sub != null && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </CardContent>
  </Card>
);
