import type { Definition } from "@/components/crm/Panel";
import { FOCUS, cn } from "@/components/crm/cx";
import { formatFechaAlta, hrefSitioWeb } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline break-all", FOCUS);

/**
 * El riel "Datos" de la ficha de una empresa como `DefinitionList`: teléfono, email, sitio web, dirección, origen y alta.
 * El estado, el tipo, el responsable y el CUIT ya están en la franja de identidad (`DetailHeader`): no se repiten acá.
 * Sin "use client".
 */
export function datosEmpresa(empresa: Tables<"empresas">, nombres: { origen: string | null }): Definition[] {
  const web = empresa.sitio_web ? hrefSitioWeb(empresa.sitio_web) : null;
  return [
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
    { term: "Origen", value: nombres.origen },
    { term: "Alta", value: formatFechaAlta(empresa.created_at), mono: true },
  ];
}
