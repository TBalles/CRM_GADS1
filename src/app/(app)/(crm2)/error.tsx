"use client";

import { Button } from "@/components/crm/Button";
import { InlineBanner } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Error de una pantalla CRM 2.0 (MASTER.md §9.1: banner en línea con "Reintentar"). Se dibuja dentro del shell, en el
 * área de trabajo: el rail y la topbar siguen disponibles. Mismo patrón que el error legacy: `retry` (Next 16.3) vuelve
 * a pedir los datos; `reset` solo re-renderiza y queda de reserva.
 */
export default function ErrorCrm({ retry, reset }: { error: Error; retry?: () => void; reset?: () => void }) {
  return (
    <div className={cn(UI_ROOT, "min-h-full bg-(--crm-canvas) p-4 xl:p-6")}>
      <InlineBanner
        tone="danger"
        title="No se pudieron cargar los datos."
        action={
          <Button size="sm" onClick={() => (retry ?? reset)?.()}>
            Reintentar
          </Button>
        }
      >
        Fue un problema de conexión o de la base. Revisá la conexión y volvé a intentar.
      </InlineBanner>
    </div>
  );
}
