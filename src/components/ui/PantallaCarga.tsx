import { Loader } from "./Loader";

/**
 * Contenido de un `loading.tsx`: el loader de marca centrado, con que se esta
 * cargando y de que modulo. Cada modulo tiene el suyo, asi el usuario ve a
 * donde va mientras llegan los datos.
 */
export function PantallaCarga({ texto, modulo }: { texto: string; modulo: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[65vh] items-center justify-center">
      <Loader size="lg" text={texto} subtext={modulo} />
    </div>
  );
}
