import { Loader } from "./Loader";

/**
 * Loader de marca sobre la pantalla, para acciones que no tienen un boton de
 * formulario donde mostrar el spinner: acciones del menu "⋮", envios, y el
 * refresco de la lista despues de guardar. Los formularios siguen usando el
 * spinner dentro del boton (DESIGN.md §3.2).
 *
 * Por encima de modales y drawers (z-120) y por debajo de los toasts (z-130),
 * para que el resultado de la accion se vea apenas termina.
 */
export function OverlayCarga({ visible, texto = "Guardando…" }: { visible: boolean; texto?: string }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/50 backdrop-blur-[2px] animate-in fade-in duration-200"
    >
      <div className="rounded-2xl border bg-card px-10 py-7 shadow-xl">
        <Loader size="sm" text={texto} />
      </div>
    </div>
  );
}
