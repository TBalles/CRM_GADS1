import { createClient } from "@/lib/supabase/server";
import ProductosList from "./ProductosList";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: productos } = await supabase.from("productos").select("*").order("nombre");

  return <ProductosList productos={productos ?? []} />;
}
