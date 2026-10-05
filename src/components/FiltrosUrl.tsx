"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/UIComponents";
import { Select, type SelectOption } from "@/components/ui/Select";
import { fechaParam, urlConParams } from "@/lib/paginacion";
import { cn } from "@/lib/utils";

/**
 * Los filtros de una lista viven en la URL (`?q=&estado=&page=`), no en el estado
 * de React: se pueden compartir, sobreviven a un reload y el botón "atrás" anda.
 * La página servidor lee los `searchParams` y consulta; esto solo los escribe.
 *
 * `pending` es true mientras el servidor recalcula la lista: las pantallas lo
 * usan para `aria-busy` y para atenuar los resultados viejos.
 */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  /**
   * Cambia parámetros con `replace` (filtrar no agrega una entrada al historial).
   * Todo cambio de filtro vuelve a la página 1; el de página usa `ir` con un link.
   * Cambiar de vista o de pestaña es navegar, no filtrar: usa `{ historial: true }` y "atrás" vuelve a la anterior.
   */
  const aplicar = useCallback(
    (cambios: Record<string, string | null>, opciones: { conservarPagina?: boolean; historial?: boolean } = {}) => {
      const href = urlConParams(pathname, params, opciones.conservarPagina ? cambios : { ...cambios, page: null });
      startTransition(() => (opciones.historial ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false })));
    },
    [pathname, params, router],
  );

  /** Navega a un link ya armado (paginación): `push`, para que "atrás" vuelva a la página anterior. */
  const ir = useCallback(
    (href: string) => {
      startTransition(() => router.push(href));
    },
    [router],
  );

  /** Vuelve a pedirle los datos al servidor (después de crear, editar o dar de baja). */
  const refrescar = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  /** Borra todos los filtros salvo los que son de la pantalla y no de la búsqueda (la vista, la pestaña, el tamaño). */
  const limpiar = useCallback(
    (conservar: readonly string[] = ["vista", "tab", "pageSize"]) => {
      const cambios: Record<string, string | null> = {};
      for (const clave of new Set(params.keys())) if (!conservar.includes(clave)) cambios[clave] = null;
      aplicar(cambios);
    },
    [params, aplicar],
  );

  return {
    params,
    pathname,
    valor: (clave: string) => params.get(clave) ?? "",
    aplicar,
    ir,
    refrescar,
    limpiar,
    pending,
  };
}

export type FiltrosUrl = ReturnType<typeof useFiltrosUrl>;

/**
 * Estado del buscador de una lista, sin UI (lo comparten `CajaBusqueda` y el buscador de CRM 2.0): escribe en la URL
 * 300 ms después de la última tecla, o al instante con `enviarYa` (Enter, borrar).
 */
export function useBusquedaUrl(filtros: FiltrosUrl, param = "q") {
  const { aplicar } = filtros;
  const enUrl = filtros.valor(param);
  const [texto, setTexto] = useState(enUrl);
  const [enviado, setEnviado] = useState(enUrl);
  const [urlPrevia, setUrlPrevia] = useState(enUrl);

  // Si la URL cambió por otro camino (atrás/adelante, "Limpiar filtros") el campo la sigue.
  // Si cambió porque la acabamos de escribir nosotros, no se toca lo que la persona sigue tipeando.
  if (enUrl !== urlPrevia) {
    setUrlPrevia(enUrl);
    if (enUrl !== enviado) {
      setTexto(enUrl);
      setEnviado(enUrl);
    }
  }

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === enviado) return;
    const t = setTimeout(() => {
      setEnviado(limpio);
      aplicar({ [param]: limpio });
    }, 300);
    return () => clearTimeout(t);
  }, [texto, enviado, aplicar, param]);

  function enviarYa(valor: string) {
    const limpio = valor.trim();
    if (limpio === enviado) return;
    setEnviado(limpio);
    aplicar({ [param]: limpio });
  }

  return { texto, setTexto, enviarYa };
}

/**
 * Buscador de una lista. Escribe en la URL 300 ms después de la última tecla (o
 * al instante con Enter), así no se consulta la base por cada letra.
 */
