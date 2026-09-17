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

  const label = dark ? "Modo claro" : "Modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      {dark === null ? (
        <span className="block h-4 w-4 shrink-0" />
      ) : dark ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </button>
  );
}
