"use client";

import { useRef, useState } from "react";
import { Copy, Loader2, Mail, MessageCircle, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import Drawer from "@/components/Drawer";
import { ComoUsamosIA, EtiquetaIA } from "@/components/IaAviso";
import { Button, TONOS, Textarea, cn } from "@/components/ui/UIComponents";
import { useToast } from "@/components/ui/Toast";
import { MAX_MENSAJE_BORRADOR, MENSAJES_IA } from "@/lib/ia/config";
import type { Tables } from "@/lib/supabase/types";
import { redactarAvisoRecambio, type ResultadoBorrador } from "../ia/actions";
import { registrarEnvioConBorrador } from "./actions";
import { asunto, cuerpoWhatsapp, desdeFila, linkMailto, linkWhatsapp } from "./plantillas";

type Alerta = Tables<"alertas_vida_util">;

/**
 * Aviso de recambio redactado con IA (F7), dentro del flujo de alertas.
 *
 * La plantilla fija de siempre sigue siendo el camino por defecto y la red de seguridad: si la IA falla (por
 * el motivo que sea) el cuadro de texto se llena con la plantilla y se avisa. El borrador es editable y
 * nada sale hasta que la persona toca "WhatsApp" o "Mail": ahí se abre SU WhatsApp o SU cliente de correo con
 * el texto, y recién entonces se registra el aviso (la acción solo registra: no envía nada desde el servidor).
 */

type Estado = {
  alerta: Alerta | null;
  open: boolean;
  cargando: boolean;
  texto: string;
  origen: "ia" | "plantilla";
  /** Por qué no hubo borrador de la IA (se muestra con la plantilla en su lugar). */
  aviso: string | null;
  editado: boolean;
};

const INICIAL: Estado = { alerta: null, open: false, cargando: false, texto: "", origen: "plantilla", aviso: null, editado: false };

/**
 * El estado del borrador y cómo pedirlo. La llamada sale del clic (nunca de un efecto) y hay UNA sola en vuelo a la vez: mientras
 * una espera respuesta, otro clic (el mismo botón, "Regenerar", cerrar y volver a abrir) no dispara una segunda llamada paga.
 */
export function useBorradorIA() {
  const [s, setS] = useState<Estado>(INICIAL);
  /** `venta_item_id` de la alerta cuya llamada está en vuelo; null si no hay ninguna. */
  const enVuelo = useRef<string | null>(null);

  async function pedir(alerta: Alerta) {
    if (enVuelo.current) return;
    enVuelo.current = alerta.venta_item_id;
    setS((x) => ({ ...x, alerta, open: true, cargando: true, aviso: null }));
    let res: ResultadoBorrador;
    try {
      res = await redactarAvisoRecambio({ ventaItemId: alerta.venta_item_id });
    } catch {
      // La Server Action tiró (red, timeout del servidor, despliegue en curso): se trata como cualquier otra falla.
      res = { ok: false, error: MENSAJES_IA.generico };
    } finally {
      enVuelo.current = null;
    }
    setS((x) =>
      res.ok
        ? { ...x, cargando: false, texto: res.texto, origen: "ia", editado: false, aviso: null }
        : // Cualquier falla: la plantilla de siempre, lista para revisar y mandar.
          { ...x, cargando: false, texto: cuerpoWhatsapp(desdeFila(alerta)), origen: "plantilla", editado: false, aviso: res.error },
    );
  }

  return {
    estado: s,
    /** Abre el panel. Con una llamada en vuelo de esta misma alerta, o con su borrador ya hecho, reabre sin llamar de nuevo. */
    abrir(alerta: Alerta) {
      if (enVuelo.current) {
        if (enVuelo.current === alerta.venta_item_id) setS((x) => ({ ...x, open: true }));
        return;
      }
      if (s.alerta?.venta_item_id === alerta.venta_item_id && s.texto) {
        setS((x) => ({ ...x, open: true }));
        return;
      }
      setS({ ...INICIAL, alerta, open: true, cargando: true });
      void pedir(alerta);
    },
    regenerar: () => (s.alerta ? pedir(s.alerta) : undefined),
    cerrar: () => setS((x) => ({ ...x, open: false })),
    editar: (texto: string) => setS((x) => ({ ...x, texto, editado: true })),
    plantilla: () =>
      setS((x) => (x.alerta ? { ...x, texto: cuerpoWhatsapp(desdeFila(x.alerta)), origen: "plantilla", editado: false, aviso: null } : x)),
  };
}

export function BorradorIA({
  ia,
  onEnviado,
}: {
  ia: ReturnType<typeof useBorradorIA>;
  /** Después de registrar el aviso: la pantalla refresca las alertas. */
  onEnviado: () => void;
}) {
  const { estado: s } = ia;
  const { showToast } = useToast();
  const [enviando, setEnviando] = useState(false);
  const a = s.alerta;
  const vacio = !s.texto.trim();
  const anuncio = s.cargando
    ? "Redactando el borrador con IA…"
    : s.alerta && s.texto
      ? s.origen === "ia"
        ? "Borrador generado con IA listo para revisar."
        : "Se cargó la plantilla de siempre para revisar."
      : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(s.texto);
      showToast("Mensaje copiado.", "success");
    } catch {
      showToast("No se pudo copiar. Seleccioná el texto y copialo a mano.", "error");
    }
  }

  function regenerar() {
    // El borrador editado a mano se perdería: se pregunta antes.
    if (s.editado && !window.confirm("Vas a reemplazar lo que editaste por un borrador nuevo. ¿Seguimos?")) return;
    void ia.regenerar();
  }

  async function enviar(canal: "email" | "whatsapp") {
    if (!a?.venta_item_id || enviando) return;
    // Lo mismo que el servidor va a registrar: sin espacios de las puntas y dentro del tope. Se valida ANTES de abrir nada.
    const texto = s.texto.trim();
    if (!texto) return;
    if (texto.length > MAX_MENSAJE_BORRADOR) {
      showToast(`El mensaje supera los ${MAX_MENSAJE_BORRADOR} caracteres. Acortalo antes de enviarlo.`, "error");
      return;
    }
    const destino = canal === "email" ? (a.contacto_email ?? a.empresa_email ?? "") : (a.contacto_telefono ?? a.empresa_telefono ?? "");
    if (!destino) {
      showToast(
        canal === "email" ? "Este cliente no tiene email cargado. Agregalo desde Empresas." : "Este cliente no tiene teléfono cargado. Agregalo desde Empresas.",
        "error",
      );
      return;
    }
    // Se abre PRIMERO, todavía dentro del gesto del clic: si se espera al await el navegador bloquea la apertura.
    if (canal === "email") window.open(linkMailto(destino, asunto(desdeFila(a)), texto), "_self");
    else window.open(linkWhatsapp(destino, texto), "_blank", "noopener,noreferrer");

    setEnviando(true);
    let res: Awaited<ReturnType<typeof registrarEnvioConBorrador>>;
    try {
      res = await registrarEnvioConBorrador({ ventaItemId: a.venta_item_id, canal, mensaje: texto });
    } catch {
      showToast("No se pudo registrar el envío. Si mandaste el mensaje, no lo repitas.", "error");
      return;
    } finally {
      setEnviando(false);
    }
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast(canal === "email" ? "Abrimos tu cliente de correo con el mensaje y dejamos registrado el aviso." : "Abrimos WhatsApp con el mensaje y dejamos registrado el aviso.", "success");
    ia.cerrar();
    onEnviado();
  }

  return (
    <Drawer
      open={s.open}
      onClose={ia.cerrar}
      title="Aviso de recambio con IA"
      subtitle={a ? `${a.producto_nombre ?? "Equipo"} · ${a.empresa_nombre ?? "Cliente"}` : undefined}
      icon={Sparkles}
    >
      {/* Región viva persistente: un cambio de su texto se anuncia; una que aparece ya con el texto, no siempre. */}
      <div role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </div>
      {s.cargando ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-brand" />
          Redactando el borrador…
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {s.aviso && (
            <p role="alert" className={cn("rounded-md p-3 text-sm", TONOS.ambar)}>
              <strong className="font-semibold">No pudimos usar la IA.</strong> {s.aviso} Te dejamos la plantilla de siempre: revisala y
              mandala igual.
            </p>
          )}

          {s.origen === "ia" ? (
            <EtiquetaIA>Borrador generado con IA — revisalo antes de enviar</EtiquetaIA>
          ) : (
            <p className="text-xs font-semibold text-muted-foreground">Plantilla de siempre — revisala antes de enviar</p>
          )}

          <div>
            <label htmlFor="borrador-ia" className="mb-1 block text-xs font-medium text-muted-foreground">
              Mensaje (podés editarlo)
            </label>
            <Textarea
              id="borrador-ia"
              rows={11}
              maxLength={MAX_MENSAJE_BORRADOR}
              value={s.texto}
              aria-describedby="borrador-ia-cuenta"
              onChange={(e) => ia.editar(e.target.value)}
              className="resize-y"
            />
            <p id="borrador-ia-cuenta" className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {s.texto.length}/{MAX_MENSAJE_BORRADOR}
            </p>
          </div>

          <ComoUsamosIA />

          <div className="mt-auto flex flex-col gap-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {s.origen === "ia" && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={ia.plantilla}>
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" /> Volver a la plantilla
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={regenerar}>
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> {s.origen === "ia" ? "Regenerar con IA" : "Probar con IA de nuevo"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={vacio} onClick={copiar}>
                <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 gap-1.5" disabled={enviando || vacio} onClick={() => enviar("whatsapp")}>
                <MessageCircle aria-hidden="true" className="h-4 w-4" /> Abrir en WhatsApp
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5" disabled={enviando || vacio} onClick={() => enviar("email")}>
                <Mail aria-hidden="true" className="h-4 w-4" /> Abrir en mail
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se abre tu WhatsApp o tu correo con este texto y queda registrado el aviso. La IA no envía nada.
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
