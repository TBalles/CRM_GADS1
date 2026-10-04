"use client";

import { useState } from "react";
import { Copy, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { resumirCuenta } from "@/app/(app)/ia/actions";
import { ComoUsamosIA, EtiquetaIA } from "@/components/IaAviso";
import { Button } from "@/components/ui/UIComponents";
import { useToast } from "@/components/ui/Toast";
import { MENSAJES_IA } from "@/lib/ia/config";

/**
 * "Resumir con IA" en la Historia de la cuenta (F7, ficha 360 de empresa y de contacto).
 *
 * El resumen vive solo en el estado de este componente: no se guarda, no se envía, no se agrega a la historia.
 * La Server Action recibe únicamente el tipo y el id; los datos los vuelve a leer el servidor con la sesión de
 * quien mira. Esta pieza solo se monta si el servidor dice que la IA está activada.
 */
export function ResumenIA({ tipo, id }: { tipo: "empresa" | "contacto"; id: string }) {
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

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
      showToast("Resumen copiado.", "success");
    } catch {
      showToast("No se pudo copiar. Seleccioná el texto y copialo a mano.", "error");
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={cargando} onClick={resumir}>
          {cargando ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}
          {cargando ? "Resumiendo…" : texto ? "Volver a resumir" : "Resumir con IA"}
        </Button>
        <ComoUsamosIA />
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {cargando ? "Armando el resumen con IA…" : texto ? "Resumen generado con IA listo para revisar." : ""}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {texto && (
        <section aria-label="Resumen generado con IA" className="rounded-lg border border-brand/30 bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <EtiquetaIA>Generado con IA: revisalo antes de usarlo, puede tener errores</EtiquetaIA>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={copiar}>
                <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5" disabled={cargando} onClick={resumir}>
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setTexto(null)}>
                <X aria-hidden="true" className="h-3.5 w-3.5" /> Cerrar
              </Button>
            </div>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{texto}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            No se guarda en el CRM: si lo querés conservar, copialo o registralo como una actividad.
          </p>
        </section>
      )}
    </div>
  );
}
