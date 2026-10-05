import Link from "next/link";
import type { Definition } from "@/components/crm/Panel";
import { FOCUS, cn } from "@/components/crm/cx";
import { formatFechaAlta } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import type { Tables } from "@/lib/supabase/types";

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);

/**
 * La empresa de un contacto como valor de un dato: link a su ficha, "Sin empresa: cliente individual" o "Empresa de otra
 * cartera" (la RLS no se la muestra a quien mira). Mismos textos que la ficha legacy.
 */
export function empresaDelContacto(contacto: Tables<"contactos">, empresa: EmpresaOpcion | null) {
  if (!contacto.empresa_id) return "Sin empresa: cliente individual";
  if (!empresa) return <span className="text-(--crm-text-2)">Empresa de otra cartera</span>;
  return (
    <Link href={`/empresas/${empresa.id}`} className={LINK}>
      {empresa.nombre}
    </Link>
  );
}

/** El mail como link `mailto:` (o nada). */
export function mailDe(email: string | null) {
  return (
    email && (
      <a href={`mailto:${email}`} className={cn(LINK, "break-all")}>
        {email}
      </a>
    )
  );
}

/**
 * Los datos de la ficha de un contacto como `DefinitionList` (los mismos de siempre: empresa, documento, email, teléfono,
 * cargo, responsable, origen, alta; las observaciones van aparte). Sin "use client".
 */
export function datosContacto(
  contacto: Tables<"contactos">,
  nombres: { empresa: EmpresaOpcion | null; responsable: string | null; origen: string | null },
): Definition[] {
  return [
    { term: "Empresa", value: empresaDelContacto(contacto, nombres.empresa) },
    { term: "Documento", value: contacto.documento, mono: true },
    { term: "Email", value: mailDe(contacto.email) },
    { term: "Teléfono", value: contacto.telefono, mono: true },
    { term: "Cargo", value: contacto.cargo },
    { term: "Responsable", value: nombres.responsable ?? "Sin asignar" },
    { term: "Origen", value: nombres.origen },
    { term: "Alta", value: formatFechaAlta(contacto.created_at), mono: true },
  ];
}
