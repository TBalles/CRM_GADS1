import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { ESTADOS } from "@/lib/clientes";
import {
  condicionIn,
  filtroOr,
  leerPagina,
  leerPaginacion,
  opcionParam,
  terminos,
  textoParam,
  urlConParams,
  uuidParam,
  type ParamsUrl,
} from "@/lib/paginacion";
import ContactosList from "./ContactosList";

export const metadata = { title: "Contactos" };

const BAJAS = "(inactivo,no_contactar)";
/** Empresas que se miran por cada palabra para encontrar un contacto por el nombre de su empresa. */
const IDS_MAX = 100;

export default async function ContactosPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  // Los contactos cuelgan del mismo permiso que las empresas (`clientes.ver`).
  const sesion = await exigirPermiso("clientes.ver");
  const sp = await searchParams;
  const supabase = await createClient();

  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const puedeVerTodos = sesion.puede("clientes.ver_todos");
  const estado = opcionParam(sp.estado, ESTADOS.map((e) => e.value));
  const vinculo = opcionParam(sp.vinculo, ["empresa", "individual"] as const);
  const origen = uuidParam(sp.origen);
  // Sin clientes.ver_todos la RLS ya deja solo la cartera propia: filtrar por responsable no tiene sentido.
  const responsable = puedeVerTodos ? uuidParam(sp.responsable) : "";
  const verBajas = sp.bajas === "1";
  const hayFiltro = Boolean(q || estado || vinculo || origen || responsable);

  // "Juan Pérez" tiene que encontrar a Juan Pérez aunque el nombre y el apellido sean columnas distintas: cada palabra
  // debe aparecer en alguna columna (o en el nombre de la empresa del contacto).
  // ponytail: tope de IDS_MAX empresas por palabra; una palabra muy corta puede dejar afuera contactos que solo
  // coinciden por el nombre de su empresa. Exacto con una vista que una el contacto con el nombre de su empresa.
  const palabras = terminos(q);
  const empresasPorPalabra = await Promise.all(
    palabras.map(async (palabra) => {
      const { data } = await supabase.from("empresas").select("id").or(filtroOr(["nombre"], palabra)).limit(IDS_MAX);
      return (data ?? []).map((e) => e.id);
    }),
  );

  const consultar = (desde: number, hasta: number) => {
    let query = supabase.from("contactos").select("*, empresa:empresas(id, nombre)", { count: "exact" });
    // Un estado elegido a mano manda; sin elegir, las bajas quedan escondidas salvo "Ver bajas".
    if (estado) query = query.eq("estado", estado);
    else if (!verBajas) query = query.not("estado", "in", BAJAS);
    if (vinculo === "empresa") query = query.not("empresa_id", "is", null);
    if (vinculo === "individual") query = query.is("empresa_id", null);
    if (origen) query = query.eq("origen_id", origen);
    if (responsable) query = query.eq("responsable_id", responsable);
    palabras.forEach((palabra, i) => {
      query = query.or(
        filtroOr(["nombre", "apellido", "documento", "email", "telefono", "cargo"], palabra, condicionIn("empresa_id", empresasPorPalabra[i])),
      );
    });
    // `id` desempata: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("nombre").order("apellido").order("id").range(desde, hasta);
  };

  const visibles = supabase.from("contactos").select("id", { count: "exact", head: true });
  const [pagina, sinFiltro, bajas, individuales, { data: empresas }, { data: perfiles }, { data: origenes }] = await Promise.all([
    leerPagina(consultar, paginacion),
    verBajas ? visibles : visibles.not("estado", "in", BAJAS),
    supabase.from("contactos").select("id", { count: "exact", head: true }).in("estado", ["inactivo", "no_contactar"]),
    supabase.from("contactos").select("id", { count: "exact", head: true }).is("empresa_id", null).not("estado", "in", BAJAS),
    // Opciones del formulario (a qué empresa pertenece el contacto). No dependen de la página.
    // ponytail: sin typeahead; PostgREST corta en `max_rows` (1000 por defecto), así que con más de 1000 empresas el
    // desplegable del formulario las recorta. Cuando pase: buscador en el servidor dentro del select.
    supabase.from("empresas").select("id, nombre, estado").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
  ]);

  // Si un conteo falla no se sabe si la cartera está vacía: la pantalla no muestra el "primera vez" por un error.
  const cuentasOk = !sinFiltro.error && !bajas.error && !individuales.error;

  if (pagina.ultimaPagina) redirect(urlConParams("/contactos", sp, { page: String(pagina.ultimaPagina) }));

  return (
    <ContactosList
      contactos={pagina.filas}
      total={pagina.total}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltro={hayFiltro}
      cuentasOk={cuentasOk}
      visiblesSinFiltro={sinFiltro.count ?? 0}
      dadosDeBaja={bajas.count ?? 0}
      individuales={individuales.count ?? 0}
      empresas={empresas ?? []}
      perfiles={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }))}
      origenes={origenes ?? []}
      puedeEditar={sesion.puede("clientes.editar")}
      puedeAsignar={sesion.puede("clientes.asignar")}
      puedeVerTodos={puedeVerTodos}
      yoId={sesion.user.id}
    />
  );
}
