"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import type { MenuItem } from "@/components/crm/Menu";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { BajaDialog, itemsEdicionCliente, useReactivarCrm } from "@/components/crm/cuenta/BajaDialog";
import type { OrigenOpcion, PerfilOpcion } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";
import EmpresaForm from "./EmpresaForm";

type Empresa = Tables<"empresas">;

/** Lo que necesita el formulario de empresa (lo arma la página servidor). */
export type CatalogosEmpresa = {
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** `clientes.asignar`. */
  puedeAsignar: boolean;
  yoId: string;
};

/**
 * Las acciones sobre una empresa (nueva, editar, dar de baja, reactivar) con sus drawers y diálogos de CRM 2.0. Una sola
 * implementación para la lista, la vista previa y la ficha: cada una dibuja sus botones y monta `overlays`.
 * `alCambiar` corre después de cada mutación (las pantallas hacen `router.refresh()`: los datos salen del servidor).
 */
export function useAccionesEmpresa(catalogos: CatalogosEmpresa, alCambiar: () => void) {
  const editor = useApertura<Empresa | null>();
  const [bajaDe, setBajaDe] = React.useState<Empresa | null>(null);
  const reactivarCrm = useReactivarCrm("empresa");

  return {
    nueva: () => editor.abrir(null),
    editar: (e: Empresa) => editor.abrir(e),
    darDeBaja: (e: Empresa) => setBajaDe(e),
    reactivar: async (e: Empresa) => {
      if (await reactivarCrm(e.id, e.nombre)) alCambiar();
    },
    overlays: (
      <>
        <EmpresaForm
          key={editor.n}
          open={editor.abierto}
          onClose={editor.cerrar}
          empresa={editor.valor ?? undefined}
          {...catalogos}
          onSaved={() => {
            editor.cerrar();
            alCambiar();
          }}
        />
        <BajaDialog
          tipo="empresa"
          objetivo={bajaDe ? { id: bajaDe.id, nombre: bajaDe.nombre } : null}
          onClose={() => setBajaDe(null)}
          onHecho={() => alCambiar()}
        />
      </>
    ),
  };
}

export type AccionesEmpresa = ReturnType<typeof useAccionesEmpresa>;

/** "Editar" y "Dar de baja" / "Reactivar" con las reglas de siempre (`itemsEdicionCliente`). */
export function itemsEdicion(e: Empresa, puedeEditar: boolean, acciones: AccionesEmpresa): MenuItem[] {
  return itemsEdicionCliente(e.estado, puedeEditar, {
    editar: () => acciones.editar(e),
    reactivar: () => void acciones.reactivar(e),
    darDeBaja: () => acciones.darDeBaja(e),
  });
}

/** El menú de una fila: "Ver ficha" + las de edición. */
export function itemsFila(e: Empresa, puedeEditar: boolean, acciones: AccionesEmpresa, verFicha: () => void): MenuItem[] {
  return [{ label: "Ver ficha", icon: Eye, onSelect: verFicha }, ...itemsEdicion(e, puedeEditar, acciones)];
}
