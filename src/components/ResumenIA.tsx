"use client";

import { useState } from "react";
import { resumirCuenta } from "@/app/(app)/ia/actions";
import { MENSAJES_IA } from "@/lib/ia/config";

/**
 * Estado de "Resumir con IA" sin UI. La pieza que lo dibuja es `ResumenIACrm` (`components/crm/cuenta/HistoriaCuenta.tsx`,
 * fichas de empresa y de contacto). `notificar` es su toast.
 */
export function useResumenIA(
  tipo: "empresa" | "contacto",
  id: string,
  notificar: (mensaje: string, tipo: "success" | "error") => void,
) {
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resumir() {
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await resumirCuenta({ tipo, id });
      if (res.ok) setTexto(res.texto);
      else setError(res.error);
    } catch {
      // La Server Action tiró (red, despliegue en curso): mensaje genérico, nunca el error crudo.
      setError(MENSAJES_IA.generico);
    } finally {
      setCargando(false);
    }
  }

  async function copiar() {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      notificar("Resumen copiado.", "success");
    } catch {
      notificar("No se pudo copiar. Seleccioná el texto y copialo a mano.", "error");
    }
  }

  return { cargando, texto, error, resumir, copiar, cerrar: () => setTexto(null) };
}
