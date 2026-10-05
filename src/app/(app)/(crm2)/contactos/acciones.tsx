"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import type { MenuItem } from "@/components/crm/Menu";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { BajaDialog, itemsEdicionCliente, useReactivarCrm } from "@/components/crm/cuenta/BajaDialog";
import { ContactoDrawer } from "@/components/crm/cuenta/ContactoDrawer";
import { nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import type { OportunidadCuenta } from "@/lib/cuenta360";
import type { Tables } from "@/lib/supabase/types";

type Contacto = Tables<"contactos">;

/** Lo que necesita el formulario de contacto (lo arma la página servidor). */
export type CatalogosContacto = {
  /** A qué empresa pertenece (las que la RLS deja ver). */
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** `clientes.asignar`. */
  puedeAsignar: boolean;
  yoId: string;
};

/**
 * Las acciones sobre un contacto (nuevo, editar, dar de baja, reactivar) con los drawers y diálogos de CRM 2.0
 * (`ContactoDrawer`, el mismo que usa la ficha de empresa; `BajaDialog`). Una sola implementación para la lista, la vista
 * previa y la ficha. `alCambiar` corre después de cada mutación (las pantallas hacen `router.refresh()`).
 */
export function useAccionesContacto(catalogos: CatalogosContacto, alCambiar: () => void) {
  const editor = useApertura<Contacto | null>();
  const [bajaDe, setBajaDe] = React.useState<Contacto | null>(null);
  const reactivarCrm = useReactivarCrm("contacto");

  return {
    nuevo: () => editor.abrir(null),
    editar: (c: Contacto) => editor.abrir(c),
    darDeBaja: (c: Contacto) => setBajaDe(c),
    reactivar: async (c: Contacto) => {
      if (await reactivarCrm(c.id, nombreCompleto(c), c.empresa_id)) alCambiar();
    },
    overlays: (
      <>
        <ContactoDrawer
          key={editor.n}
          open={editor.abierto}
          onClose={editor.cerrar}
          contacto={editor.valor ?? undefined}
          description={editor.valor ? nombreCompleto(editor.valor) : undefined}
          {...catalogos}
          onSaved={() => {
            editor.cerrar();
            alCambiar();
          }}
        />
        <BajaDialog
          tipo="contacto"
          objetivo={bajaDe ? { id: bajaDe.id, nombre: nombreCompleto(bajaDe) } : null}
          onClose={() => setBajaDe(null)}
          onHecho={() => alCambiar()}
        />
      </>
    ),
  };
}

export type AccionesContacto = ReturnType<typeof useAccionesContacto>;

/** "Editar" y "Dar de baja" / "Reactivar" con las reglas de siempre (`itemsEdicionCliente`, las mismas que empresas). */
export function itemsEdicion(c: Contacto, puedeEditar: boolean, acciones: AccionesContacto): MenuItem[] {
  return itemsEdicionCliente(c.estado, puedeEditar, {
    editar: () => acciones.editar(c),
    reactivar: () => void acciones.reactivar(c),
    darDeBaja: () => acciones.darDeBaja(c),
  });
}

/** El menú de una fila: "Ver ficha" + las de edición. */
export function itemsFila(c: Contacto, puedeEditar: boolean, acciones: AccionesContacto, verFicha: () => void): MenuItem[] {
  return [{ label: "Ver ficha", icon: Eye, onSelect: verFicha }, ...itemsEdicion(c, puedeEditar, acciones)];
}

/**
 * Las oportunidades que se pueden vincular a una actividad del contacto: las abiertas que no son de OTRA empresa (la RLS
 * rechaza vincular una oportunidad de otra empresa a la actividad de esta). Misma regla que la ficha legacy.
 */
export function oportunidadesParaActividad(oportunidades: OportunidadCuenta[], empresa: EmpresaOpcion | null) {
  return oportunidades
    .filter((o) => o.estado === "abierta" && (!empresa || o.empresa_id === null || o.empresa_id === empresa.id))
    .map((o) => ({ id: o.id, label: o.titulo }));
}
