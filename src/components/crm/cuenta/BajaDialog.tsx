"use client";

import { ConfirmDialog } from "../Dialog";
import { useCrmToast } from "../Toast";
import { darDeBajaCliente, reactivarCliente, textoBaja, type Fila, type TipoCliente } from "@/components/BajaCliente";

/**
 * Baja lógica de una empresa o contacto con el `ConfirmDialog` de CRM 2.0. La mutación y los textos son los de
 * `BajaCliente` (compartidos con el `BajaModal` legacy); acá solo cambian el diálogo y el toast.
 */
export function BajaDialog<T extends TipoCliente>({
  tipo,
  objetivo,
  onClose,
  onHecho,
}: {
  tipo: T;
  objetivo: { id: string; nombre: string } | null;
  onClose: () => void;
  onHecho: (fila: Fila<T>) => void;
}) {
  const { showToast } = useCrmToast();
  const texto = textoBaja(tipo, objetivo?.nombre ?? "");
  return (
    <ConfirmDialog
      open={Boolean(objetivo)}
      onClose={onClose}
      onConfirm={async () => {
        if (!objetivo) return;
        const { row, aviso } = await darDeBajaCliente(tipo, objetivo);
        showToast(aviso.mensaje, aviso.tipo);
        if (row) onHecho(row);
      }}
      title={texto.titulo}
      description={objetivo ? texto.descripcion : ""}
      confirmText="Dar de baja"
      variant="danger"
    />
  );
}

/** `reactivarCliente` con el toast de CRM 2.0 (misma firma que `useReactivar`). */
export function useReactivarCrm<T extends TipoCliente>(tipo: T) {
  const { showToast } = useCrmToast();
  return async function reactivar(id: string, nombre: string, empresaId?: string | null): Promise<Fila<T> | null> {
    const { row, aviso } = await reactivarCliente(tipo, id, nombre, empresaId);
    showToast(aviso.mensaje, aviso.tipo);
    return row;
  };
}
