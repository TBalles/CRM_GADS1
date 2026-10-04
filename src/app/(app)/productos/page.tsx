import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { filtroOr, leerPagina, leerPaginacion, opcionParam, textoParam, urlConParams, type ParamsUrl } from "@/lib/paginacion";
import ProductosList from "./ProductosList";

export const metadata = { title: "Productos" };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const sesion = await exigirPermiso("productos.ver");
  const sp = await searchParams;
  const supabase = await createClient();

  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const estado = opcionParam(sp.estado, ["activo", "baja"] as const);

  // Opciones del filtro de categoría: el catálogo es chico y no depende de la página. La categoría de la URL se
  // acepta solo si es una de ellas, tal cual (sin recortar espacios): así un valor raro no filtra por nada.
  const { data: categorias } = await supabase.from("productos").select("categoria").not("categoria", "is", null);
  const opcionesCategoria = [...new Set((categorias ?? []).map((c) => c.categoria).filter((c): c is string => Boolean(c)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const pedida = Array.isArray(sp.categoria) ? sp.categoria[0] : sp.categoria;
  const categoria = pedida && opcionesCategoria.includes(pedida) ? pedida : "";
  const hayFiltro = Boolean(q || categoria || estado);

  const consultar = (desde: number, hasta: number) => {
    let query = supabase.from("productos").select("*", { count: "exact" });
    if (estado) query = query.eq("activo", estado === "activo");
    if (categoria) query = query.eq("categoria", categoria);
    if (q) query = query.or(filtroOr(["nombre", "marca", "categoria", "descripcion"], q));
    // `id` desempata: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("nombre").order("id").range(desde, hasta);
  };

  const [pagina, todos, conSeguimiento, masLarga] = await Promise.all([
    leerPagina(consultar, paginacion),
    supabase.from("productos").select("id", { count: "exact", head: true }),
    supabase.from("productos").select("id", { count: "exact", head: true }).not("vida_util_meses", "is", null),
    // La barrita de vida útil se mide contra lo que más dura del catálogo entero, no de la página.
    supabase.from("productos").select("vida_util_meses").not("vida_util_meses", "is", null).order("vida_util_meses", { ascending: false }).limit(1),
  ]);

  if (pagina.ultimaPagina) redirect(urlConParams("/productos", sp, { page: String(pagina.ultimaPagina) }));

  // Si un conteo falla no se sabe si el catálogo está vacío: la pantalla no muestra el "primera vez" por un error.
  const cuentasOk = !todos.error && !conSeguimiento.error;

  return (
    <ProductosList
      productos={pagina.filas}
      total={pagina.total}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltro={hayFiltro}
      cuentasOk={cuentasOk}
      totalCatalogo={todos.count ?? 0}
      conSeguimiento={conSeguimiento.count ?? 0}
      maxVida={masLarga.data?.[0]?.vida_util_meses ?? 0}
      categorias={opcionesCategoria}
      puedeEditar={sesion.puede("productos.editar")}
    />
  );
}
