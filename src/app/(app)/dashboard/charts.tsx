import { cn } from "@/lib/utils";

/**
 * Chart forms for this dashboard, per the team's `dataviz` method (see
 * design-overrides.md §2): the job picks the form.
 *
 *  - Magnitude (comparing values)  → ordered horizontal bar, SINGLE brand hue.
 *    Never a tint per nominal category — that double-encodes bar length as
 *    colour without adding information. Stage identity rides on the label and
 *    an optional dot, never on the bar colour alone.
 *  - Part-to-whole (share of the pipeline) → 100% stacked bar, categorical
 *    colours, with a legend carrying direct percentages (identity is never
 *    colour-only, so it stays readable with colour-vision deficiency).
 *
 * Both are plain CSS, so they inherit the theme tokens and need no charting
 * dependency and no client JS.
 */

export type Row = {
  key: string;
  label: string;
  value: number;
  /** Secondary figure shown next to the value (e.g. an amount). */
  detail?: string;
  /** Categorical colour — used for the dot and for stacked segments only. */
  color?: string | null;
};

/** Ordered horizontal bars, single brand hue, direct value labels. */
export function MagnitudeBars({
  rows,
  emptyText = "Sin datos",
  className,
}: {
  rows: Row[];
  emptyText?: string;
  className?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);

  if (!rows.length || max === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {r.color && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
              )}
              <span className="truncate text-xs font-medium">{r.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {r.detail && (
                <span className="text-[11px] tabular-nums text-muted-foreground">{r.detail}</span>
              )}
              <span className="text-xs font-bold tabular-nums">{r.value}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 100% stacked share bar + legend with direct percentages. */
export function ShareBar({
  rows,
  total,
  emptyText = "Sin datos",
}: {
  rows: Row[];
  total: number;
  emptyText?: string;
}) {
  const present = rows.filter((r) => r.value > 0);

  if (!present.length || total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted">
        {present.map((r) => (
          <span
            key={r.key}
            title={`${r.label}: ${r.value} (${Math.round((r.value / total) * 100)}%)`}
            className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
            style={{
              width: `${(r.value / total) * 100}%`,
              backgroundColor: r.color ?? "hsl(var(--brand))",
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((r) => (
          <span key={r.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: r.color ?? "hsl(var(--brand))" }}
            />
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">
              {Math.round((r.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
