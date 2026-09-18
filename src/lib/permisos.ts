/**
 * Catalogo de PERMISOS de la app y roles por defecto de cada cliente.
 *
 * Modelo: la app define QUE se puede hacer (este catalogo, fijo, en codigo) y
 * cada organizacion arma sus ROLES como conjuntos de estos permisos. Un cliente
 * puede tener "Ventas", "RRHH", "Logistica" o lo que necesite, sin tocar codigo.
 *
 * La autorizacion REAL la hace la base: cada politica RLS pide el permiso que
 * corresponde (ver supabase/migrations/0004_multitenant.sql). Lo que la app
 * hace con este catalogo es solo UX: esconder lo que el usuario no puede usar.
 *
 * SINCRONIA: la lista de claves esta repetida en el CHECK de `roles.permisos` y
 * en la funcion que crea los roles por defecto (ambos en la migracion 0004).
 * permisos.check.ts falla si divergen.
 *
 * Imports relativos o ninguno: este modulo se prueba con `node --test`.
 */

export type Permiso =
  | "tablero.ver"
  | "clientes.ver"
  | "clientes.editar"
  | "bitacora.ver"
  | "bitacora.escribir"
  | "oportunidades.ver"
  | "oportunidades.editar"
  | "productos.ver"
  | "productos.editar"
  | "ventas.ver"
  | "ventas.editar"
  | "alertas.ver"
  | "alertas.enviar"
  | "usuarios.gestionar";

export type DefPermiso = {
  clave: Permiso;
  grupo: string;
  etiqueta: string;
  descripcion: string;
  /**
   * Permisos que hacen falta para que este funcione. Ej: para cargar una venta
   * hay que poder VER los clientes y los productos que se eligen en el
   * formulario. La pantalla de roles los tilda solos.
   */
  requiere: Permiso[];
};

export const PERMISOS: DefPermiso[] = [
  { clave: "tablero.ver", grupo: "Inicio", etiqueta: "Ver el tablero", descripcion: "Métricas del embudo y montos en juego.", requiere: ["oportunidades.ver"] },
  { clave: "clientes.ver", grupo: "Clientes", etiqueta: "Ver clientes", descripcion: "Empresas y sus contactos.", requiere: [] },
  { clave: "clientes.editar", grupo: "Clientes", etiqueta: "Crear y editar clientes", descripcion: "Alta y edición de empresas y contactos.", requiere: ["clientes.ver"] },
  { clave: "bitacora.ver", grupo: "Bitácora", etiqueta: "Ver la bitácora", descripcion: "Historial de charlas, consultas y quejas.", requiere: ["clientes.ver"] },
  { clave: "bitacora.escribir", grupo: "Bitácora", etiqueta: "Escribir en la bitácora", descripcion: "Agregar entradas (no se pueden editar ni borrar).", requiere: ["bitacora.ver"] },
  { clave: "oportunidades.ver", grupo: "Oportunidades", etiqueta: "Ver oportunidades", descripcion: "El embudo comercial.", requiere: ["clientes.ver", "productos.ver"] },
  { clave: "oportunidades.editar", grupo: "Oportunidades", etiqueta: "Gestionar oportunidades", descripcion: "Crear, editar y mover de etapa.", requiere: ["oportunidades.ver"] },
  { clave: "productos.ver", grupo: "Productos", etiqueta: "Ver el catálogo", descripcion: "Productos, precios y vida útil.", requiere: [] },
  { clave: "productos.editar", grupo: "Productos", etiqueta: "Editar el catálogo", descripcion: "Alta, edición y baja de productos.", requiere: ["productos.ver"] },
  { clave: "ventas.ver", grupo: "Ventas", etiqueta: "Ver ventas", descripcion: "Historial de entregas.", requiere: ["clientes.ver", "productos.ver"] },
  { clave: "ventas.editar", grupo: "Ventas", etiqueta: "Registrar ventas", descripcion: "Cargar ventas y sus productos.", requiere: ["ventas.ver"] },
  { clave: "alertas.ver", grupo: "Alertas", etiqueta: "Ver alertas de recambio", descripcion: "Equipos vencidos o por vencer.", requiere: ["ventas.ver"] },
  { clave: "alertas.enviar", grupo: "Alertas", etiqueta: "Enviar alertas", descripcion: "Mandar los avisos por mail y WhatsApp.", requiere: ["alertas.ver"] },
  { clave: "usuarios.gestionar", grupo: "Administración", etiqueta: "Gestionar usuarios y roles", descripcion: "Invitar, dar de baja, asignar roles y crear roles.", requiere: [] },
];

export const CLAVES_PERMISOS: Permiso[] = PERMISOS.map((p) => p.clave);

export function esPermiso(valor: unknown): valor is Permiso {
  return typeof valor === "string" && (CLAVES_PERMISOS as string[]).includes(valor);
}

/**
 * Agrega las dependencias (transitivas) de un conjunto de permisos. Se aplica
 * al GUARDAR un rol, en el servidor: un rol nunca queda con "registrar ventas"
 * pero sin poder ver los clientes que el formulario necesita.
 */
export function conDependencias(permisos: Iterable<Permiso>): Permiso[] {
  const porClave = new Map(PERMISOS.map((p) => [p.clave, p]));
  const resultado = new Set<Permiso>();
  const pendientes = [...permisos];
  while (pendientes.length) {
    const p = pendientes.pop()!;
    if (resultado.has(p)) continue;
    resultado.add(p);
    pendientes.push(...(porClave.get(p)?.requiere ?? []));
  }
  // Orden estable del catalogo, para que dos roles iguales se guarden iguales.
  return CLAVES_PERMISOS.filter((c) => resultado.has(c));
}

/** Roles con los que arranca cada cliente nuevo. El admin los puede editar (salvo Administrador) y crear otros. */
export const ROLES_POR_DEFECTO: { nombre: string; descripcion: string; esAdmin: boolean; permisos: Permiso[] }[] = [
  {
    nombre: "Administrador",
    descripcion: "Acceso total, incluida la gestión de usuarios y roles.",
    esAdmin: true,
    permisos: CLAVES_PERMISOS,
  },
  {
    nombre: "Ventas",
    descripcion: "Trabaja clientes, oportunidades, ventas y alertas. No administra usuarios.",
    esAdmin: false,
    permisos: conDependencias([
      "tablero.ver",
      "clientes.editar",
      "bitacora.escribir",
      "oportunidades.editar",
      "productos.ver",
      "ventas.editar",
      "alertas.enviar",
    ]),
  },
  {
    nombre: "Corporativo",
    descripcion: "Ve todo para seguimiento y reportes, sin modificar.",
    esAdmin: false,
    permisos: conDependencias(["tablero.ver", "bitacora.ver", "oportunidades.ver", "ventas.ver", "alertas.ver"]),
  },
  {
    nombre: "Solo lectura",
    descripcion: "Consulta clientes y catálogo.",
    esAdmin: false,
    permisos: conDependencias(["clientes.ver", "productos.ver"]),
  },
];

/** Primera pantalla a la que puede entrar un usuario (tras el login, o si abre una que no puede). */
export function rutaInicial(permisos: readonly string[]): string {
  const orden: [Permiso, string][] = [
    ["tablero.ver", "/dashboard"],
    ["oportunidades.ver", "/oportunidades"],
    ["clientes.ver", "/empresas"],
    ["ventas.ver", "/ventas"],
    ["alertas.ver", "/alertas"],
    ["productos.ver", "/productos"],
    ["usuarios.gestionar", "/usuarios"],
  ];
  return orden.find(([p]) => permisos.includes(p))?.[1] ?? "/sin-permisos";
}