export function CajaBusqueda({
  filtros,
  etiqueta,
  placeholder,
  param = "q",
  className,
}: {
  filtros: FiltrosUrl;
  /** Texto para lectores de pantalla (el placeholder no alcanza como etiqueta). */
  etiqueta: string;
  placeholder: string;
  param?: string;
  className?: string;
}) {
  const { pending } = filtros;
  const { texto, setTexto, enviarYa } = useBusquedaUrl(filtros, param);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none", className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        aria-label={etiqueta}
        value={texto}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            enviarYa(texto);
          }
        }}
        className="h-9 pl-8 pr-8 text-sm"
      />
      {texto ? (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          title="Borrar la búsqueda"
          onClick={() => {
            setTexto("");
            enviarYa("");
            // El botón desaparece al vaciar el campo: sin esto el foco caería al <body>.
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {pending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <X aria-hidden="true" className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Un filtro desplegable atado a un parámetro de la URL. `porDefecto` es el valor
 * que vale cuando el parámetro no está (no se escribe en la URL: la URL limpia es
 * la lista con sus valores de siempre).
 */
export function FiltroSelect({
  filtros,
  param,
  etiqueta,
  opciones,
  porDefecto = "",
  className = "sm:w-48",
  searchable,
}: {
  filtros: FiltrosUrl;
  param: string;
  /** Para lectores de pantalla: "Filtrar por estado". */
  etiqueta: string;
  /** Todas las opciones, incluida la de "Todos" (valor "" o el que corresponda). */
  opciones: SelectOption[];
  porDefecto?: string;
  className?: string;
  searchable?: boolean;
}) {
  const id = useId();
  // Un valor de la URL que no es una opción (a mano, o de otra versión) se ve como el de por defecto, igual que en el servidor.
  const crudo = filtros.valor(param);
  const actual = opciones.some((o) => o.value === crudo) && crudo !== "" ? crudo : porDefecto;
  return (
    <div className={cn("w-full", className)}>
      <span id={id} className="sr-only">
        {etiqueta}
      </span>
      <Select
        value={actual}
        aria-labelledby={id}
        onChange={(v) => filtros.aplicar({ [param]: v === porDefecto ? null : v })}
        options={opciones}
        searchable={searchable}
        className="h-9"
      />
    </div>
  );
}

/**
 * Línea fina sobre los resultados mientras el servidor recalcula. Reserva su
 * lugar siempre (no empuja la lista) y no atenúa el texto: el contraste de lo
 * que se está leyendo no baja. Quien la usa pone además `aria-busy` en la lista.
 */
export function BarraPendiente({ pending }: { pending: boolean }) {
  return (
    <div aria-hidden="true" className="-mb-2 h-0.5 w-full overflow-hidden rounded-full">
      <div className={cn("h-full w-full rounded-full bg-brand transition-opacity", pending ? "animate-pulse opacity-100 motion-reduce:animate-none" : "opacity-0")} />
    </div>
  );
}

/**
 * Un filtro de fecha atado a un parámetro de la URL. El campo guarda lo que la
 * persona tipea y solo escribe la URL cuando es una fecha real (año 1900 a
 * 2100): un `0002-01-15` a medio tipear no filtra nada. Igual que el buscador,
 * se rearma solo si la URL cambia por otro camino (atrás, "Limpiar filtros") y no
 * se pisa con su propia escritura.
 */
export function FiltroFecha({
  filtros,
  param,
  etiqueta,
  min,
  max,
}: {
  filtros: FiltrosUrl;
  param: string;
  etiqueta: string;
  min?: string;
  max?: string;
}) {
  const enUrl = filtros.valor(param);
  const [texto, setTexto] = useState(enUrl);
  const [enviado, setEnviado] = useState(enUrl);
  const [urlPrevia, setUrlPrevia] = useState(enUrl);
  if (enUrl !== urlPrevia) {
    setUrlPrevia(enUrl);
    if (enUrl !== enviado) {
      setTexto(enUrl);
      setEnviado(enUrl);
    }
  }

  function alCambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setTexto(v);
    // Vacío con `badInput` es una fecha a medio tipear, no un borrado.
    if (v === "" && e.target.validity.badInput) return;
    const limpio = v === "" ? "" : fechaParam(v);
    if (v !== "" && limpio === "") return;
    if (limpio === enviado) return;
    setEnviado(limpio);
    filtros.aplicar({ [param]: limpio || null });
  }

  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{etiqueta}</span>
      <Input
        type="date"
        value={texto}
        min={min || undefined}
        max={max || undefined}
        onChange={alCambiar}
        className="h-9 w-36 text-sm"
      />
    </label>
  );
}

/**
 * Anuncia a lectores de pantalla cuántos resultados hay. Una sola región viva por
 * lista, siempre presente (no cuelga de nada que se esconda cuando no hay filas),
 * así "Sin resultados" también se anuncia. Es invisible: el texto visible es el de `Paginacion`.
 */
export function AnuncioResultados({ total }: { total: number }) {
  return (
    <p role="status" className="sr-only">
      {total <= 0 ? "Sin resultados" : total === 1 ? "1 resultado" : `${total} resultados`}
    </p>
  );
}
