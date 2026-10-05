import { cn } from "@/lib/utils";

/**
 * Piezas de transparencia de la IA asistida (F7). Server-safe: sin estado ni hooks.
 *
 * `ComoUsamosIA` es el aviso corto de qué se manda y qué no, junto a los botones. (La etiqueta "Generado con IA" la
 * dibuja cada pantalla de CRM 2.0 con sus tokens: Alertas y la historia de la cuenta.) El texto de acá y el de docs/ia.md tienen que decir lo mismo.
 */

export function ComoUsamosIA({ className }: { className?: string }) {
  return (
    <details className={cn("group text-xs text-muted-foreground", className)}>
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-sm font-medium underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        Cómo usamos la IA
      </summary>
      <div className="mt-2 max-w-prose space-y-2 rounded-lg border border-border bg-secondary/50 p-3 leading-relaxed">
        <p>
          <strong className="font-semibold text-foreground">Qué se envía.</strong> Solo cuando tocás un botón de IA, mandamos a
          Anthropic (el proveedor del modelo Claude) un texto armado con datos de esta cuenta: el nombre del club o del cliente,
          el nombre de pila del contacto, los equipos entregados y sus fechas, las compras, las canchas y las actividades recientes
          (título y detalle recortados).
        </p>
        <p>
          <strong className="font-semibold text-foreground">Qué no se envía.</strong> No pedimos mails, teléfonos, CUIT,
          documentos, direcciones, números de comprobante ni notas de la ficha. En los textos libres que sí van (actividades,
          nombres de productos) intentamos tachar mails, enlaces, CUIT y números largos, pero no es infalible: un nombre propio
          o una dirección escrita en una frase pueden pasar.
        </p>
        <p>
          <strong className="font-semibold text-foreground">Qué hace y qué no.</strong> La IA solo redacta un borrador. No envía
          nada, no cambia datos del CRM, no decide por vos y no guardamos lo que escribe. Lo revisás y lo editás vos antes de
          usarlo, y puede equivocarse. Si falla, seguís con la plantilla de siempre.
        </p>
        <p>
          La función se apaga quitando la clave del servidor: sin ella no aparecen estos botones.
        </p>
      </div>
    </details>
  );
}
