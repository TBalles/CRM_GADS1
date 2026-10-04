"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "../Tooltip";
import { FOCUS, cn } from "../cx";
import { fichaDe, migas, type Miga } from "./logica";

/**
 * Migas de pan del shell (MASTER.md §10.11). Las migas salen de la ruta (`logica.ts`); lo único que una página aporta
 * es el NOMBRE de su ficha, con `<CrumbLabel>`:
 *
 *   // en /empresas/[id]/page.tsx (server component; CrumbLabel no dibuja nada)
 *   <CrumbLabel>{empresa.nombre}</CrumbLabel>
 *
 * Nombra la ficha de la ruta actual (`/empresas/abc`, también desde `/oportunidades/abc/presupuesto`). Sin
 * `<CrumbLabel>` la miga dice "Ficha". El nombre llega con la hidratación (el layout se dibuja antes que la página),
 * y queda recordado por href: volver a una ficha ya visitada lo muestra de entrada.
 */
type Ctx = { etiquetas: Record<string, string>; nombrar: (href: string, label: string) => void };
const CrumbsContext = React.createContext<Ctx | null>(null);

export function CrumbsProvider({ children }: { children: React.ReactNode }) {
  const [etiquetas, setEtiquetas] = React.useState<Record<string, string>>({});
  const nombrar = React.useCallback(
    (href: string, label: string) => setEtiquetas((e) => (e[href] === label ? e : { ...e, [href]: label })),
    [],
  );
  const value = React.useMemo(() => ({ etiquetas, nombrar }), [etiquetas, nombrar]);
  return <CrumbsContext.Provider value={value}>{children}</CrumbsContext.Provider>;
}

/** Le da nombre a la ficha de la ruta actual en las migas. No dibuja nada. */
export function CrumbLabel({ children }: { children: string }) {
  const ctx = React.useContext(CrumbsContext);
  const href = fichaDe(usePathname());
  const nombrar = ctx?.nombrar;
  React.useEffect(() => {
    if (nombrar && href && children.trim()) nombrar(href, children.trim());
  }, [nombrar, href, children]);
  return null;
}

/** Las migas de la ruta actual, con los nombres que aportaron las páginas. */
export function useMigas(): Miga[] {
  const pathname = usePathname();
  const etiquetas = React.useContext(CrumbsContext)?.etiquetas;
  return React.useMemo(() => migas(pathname, etiquetas), [pathname, etiquetas]);
}

/**
 * `nav` "Ruta de navegación" + `ol`; la última miga es la página actual (`aria-current`, sin link). En una pantalla de
 * primer nivel (una sola miga) no hay ruta que mostrar: va solo su nombre como título discreto (con `aria-current`), sin
 * `nav`, para no repetir el ítem activo del rail como si fuera un recorrido.
 */
export function Breadcrumb({ className }: { className?: string }) {
  const items = useMigas();
  if (items.length === 0) return null;
  if (items.length === 1)
    return (
      <p className={cn("min-w-0 truncate text-[14px] font-medium leading-5 text-(--crm-text)", className)}>
        <span aria-current="page">{items[0].label}</span>
      </p>
    );
  return (
    <nav aria-label="Ruta de navegación" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-[13px] leading-[18px]">
        {items.map((m, i) => {
          const ultima = i === items.length - 1;
          return (
            <li key={m.href} className={cn("flex min-w-0 items-center gap-1", ultima ? "shrink" : "shrink-[2]")}>
              {i > 0 && (
                <span aria-hidden="true" className="text-(--crm-text-2)">
                  ›
                </span>
              )}
              {ultima ? (
                <Tooltip content={m.label} onlyWhenTruncated>
                  <span aria-current="page" className="block max-w-[40ch] truncate font-medium text-(--crm-text)">
                    {m.label}
                  </span>
                </Tooltip>
              ) : (
                <Tooltip content={m.label} onlyWhenTruncated>
                  <Link
                    href={m.href}
                    className={cn(
                      FOCUS,
                      "block max-w-[28ch] truncate rounded-(--crm-radius-sm) text-(--crm-text-2) transition-colors duration-(--crm-dur-fast) hover:text-(--crm-text) hover:underline",
                    )}
                  >
                    {m.label}
                  </Link>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
