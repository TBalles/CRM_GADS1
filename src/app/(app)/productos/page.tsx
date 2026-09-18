import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import ProductosList from "./ProductosList";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const sesion = await exigirPermiso("productos.ver");
  const supabase = await createClient();
  const { data: productos } = await supabase.from("productos").select("*").order("nombre");

  return <ProductosList productos={productos ?? []} puedeEditar={sesion.puede("productos.editar")} />;
}
