import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { ESTADOS_OPORTUNIDAD } from "@/lib/oportunidades";
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
import OportunidadesView from "./OportunidadesView";
import { cargarOpciones } from "./datos";

export const metadata = { title: "Oportunidades" };

/** El tablero muestra todas las abiertas de una vez (no se pagina un kanban), pero con un techo. */
const TABLERO_MAX = 500;
/** Empresas, contactos o productos que se miran para encontrar una oportunidad por su cliente o su producto. */
const IDS_MAX = 100;
/** Valor de `?responsable=` para las oportunidades sin dueño. */
const SIN_RESPONSABLE = "sin";

const SELECT = `*,
  empresa:empresas(id, nombre),
  contacto:contactos(id, nombre, apellido),
  producto:productos(id, nombre),
  responsable:perfiles(id, nombre)`;

export default async function OportunidadesPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const sesion = await exigirPermiso("oportunidades.ver");
  const sp = await searchParams;
  const supabase = await createClient();

  const vista = opcionParam(sp.vista, ["tablero", "lista"] as const) || "tablero";
  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const puedeVerTodos = sesion.puede("clientes.ver_todos");
  // El estado solo vale en la lista: el tablero es, por definición, de las abiertas.
  const estado = vista === "lista" ? opcionParam(sp.estado, [...ESTADOS_OPORTUNIDAD.map((e) => e.value), "todos"] as const) || "abierta" : "abierta";
  const etapa = uuidParam(sp.etapa);
  const origen = uuidParam(sp.origen);
  // Sin clientes.ver_todos la RLS ya deja solo la cartera propia: filtrar por responsable no tiene sentido.
  const responsable = puedeVerTodos ? (sp.responsable === SIN_RESPONSABLE ? SIN_RESPONSABLE : uuidParam(sp.responsable)) : "";
  const hayFiltros = Boolean(q || etapa || origen || responsable || (vista === "lista" && estado !== "abierta"));

  // La búsqueda alcanza al título y también al cliente (empresa o contacto) y al producto.
  // ponytail: tope de IDS_MAX por tipo; una búsqueda muy corta ("a") puede dejar afuera oportunidades que solo coinciden
  // por el nombre de su cliente. Exacto con una vista que una la oportunidad con esos nombres.
  const [porEmpresa, porContacto, porProducto] = q
    ? await Promise.all([
        supabase.from("empresas").select("id").or(filtroOr(["nombre"], q)).limit(IDS_MAX),
        // "Nicolás Ibarra" tiene que encontrar al contacto aunque nombre y apellido sean columnas distintas.
        terminos(q)
          .reduce((consulta, palabra) => consulta.or(filtroOr(["nombre", "apellido"], palabra)), supabase.from("contactos").select("id"))
          .limit(IDS_MAX),
        supabase.from("productos").select("id").or(filtroOr(["nombre"], q)).limit(IDS_MAX),
      ])
    : [null, null, null];
  const filtroTexto = q
    ? filtroOr(
        ["titulo"],
        q,
        [
          ...condicionIn("empresa_id", (porEmpresa?.data ?? []).map((r) => r.id)),
          ...condicionIn("contacto_id", (porContacto?.data ?? []).map((r) => r.id)),
          ...condicionIn("producto_id", (porProducto?.data ?? []).map((r) => r.id)),
        ],
      )
    : "";

  const consultar = (desde: number, hasta: number) => {
    let query = supabase.from("oportunidades").select(SELECT, { count: "exact" });
    if (estado !== "todos") query = query.eq("estado", estado);
    if (etapa) query = query.eq("etapa_id", etapa);
    if (responsable === SIN_RESPONSABLE) query = query.is("responsable_id", null);
    else if (responsable) query = query.eq("responsable_id", responsable);
    if (origen) query = query.eq("origen_id", origen);
    if (filtroTexto) query = query.or(filtroTexto);
    // `id` desempata: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("created_at", { ascending: false }).order("id").range(desde, hasta);
  };

  const [opciones, lista, tablero, abiertas, todas] = await Promise.all([
    cargarOpciones(supabase),
    vista === "lista" ? leerPagina(consultar, paginacion) : null,
    vista === "tablero" ? consultar(0, TABLERO_MAX - 1) : null,
    supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("estado", "abierta"),
    supabase.from("oportunidades").select("id", { count: "exact", head: true }),
  ]);

  // Si un conteo falla no se sabe si el embudo está vacío: la pantalla no muestra el "primera vez" por un error.
  const cuentasOk = !abiertas.error && !todas.error;

  if (lista?.ultimaPagina) redirect(urlConParams("/oportunidades", sp, { page: String(lista.ultimaPagina) }));
  if (tablero?.error) throw new Error(`No se pudo leer el tablero: ${tablero.error.message}`);

  const filas = lista ? lista.filas : (tablero?.data ?? []);
  const total = lista ? lista.total : (tablero?.count ?? filas.length);

  // The header and toolbar live inside the view: the title shares a row with
  // the search and the filters (DESIGN.md §4.4).
  return (
    <OportunidadesView
      vista={vista}
      etapas={opciones.etapas}
      oportunidades={filas}
      total={total}
      tableroTruncado={vista === "tablero" && total > TABLERO_MAX}
      tableroMax={TABLERO_MAX}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltros={hayFiltros}
      cuentasOk={cuentasOk}
      totalAbiertas={abiertas.count ?? 0}
      totalTodas={todas.count ?? 0}
      // Opciones del formulario (empresa o contacto de la oportunidad). No dependen de la página.
      // ponytail: sin typeahead; PostgREST corta en `max_rows` (1000 por defecto), así que con más de 1000 empresas o
      // contactos el desplegable del formulario las recorta. Cuando pase: buscador en el servidor dentro del select.
      empresas={opciones.empresas}
      contactos={opciones.contactos}
      productos={opciones.productos}
      perfiles={opciones.perfiles}
      origenes={opciones.origenes}
      motivos={opciones.motivos}
      yoId={sesion.user.id}
      puedeEditar={sesion.puede("oportunidades.editar")}
      puedeAsignar={sesion.puede("oportunidades.asignar")}
      puedeReabrir={sesion.puede("oportunidades.reabrir")}
      puedeVerTodos={puedeVerTodos}
    />
  );
}
