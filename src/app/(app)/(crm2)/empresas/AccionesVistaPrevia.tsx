"use client";

import { useRouter } from "next/navigation";
import { NotebookPen, Pencil } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { Menu } from "@/components/crm/Menu";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { ActividadDrawer } from "@/components/crm/cuenta/ActividadDrawer";
import type { TipoActividadOpcion } from "@/lib/formularios/actividad";
import type { Tables } from "@/lib/supabase/types";
import { itemsEdicion, useAccionesEmpresa, type CatalogosEmpresa } from "./acciones";

type Opcion = { id: string; label: string };

/**
 * Acciones de la vista previa: UNA visible ("Registrar actividad"; sin ese permiso, "Editar") y el resto en `⋮`
 * "Más acciones" (Editar, Dar de baja / Reactivar), con los mismos drawers, diálogos y permisos que la ficha. Después de
 * mutar, `router.refresh()` (la lista y el panel vuelven del servidor). El foco vuelve al `⋮`, que sigue existiendo
 * aunque la empresa salga de la lista (el panel la marca "Fuera de la lista actual").
 */
export default function AccionesVistaPrevia({
  empresa,
  puedeEditar,
  puedeRegistrar,
  tipos,
  contactos,
  oportunidades,
  ...catalogos
}: CatalogosEmpresa & {
  empresa: Tables<"empresas">;
  puedeEditar: boolean;
  /** `bitacora.escribir` y `bitacora.ver`. */
  puedeRegistrar: boolean;
  tipos: TipoActividadOpcion[];
  contactos: Opcion[];
  oportunidades: Opcion[];
}) {
  const router = useRouter();
  const refrescar = () => router.refresh();
  const acciones = useAccionesEmpresa(catalogos, refrescar);
  const actividad = useApertura<true>();
  const edicion = itemsEdicion(empresa, puedeEditar, acciones);
  const resto = puedeRegistrar ? edicion : edicion.slice(1);
  if (!puedeRegistrar && !puedeEditar) return null;

  return (
    <div className="flex items-center gap-1">
      {puedeRegistrar ? (
        <Button size="sm" icon={NotebookPen} onClick={() => actividad.abrir(true)}>
          Registrar actividad
        </Button>
      ) : (
        <Button size="sm" icon={Pencil} onClick={() => acciones.editar(empresa)}>
          Editar
        </Button>
      )}
      {resto.length > 0 && <Menu label="Más acciones" size="sm" items={resto} />}
      {acciones.overlays}
      {puedeRegistrar && (
        <ActividadDrawer
          key={actividad.n}
          open={actividad.abierto}
          onClose={actividad.cerrar}
          empresaId={empresa.id}
          tipos={tipos}
          contactos={contactos}
          oportunidades={oportunidades}
          avisoNoContactar={empresa.estado === "no_contactar"}
          description={empresa.nombre}
          onSaved={() => {
            actividad.cerrar();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
