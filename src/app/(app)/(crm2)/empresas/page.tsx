import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { ESTADOS, TIPOS_CLIENTE, estaDeBaja } from "@/lib/clientes";
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
import EmpresasList from "./EmpresasList";
import VistaPrevia, { VistaPreviaCargando } from "./VistaPrevia";

export const metadata = { title: "Empresas" };

const BAJAS = "(inactivo,no_contactar)";
/** Contactos que se miran para encontrar una empresa por su gente. Más de esto cabría mal en la URL del `.or()`. */
const IDS_MAX = 100;

/**
 * Empresas (CRM 2.0): lista servida por la URL + vista previa (master-detail desde 1280 px).
 *
 * La selección vive en la URL (`?sel=<id>`, junto a q/page/filtros): el servidor la lee y dibuja la vista previa como
 * un server component dentro de `<Suspense key={sel}>`, con el mismo cliente con RLS y la misma capa de datos que la
 * ficha. Un `sel` inválido, de otra cartera o inexistente no dibuja nada (la RLS lo esconde). Atrás/adelante, recarga
 * y link directo funcionan porque la URL es el único estado.
 */
export default async function EmpresasPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const sesion = await exigirPermiso("clientes.ver");
  const sp = await searchParams;
  const supabase = await createClient();

  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const puedeVerTodos = sesion.puede("clientes.ver_todos");
  const estado = opcionParam(sp.estado, ESTADOS.map((e) => e.value));
  const tipo = opcionParam(sp.tipo, TIPOS_CLIENTE.map((t) => t.value));
  const origen = uuidParam(sp.origen);
  // Sin clientes.ver_todos la RLS ya deja solo la cartera propia: filtrar por responsable no tiene sentido.
  const responsable = puedeVerTodos ? uuidParam(sp.responsable) : "";
  const verBajas = sp.bajas === "1";
  const hayFiltro = Boolean(q || estado || tipo || origen || responsable);
  const sel = uuidParam(sp.sel);

  // La búsqueda alcanza a la gente de la empresa: se buscan primero los contactos que coinciden y se suman sus empresas.
  // ponytail: tope de IDS_MAX contactos por búsqueda; una búsqueda muy corta ("a") puede dejar afuera empresas que solo
  // coinciden por un contacto. Cuando haga falta exacto: una vista o RPC que una empresa con el nombre de sus contactos.
  let porGente: string[] = [];
  if (q) {
    // "Martín Gutiérrez" tiene que encontrar a Martín Gutiérrez aunque nombre y apellido sean columnas distintas:
    // cada palabra debe aparecer en alguna de ellas.
    let consulta = supabase.from("contactos").select("empresa_id").not("empresa_id", "is", null);
    for (const palabra of terminos(q)) consulta = consulta.or(filtroOr(["nombre", "apellido", "email"], palabra));
    const { data } = await consulta.limit(IDS_MAX);
    porGente = [...new Set((data ?? []).flatMap((c) => (c.empresa_id ? [c.empresa_id] : [])))];
  }

  const consultar = (desde: number, hasta: number) => {
    let query = supabase.from("empresas").select("*", { count: "exact" });
    // Un estado elegido a mano manda; sin elegir, las dadas de baja quedan escondidas salvo "Ver dadas de baja".
    if (estado) query = query.eq("estado", estado);
    else if (!verBajas) query = query.not("estado", "in", BAJAS);
    if (tipo) query = query.eq("tipo_cliente", tipo);
    if (origen) query = query.eq("origen_id", origen);
    if (responsable) query = query.eq("responsable_id", responsable);
    if (q) query = query.or(filtroOr(["nombre", "cuit", "email", "telefono", "direccion"], q, condicionIn("id", porGente)));
    // `id` desempata: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("nombre").order("id").range(desde, hasta);
  };

  const visibles = supabase.from("empresas").select("id", { count: "exact", head: true });
  const [pagina, sinFiltro, bajas, contactosTotal, { data: perfilesRaw }, { data: origenesRaw }] = await Promise.all([
    leerPagina(consultar, paginacion),
    verBajas ? visibles : visibles.not("estado", "in", BAJAS),
    supabase.from("empresas").select("id", { count: "exact", head: true }).in("estado", ["inactivo", "no_contactar"]),
    supabase.from("contactos").select("id", { count: "exact", head: true }).not("empresa_id", "is", null),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
  ]);

  // Si un conteo falla no se sabe si la cartera está vacía: la pantalla no muestra el "primera vez" por un error.
  const cuentasOk = !sinFiltro.error && !bajas.error && !contactosTotal.error;

  if (pagina.ultimaPagina) redirect(urlConParams("/empresas", sp, { page: String(pagina.ultimaPagina) }));

  // Cuántos contactos activos tiene cada empresa de ESTA página (la página trae a lo sumo 50 empresas).
  const ids = pagina.filas.map((e) => e.id);
  const { data: gente } = ids.length
    ? await supabase.from("contactos").select("empresa_id, estado").in("empresa_id", ids)
    : { data: [] };
  const contactosPorEmpresa: Record<string, number> = {};
  for (const c of gente ?? []) {
    if (c.empresa_id && !estaDeBaja(c.estado)) contactosPorEmpresa[c.empresa_id] = (contactosPorEmpresa[c.empresa_id] ?? 0) + 1;
  }

  const perfiles = (perfilesRaw ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }));
  const origenes = origenesRaw ?? [];
  const permisos = {
    puedeEditar: sesion.puede("clientes.editar"),
    puedeAsignar: sesion.puede("clientes.asignar"),
  };

  const panel = sel ? (
    <Suspense key={sel} fallback={<VistaPreviaCargando />}>
      <VistaPrevia
        id={sel}
        params={sp}
        enLista={ids.includes(sel)}
        perfiles={perfiles}
        origenes={origenes}
        yoId={sesion.user.id}
        puedeEditar={permisos.puedeEditar}
        puedeAsignar={permisos.puedeAsignar}
        permisos={{
          oportunidades: sesion.puede("oportunidades.ver"),
          ventas: sesion.puede("ventas.ver"),
          actividades: sesion.puede("bitacora.ver"),
          avisos: sesion.puede("alertas.ver"),
        }}
        puedeEscribirActividad={sesion.puede("bitacora.escribir")}
      />
    </Suspense>
  ) : null;

  return (
    <EmpresasList
      empresas={pagina.filas}
      total={pagina.total}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltro={hayFiltro}
      cuentasOk={cuentasOk}
      visiblesSinFiltro={sinFiltro.count ?? 0}
      dadasDeBaja={bajas.count ?? 0}
      totalContactos={contactosTotal.count ?? 0}
      contactosPorEmpresa={contactosPorEmpresa}
      perfiles={perfiles}
      origenes={origenes}
      puedeEditar={permisos.puedeEditar}
      puedeAsignar={permisos.puedeAsignar}
      puedeVerTodos={puedeVerTodos}
      yoId={sesion.user.id}
      sel={sel || null}
      panel={panel}
    />
  );
}
