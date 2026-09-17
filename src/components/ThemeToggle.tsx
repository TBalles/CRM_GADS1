"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeToggle({
  collapsed,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  // `null` until mounted: the real theme lives in the <html> class that the
  // inline init script set before hydration, and `document` isn't readable
  // during SSR. One piece of state, so "unknown" and "light" can't be confused.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage can throw in private mode; the toggle still works for
      // this session, it just won't be remembered.
    }
  }

  // The visible label names the theme you are IN; the tooltip names what the
  // button DOES. Showing "Modo oscuro" while in light mode read as if that were
  // the current state. The icon follows the label, so both describe the same
  // thing. aria-label carries both and contains the visible text, so the
  // accessible name still matches what is on screen (WCAG 2.5.3).
  const state = dark ? "Modo oscuro" : "Modo claro";
  const action = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      title={action}
      aria-label={dark === null ? action : `${state}. ${action}`}
      aria-pressed={dark ?? false}
      className={cn(
        "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      {/* Until mounted the real theme is unknown (it lives in the <html> class
          the anti-flash script set), so render a placeholder instead of
          guessing and flipping on the first commit. */}
      {dark === null ? (
        <span className="block h-4 w-4 shrink-0" />
      ) : dark ? (
        <Moon className="h-4 w-4 shrink-0" />
      ) : (
        <Sun className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && (
        <span className="ml-3 truncate">{dark === null ? "Tema" : state}</span>
      )}
    </button>
  );
}
