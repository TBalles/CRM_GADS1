import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { condicionIn, fechaParam, filtroOr, leerPagina, leerPaginacion, textoParam, urlConParams, uuidParam, type ParamsUrl } from "@/lib/paginacion";
import VentasList from "./VentasList";

export const metadata = { title: "Ventas" };

/** Empresas, productos y ventas que se miran para encontrar una venta por su cliente o por lo que se vendió. */
const IDS_MAX = 100;

export default async function VentasPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const sesion = await exigirPermiso("ventas.ver");
  const sp = await searchParams;
  const supabase = await createClient();

  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const empresa = uuidParam(sp.empresa);
  const desde = fechaParam(sp.desde);
  const hasta = fechaParam(sp.hasta);
  const hayFiltro = Boolean(q || empresa || desde || hasta);

  // La búsqueda alcanza al comprobante, al cliente y a los productos de la venta (que están en otra tabla).
  // ponytail: tope de IDS_MAX por paso; una búsqueda muy corta ("a") puede dejar afuera ventas que solo coinciden por
  // un producto o por el nombre del cliente. Exacto con una vista que una la venta con esos nombres.
  let porEmpresa: string[] = [];
  let porProducto: string[] = [];
  if (q) {
    const [empresas, productos] = await Promise.all([
      supabase.from("empresas").select("id").or(filtroOr(["nombre"], q)).limit(IDS_MAX),
      supabase.from("productos").select("id").or(filtroOr(["nombre"], q)).limit(IDS_MAX),
    ]);
    porEmpresa = (empresas.data ?? []).map((e) => e.id);
    const idsProducto = (productos.data ?? []).map((p) => p.id);
    if (idsProducto.length) {
      const { data } = await supabase.from("venta_items").select("venta_id").in("producto_id", idsProducto).limit(IDS_MAX);
      porProducto = [...new Set((data ?? []).map((i) => i.venta_id))];
    }
  }

  const consultar = (d: number, h: number) => {
    let query = supabase.from("ventas").select("*, empresa:empresas(id, nombre)", { count: "exact" });
    if (empresa) query = query.eq("empresa_id", empresa);
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    if (q) query = query.or(filtroOr(["comprobante"], q, [...condicionIn("empresa_id", porEmpresa), ...condicionIn("id", porProducto)]));
    // `created_at` e `id` desempatan: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("fecha", { ascending: false }).order("created_at", { ascending: false }).order("id").range(d, h);
  };

  const [pagina, todas, { data: empresas }, { data: contactos }, { data: productos }] = await Promise.all([
    leerPagina(consultar, paginacion),
    supabase.from("ventas").select("id", { count: "exact", head: true }),
    // Opciones del formulario y del filtro de cliente. No dependen de la página.
    // ponytail: sin typeahead; PostgREST corta en `max_rows` (1000 por defecto), así que con más de 1000 empresas o
    // contactos el desplegable las recorta. Cuando pase: buscador en el servidor dentro del select.
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("contactos").select("*").order("nombre"),
    supabase.from("productos").select("*").order("nombre"),
  ]);

  // Si el conteo falla no se sabe si hay ventas: la pantalla no muestra el "primera vez" por un error.
  const cuentasOk = !todas.error;

  if (pagina.ultimaPagina) redirect(urlConParams("/ventas", sp, { page: String(pagina.ultimaPagina) }));

  // Los ítems se piden solo de las ventas de esta página: son una consulta plana, con tipos exactos, y no una
  // anidada cuya inferencia hay que pelear.
  const ids = pagina.filas.map((v) => v.id);
  const { data: items } = ids.length ? await supabase.from("venta_items").select("*").in("venta_id", ids) : { data: [] };

  return (
    <VentasList
      puedeEditar={sesion.puede("ventas.editar")}
      ventas={pagina.filas}
      total={pagina.total}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltro={hayFiltro}
      cuentasOk={cuentasOk}
      totalVentas={todas.count ?? 0}
      items={items ?? []}
      empresas={empresas ?? []}
      contactos={contactos ?? []}
      productos={productos ?? []}
    />
  );
}
