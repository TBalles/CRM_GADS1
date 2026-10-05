"use client";

import { useRef, useState } from "react";
import { Copy, Mail, MessageCircle, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { ComoUsamosIA } from "@/components/IaAviso";
import { Button } from "@/components/crm/Button";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { Drawer } from "@/components/crm/Drawer";
import { InlineBanner, Skeleton } from "@/components/crm/Feedback";
import { Field, Textarea } from "@/components/crm/Field";
import { useCrmToast } from "@/components/crm/Toast";
import { TYPE, cn } from "@/components/crm/cx";
import { MAX_MENSAJE_BORRADOR, MENSAJES_IA } from "@/lib/ia/config";
import type { Tables } from "@/lib/supabase/types";
import { redactarAvisoRecambio, type ResultadoBorrador } from "@/app/(app)/ia/actions";
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
  const { showToast } = useCrmToast();
  const [enviando, setEnviando] = useState(false);
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
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
    // El borrador editado a mano se perdería: se pregunta antes (antes era el `confirm` del navegador; mismo texto).
    if (s.editado) setConfirmarRegenerar(true);
    else void ia.regenerar();
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
    showToast(
      canal === "email" ? "Abrimos tu cliente de correo con el mensaje y dejamos registrado el aviso." : "Abrimos WhatsApp con el mensaje y dejamos registrado el aviso.",
      "success",
    );
    ia.cerrar();
    onEnviado();
  }

  return (
    <>
      <Drawer
        open={s.open}
        onClose={ia.cerrar}
        title="Aviso de recambio con IA"
        description={a ? `${a.producto_nombre ?? "Equipo"} · ${a.empresa_nombre ?? "Cliente"}` : undefined}
        busy={enviando}
        footer={
          s.cargando ? undefined : (
            <>
              <Button icon={Mail} disabled={enviando || vacio} onClick={() => enviar("email")} className="max-sm:h-9">
                Abrir en mail
              </Button>
              <Button variant="primary" icon={MessageCircle} disabled={enviando || vacio} onClick={() => enviar("whatsapp")} className="max-sm:h-9">
                Abrir en WhatsApp
              </Button>
            </>
          )
        }
      >
        {/* Región viva persistente: un cambio de su texto se anuncia; una que aparece ya con el texto, no siempre. */}
        <div role="status" aria-live="polite" className="sr-only">
          {anuncio}
        </div>
        {s.cargando ? (
          // La forma del borrador que viene (etiqueta y cuadro de texto), con esqueletos en vez de un spinner.
          <div aria-busy="true" className="flex flex-col gap-3">
            <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Redactando el borrador…</p>
            <Skeleton className="w-56" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {s.aviso && (
              <InlineBanner tone="warning" role="alert" title="No pudimos usar la IA.">
                {s.aviso} Te dejamos la plantilla de siempre: revisala y mandala igual.
              </InlineBanner>
            )}

            {s.origen === "ia" ? (
              <p className={cn(TYPE.meta, "inline-flex items-center gap-1.5 font-medium text-(--crm-accent-text)")}>
                <Sparkles aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                Borrador generado con IA — revisalo antes de enviar
              </p>
            ) : (
              <p className={cn(TYPE.meta, "font-medium text-(--crm-text-2)")}>Plantilla de siempre — revisala antes de enviar</p>
            )}

            <Field id="borrador-ia" label="Mensaje (podés editarlo)" help={`${s.texto.length}/${MAX_MENSAJE_BORRADOR}`}>
              {(p) => <Textarea {...p} rows={11} maxLength={MAX_MENSAJE_BORRADOR} value={s.texto} onChange={(e) => ia.editar(e.target.value)} />}
            </Field>

            <div className="flex flex-wrap gap-2">
              {s.origen === "ia" && (
                <Button size="sm" icon={RotateCcw} onClick={ia.plantilla}>
                  Volver a la plantilla
                </Button>
              )}
              <Button size="sm" icon={RefreshCw} onClick={regenerar}>
                {s.origen === "ia" ? "Regenerar con IA" : "Probar con IA de nuevo"}
              </Button>
              <Button size="sm" icon={Copy} disabled={vacio} onClick={copiar}>
                Copiar
              </Button>
            </div>

            <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
              Se abre tu WhatsApp o tu correo con este texto y queda registrado el aviso. La IA no envía nada.
            </p>
            <ComoUsamosIA />
          </div>
        )}
      </Drawer>
      <ConfirmDialog
        open={confirmarRegenerar}
        onClose={() => setConfirmarRegenerar(false)}
        onConfirm={() => void ia.regenerar()}
        title="Regenerar el borrador"
        description="Vas a reemplazar lo que editaste por un borrador nuevo. ¿Seguimos?"
        confirmText="Regenerar"
      />
    </>
  );
}
