"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { urlConParams } from "@/lib/paginacion";

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
 * Estado del buscador de una lista, sin UI (lo usa el buscador de CRM 2.0): escribe en la URL
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
 * Anuncia a lectores de pantalla cuántos resultados hay. Una sola región viva por
 * lista, siempre presente (no cuelga de nada que se esconda cuando no hay filas),
 * así "Sin resultados" también se anuncia. Es invisible: el texto visible es el de `ListFooter`.
 */
export function AnuncioResultados({ total }: { total: number }) {
  return (
    <p role="status" className="sr-only">
      {total <= 0 ? "Sin resultados" : total === 1 ? "1 resultado" : `${total} resultados`}
    </p>
  );
}
