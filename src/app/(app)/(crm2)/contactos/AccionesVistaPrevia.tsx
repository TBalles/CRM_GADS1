"use client";

import { useRouter } from "next/navigation";
import { NotebookPen, Pencil } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { Menu } from "@/components/crm/Menu";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { ActividadDrawer } from "@/components/crm/cuenta/ActividadDrawer";
import { nombreCompleto } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import type { TipoActividadOpcion } from "@/lib/formularios/actividad";
import type { Tables } from "@/lib/supabase/types";
import { itemsEdicion, oportunidadesParaActividad, useAccionesContacto, type CatalogosContacto } from "./acciones";

type Contacto = Tables<"contactos">;

/**
 * Acciones de la vista previa de un contacto: UNA visible ("Registrar actividad"; sin ese permiso, "Editar")
 * y el resto en `⋮` "Más acciones" (Editar, Dar de baja / Reactivar), con los drawers y diálogos de CRM 2.0. Después de
 * mutar, `router.refresh()`: la lista, el panel y la ficha vuelven del servidor. El foco vuelve al disparador, que sigue
 * existiendo aunque el contacto salga de la lista (el panel lo marca "Fuera de la lista actual").
 *
 * La actividad se cuelga también de la empresa del contacto (si la RLS la deja ver: si no, la base la rechazaría).
 */
export default function AccionesVistaPrevia({
  contacto,
  empresa,
  puedeEditar,
  puedeRegistrar,
  tipos,
  oportunidades,
  ...catalogos
}: CatalogosContacto & {
  contacto: Contacto;
  /** La empresa del contacto, solo si el usuario la ve. */
  empresa: EmpresaOpcion | null;
  puedeEditar: boolean;
  /** `bitacora.escribir` y `bitacora.ver`. */
  puedeRegistrar: boolean;
  tipos: TipoActividadOpcion[];
  /** Las de la cuenta del contacto (se ofrecen las abiertas que se pueden vincular). */
  oportunidades: Parameters<typeof oportunidadesParaActividad>[0];
}) {
  const router = useRouter();
  const refrescar = () => router.refresh();
  const acciones = useAccionesContacto(catalogos, refrescar);
  const actividad = useApertura<true>();
  const edicion = itemsEdicion(contacto, puedeEditar, acciones);
  const resto = puedeRegistrar ? edicion : edicion.slice(1);
  if (!puedeRegistrar && !puedeEditar) return null;

  return (
    <div className="flex items-center gap-1">
      {puedeRegistrar ? (
        <Button size="sm" icon={NotebookPen} onClick={() => actividad.abrir(true)}>
          Registrar actividad
        </Button>
      ) : (
        <Button size="sm" icon={Pencil} onClick={() => acciones.editar(contacto)}>
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
          contactoId={contacto.id}
          empresaId={empresa?.id ?? null}
          tipos={tipos}
          oportunidades={oportunidadesParaActividad(oportunidades, empresa)}
          avisoNoContactar={contacto.estado === "no_contactar" || empresa?.estado === "no_contactar"}
          description={nombreCompleto(contacto)}
          onSaved={() => {
            actividad.cerrar();
            refrescar();
          }}
        />
      )}
    </div>
  );
}
