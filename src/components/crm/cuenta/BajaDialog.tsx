"use client";

import { Pencil, Power } from "lucide-react";
import { ConfirmDialog } from "../Dialog";
import type { MenuItem } from "../Menu";
import { useCrmToast } from "../Toast";
import { darDeBajaCliente, reactivarCliente, textoBaja, type Fila, type TipoCliente } from "@/components/BajaCliente";

/**
 * Baja lógica de una empresa o contacto con el `ConfirmDialog` de CRM 2.0. La mutación y los textos son los de
 * `BajaCliente` (lógica sin UI); acá van el diálogo y el toast.
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

/** `reactivarCliente` con el toast de CRM 2.0: devuelve la fila reactivada (o null si falló). */
export function useReactivarCrm<T extends TipoCliente>(tipo: T) {
  const { showToast } = useCrmToast();
  return async function reactivar(id: string, nombre: string, empresaId?: string | null): Promise<Fila<T> | null> {
    const { row, aviso } = await reactivarCliente(tipo, id, nombre, empresaId);
    showToast(aviso.mensaje, aviso.tipo);
    return row;
  };
}

/**
 * "Editar" y "Dar de baja" / "Reactivar" de una empresa o un contacto, con las reglas de siempre: solo con
 * `clientes.editar`; "Reactivar" solo para `inactivo`; "No contactar" es un pedido del cliente: no se deshace con un
 * clic, se cambia desde Editar. Lo usan la fila, la vista previa y la ficha de las dos entidades.
 */
export function itemsEdicionCliente(
  estado: string,
  puedeEditar: boolean,
  acciones: { editar: () => void; reactivar: () => void; darDeBaja: () => void },
): MenuItem[] {
  if (!puedeEditar) return [];
  return [
    { label: "Editar", icon: Pencil, onSelect: acciones.editar },
    ...(estado === "inactivo"
      ? [{ label: "Reactivar", icon: Power, onSelect: acciones.reactivar }]
      : estado === "no_contactar"
        ? []
        : [{ label: "Dar de baja", icon: Power, variant: "danger" as const, onSelect: acciones.darDeBaja }]),
  ];
}
