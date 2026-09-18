import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import VentasList from "./VentasList";

export const metadata = { title: "Ventas" };

export default async function VentasPage() {
  const sesion = await exigirPermiso("ventas.ver");
  const supabase = await createClient();

  // Cabeceras e ítems se piden por separado y se cruzan en el cliente, en
  // lugar de con un embed de PostgREST: son dos consultas planas, con tipos
  // exactos, en vez de una anidada cuya inferencia hay que pelear.
  const [{ data: ventas }, { data: items }, { data: empresas }, { data: contactos }, { data: productos }] =
    await Promise.all([
      supabase.from("ventas").select("*").order("fecha", { ascending: false }),
      supabase.from("venta_items").select("*"),
      supabase.from("empresas").select("*").order("nombre"),
      supabase.from("contactos").select("*").order("nombre"),
      supabase.from("productos").select("*").order("nombre"),
    ]);

  return (
    <VentasList
      puedeEditar={sesion.puede("ventas.editar")}
      ventas={ventas ?? []}
      items={items ?? []}
      empresas={empresas ?? []}
      contactos={contactos ?? []}
      productos={productos ?? []}
    />
  );
}
