# Design System Master File — Tuco & Nito (CRM)

> **LOGIC:** When building a specific page, first check `design-system/tuco-y-nito/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. If not, follow the rules below.
>
> **Precedence:** `docs/DESIGN.md` (Sumar UI Kit) → `docs/design-overrides.md` → this file.
> The code is the source of truth for values: `src/app/globals.css` (tokens) and
> `src/components/ui/` (primitives). This file summarises and explains; it never contradicts them.

> **Provenance:** generated with `ui-ux-pro-max --design-system --persist` on 2026-09-28. The
> generator classified the product as "Sports Team/Club" and proposed a red palette, Bebas Neue
> and a "Vibrant & Block-based" hero layout — a fan site, not a B2B CRM. That output was
> discarded and this file rewritten to document the system actually in use. Useful ingredients
> kept from the skill: Soft UI Evolution (style), a mono face for figures, and its UX rules for
> empty states and no-result feedback.

---

**Product:** CRM for sports-equipment suppliers (goals, nets, balls, cones) selling to clubs,
5-a-side pitches, football schools and municipal grounds.
**Scope:** the CRM (`src/app/(app)`, `src/app/admin`). The public landing (`src/app/page.tsx`)
has its own marketing aesthetic (override §12) and is the **source of the brand voice**.

## Color (HSL tokens, `src/app/globals.css`)

| Role | Light | Dark | Notes |
|------|-------|------|-------|
| `--brand` (= `primary`, `ring`) | `160 78% 24%` | `160 58% 46%` | Pitch green. Never hardcode it. |
| `--background` | `158 22% 97.6%` | `168 14% 8%` | Canvas, slightly tinted |
| `--card` | `0 0% 100%` | `172 13% 14%` | Elevation = lighter than canvas |
| `--foreground` | `165 22% 11%` | `150 8% 95%` | |
| `--muted-foreground` | `162 9% 40%` | `165 8% 62%` | Secondary text. **No opacity modifiers on text** — `/70` drops below AA |
| `--border` | `156 14% 89%` | `168 10% 20%` | |
| `--destructive` | `0 72% 51%` | `0 72% 56%` | |

Measured contrast: muted text 5.08:1 (canvas) / 5.32:1 (card) light, 7.13 / 5.95 dark; text on
`primary` 6.34:1 light. Floor: 4.5:1.

## Typography

- **Plus Jakarta Sans** (`--font-sans`) — all CRM UI.
- **JetBrains Mono** (`--font-mono`) — figures only (money, counts, datelines). At display size
  use `tracking-[-0.055em]`.
- Varela Round is **landing only**.

## Style

**Soft UI Evolution**: tinted two-layer shadows, `--radius: 0.625rem`, 200ms transitions with
`cubic-bezier(0.32,0.72,0,1)`, inputs as wells with a 3px brand halo on focus.

## Structure

- Every screen opens with `PageHeader` (title · live mono dateline · bajada · toolbar).
- Dashboard: one hero figure (money in play) + a `<dl>` strip of counts, not a row of equal KPI cards.
- Forms live in the `Drawer`; tables are responsive in two blocks (`md:hidden` cards / `hidden md:block` table).

## Voice (from the landing)

Concrete, Rioplatense (voseo), from the trade. Short sentences that name real things: clubs,
nets, goals, delivery dates, *recambio*.

| Instead of | Write |
|------------|-------|
| "Sin resultados" | `Ninguna empresa con «X»` + where else to look |
| "Todavía no hay productos" | "El catálogo está vacío" + what to load and why it matters |
| "No hay recambios pendientes" | "Todo el equipamiento está al día" |
| "Venta registrada." (always) | "…Arrancó el reloj del recambio." **only if it is true** |

Never change field labels or action names for voice. Never promise automation that doesn't
exist (alerts are prepared, a person sends them).

## Brand motifs — surgical

Allowed, each with a job:
- **GoalMark** (`src/components/Logo.tsx`): sidebar, loader, and the "De la venta al recambio" section icon.
- **Chalk line** (`h-px w-6 bg-brand`) before an eyebrow — once, on the dashboard masthead.
- **Pitch scenes** in empty states (`EmptyState escena="cancha|afuera|al-dia"`, override §13).

Not allowed inside the CRM: the landing's ✦ sparkles, particles, glow, outline mega-words,
pitch patterns as backgrounds, or a scene inside every nested/compact empty state.
**If in doubt, leave it out.**

## Empty states

| Situation | Scene | Copy shape |
|-----------|-------|------------|
| First time, full screen | `cancha` | What is empty + what to load + why it matters, plus the create action |
| Search / filter miss | `afuera` | Echo the query in «», suggest the other searchable fields |
| Nothing pending (good news) | `al-dia` | Say it is fine, and when it will stop being fine |
| Nested inside another object | none (text only) | One line + a concrete hint |

## Anti-patterns

- Generic lucide icon in a grey circle as the only empty-state content
- `Sparkles` or other "AI-made" icons; `Trophy` for things that are not won
- Opacity modifiers on text (`text-muted-foreground/70`)
- A row of equal KPI cards as a screen opener
- Emoji as icons; new UI dependencies or animation libraries

## Pre-delivery checklist

- [ ] Contrast ≥ 4.5:1 in light **and** dark (measure, don't eyeball)
- [ ] Decorative SVG/icons `aria-hidden`; icon-only buttons have `aria-label`
- [ ] Visible focus on every interactive element
- [ ] `prefers-reduced-motion` respected (the CRM adds no decorative motion)
- [ ] `cursor: pointer` on buttons (Tailwind v4 dropped it; fixed in `@layer base`)
- [ ] 375 / 768 / 1024 / 1440 without horizontal scroll
- [ ] Landing untouched
