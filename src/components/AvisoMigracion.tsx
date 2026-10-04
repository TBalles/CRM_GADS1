import { DatabaseZap } from "lucide-react";

/**
 * Aviso para quien administra el sistema: esta sección existe en la aplicación pero
 * la base todavía no tiene la migración que la sostiene (las migraciones se aplican a
 * mano en el SQL Editor, ver docs/deploy.md). Al resto de los roles no se les muestra
 * nada: para ellos la sección simplemente no está. Sin estado ni hooks.
 */
export function AvisoMigracion({
  visible,
  migracion = "0011",
  que,
}: {
  /** Falta la migración Y quien mira administra la configuración. */
  visible: boolean;
  migracion?: string;
  /** Qué se activa: "las canchas y las licitaciones". */
  que: string;
}) {
  if (!visible) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-secondary p-3 text-sm text-muted-foreground"
    >
      <DatabaseZap aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong className="font-semibold text-foreground">Se activa al aplicar la migración {migracion}.</strong> Hasta
        entonces {que} no aparece. Los pasos están en la guía de despliegue.
      </span>
    </p>
  );
}
