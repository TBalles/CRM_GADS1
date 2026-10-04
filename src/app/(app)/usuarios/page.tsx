import { redirect } from "next/navigation";
import { getSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { rutaInicial } from "@/lib/permisos";
import {
  condicionIn,
  filtroOr,
  leerPagina,
  leerPaginacion,
  opcionParam,
  textoParam,
  urlConParams,
  uuidParam,
  type ParamsUrl,
} from "@/lib/paginacion";
import UsuariosView from "./UsuariosView";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const sesion = await getSesion();
  const orgId = sesion?.perfil?.organizacion_id;
  if (!sesion || !orgId) redirect("/login");
  if (!sesion.puede("usuarios.gestionar")) redirect(rutaInicial(sesion.permisos));

  const sp = await searchParams;
  const supabase = await createClient();

  const tab = opcionParam(sp.tab, ["usuarios", "roles"] as const) || "usuarios";
  const paginacion = leerPaginacion(sp);
  const q = textoParam(sp.q);
  const rol = uuidParam(sp.rol);
  const estado = opcionParam(sp.estado, ["activo", "pendiente", "baja"] as const);
  const hayFiltro = Boolean(q || rol || estado);

  // Filtro explicito por organizacion: si quien mira es ademas superadmin, la
  // RLS le deja ver usuarios y roles de TODOS los clientes, y esta pantalla es
  // solo de la suya.
  const { data: roles } = await supabase
    .from("roles")
    .select("id, nombre, descripcion, es_admin, permisos")
    .eq("organizacion_id", orgId)
    .order("es_admin", { ascending: false })
    .order("nombre");

  // La búsqueda también alcanza al nombre del rol; los roles son pocos y ya están cargados.
  const qMinuscula = q.toLowerCase();
  const rolesQueCoinciden = q ? (roles ?? []).filter((r) => r.nombre.toLowerCase().includes(qMinuscula)).map((r) => r.id) : [];

  const consultar = (desde: number, hasta: number) => {
    let query = supabase
      .from("perfiles")
      .select("id, nombre, email, rol_id, activo, activado_at", { count: "exact" })
      .eq("organizacion_id", orgId);
    if (rol) query = query.eq("rol_id", rol);
    if (estado === "baja") query = query.eq("activo", false);
    if (estado === "activo") query = query.eq("activo", true).not("activado_at", "is", null);
    if (estado === "pendiente") query = query.eq("activo", true).is("activado_at", null);
    if (q) query = query.or(filtroOr(["nombre", "email"], q, condicionIn("rol_id", rolesQueCoinciden)));
    // `id` desempata: sin un orden total, una fila podría repetirse o faltar entre dos páginas.
    return query.order("nombre").order("id").range(desde, hasta);
  };

  const [pagina, todos, { data: usosRaw }] = await Promise.all([
    // La pestaña Roles no usa la lista de usuarios: no se la pide.
    tab === "roles" ? { filas: [], total: 0, ultimaPagina: undefined } : leerPagina(consultar, paginacion),
    supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("organizacion_id", orgId),
    // Cuántos usuarios tiene cada rol (la pestaña Roles). Cuenta también a los dados de baja, y no depende de la página.
    // ponytail: una fila por usuario de la organización, con el tope de PostgREST (1000 por defecto). Una organización
    // con más gente que eso necesita un conteo agrupado en la base.
    supabase.from("perfiles").select("rol_id").eq("organizacion_id", orgId).not("rol_id", "is", null),
  ]);

  if (pagina.ultimaPagina) redirect(urlConParams("/usuarios", sp, { page: String(pagina.ultimaPagina) }));

  const usosPorRol: Record<string, number> = {};
  for (const u of usosRaw ?? []) if (u.rol_id) usosPorRol[u.rol_id] = (usosPorRol[u.rol_id] ?? 0) + 1;

  return (
    <UsuariosView
      tab={tab}
      usuarios={pagina.filas}
      total={pagina.total}
      page={paginacion.page}
      pageSize={paginacion.pageSize}
      q={q}
      hayFiltro={hayFiltro}
      totalUsuarios={todos.count ?? 0}
      usosPorRol={usosPorRol}
      roles={roles ?? []}
      yoId={sesion.user.id}
      miRolId={sesion.perfil?.rol_id ?? null}
    />
  );
}
