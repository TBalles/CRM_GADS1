"use client";

import { Copy } from "lucide-react";
import { Button } from "./Button";
import { InlineBanner } from "./Feedback";
import { Input } from "./Field";
import { useCrmToast } from "./Toast";
import { TYPE, cn } from "./cx";

/**
 * Link de activación para compartir a mano cuando no hay SMTP configurado (mismo título y acciones de siempre: "Copiar" y
 * "Cerrar"). Lo usan Usuarios (invitar, reenviar) y el panel de plataforma (alta de cliente y de administrador); cada uno
 * pasa su línea de explicación.
 */
export function LinkManual({ link, onClose, children }: { link: string; onClose: () => void; children: React.ReactNode }) {
  const { showToast } = useCrmToast();
  return (
    <InlineBanner
      tone="info"
      title="El envío de mails no está configurado"
      className="my-2"
      action={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>{children}</p>
      <div className="mt-2 flex gap-2">
        <Input readOnly dense aria-label="Link de activación" value={link} className={cn(TYPE.mono, "sm:text-[12px]")} onFocus={(e) => e.target.select()} />
        <Button
          size="sm"
          icon={Copy}
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => showToast("Link copiado.", "success"),
              () => showToast("No se pudo copiar: seleccionalo a mano.", "error"),
            );
          }}
        >
          Copiar
        </Button>
      </div>
    </InlineBanner>
  );
}
