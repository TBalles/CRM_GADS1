import type { Definition } from "@/components/crm/Panel";
import { FOCUS, cn } from "@/components/crm/cx";
import { formatFechaAlta, hrefSitioWeb } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline break-all", FOCUS);

/**
 * Los datos de la ficha de una empresa como `DefinitionList` (los mismos de siempre: CUIT, teléfono, email, sitio web,
 * dirección, responsable, origen, alta). Lo usan la vista previa y la ficha. Sin "use client".
 */
export function datosEmpresa(
  empresa: Tables<"empresas">,
  nombres: { responsable: string | null; origen: string | null },
  opciones: { conResponsable?: boolean } = {},
): Definition[] {
  const web = empresa.sitio_web ? hrefSitioWeb(empresa.sitio_web) : null;
  return [
    { term: "CUIT", value: empresa.cuit, mono: true },
    { term: "Teléfono", value: empresa.telefono, mono: true },
    {
      term: "Email",
      value: empresa.email && (
        <a href={`mailto:${empresa.email}`} className={LINK}>
          {empresa.email}
        </a>
      ),
    },
    {
      term: "Sitio web",
      value:
        empresa.sitio_web &&
        (web ? (
          <a href={web} target="_blank" rel="noopener noreferrer" className={LINK}>
            {empresa.sitio_web}
          </a>
        ) : (
          empresa.sitio_web
        )),
    },
    { term: "Dirección", value: empresa.direccion },
    ...(opciones.conResponsable === false ? [] : [{ term: "Responsable", value: nombres.responsable ?? "Sin asignar" }]),
    { term: "Origen", value: nombres.origen },
    { term: "Alta", value: formatFechaAlta(empresa.created_at), mono: true },
  ];
}
