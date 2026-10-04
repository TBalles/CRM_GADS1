/**
 * Lectura acotada de lo que alimenta la ficha 360 (F5) de una empresa o de un contacto.
 *
 * Una sola función para las dos fichas: cambia la columna por la que se filtra
 * (`empresa_id` o `contacto_id`). Todo pasa por el cliente con la sesión de la persona, así
 * que la RLS manda: un Vendedor solo recibe lo de su cartera, y lo que su rol no puede ver
 * (`bitacora.ver`, `oportunidades.ver`, `ventas.ver`, `alertas.ver`) vuelve vacío.
 *
 * Acotado a propósito: como mucho `TOPES` filas por tipo (las más recientes). Se piden `tope + 1`
 * para saber de verdad si hay más (una cuenta con exactamente el tope no está truncada), y si
 * pasa el tope `truncado` lo dice y la pantalla lo avisa en vez de callarlo.
 *
 * Sin `server-only` ni imports de aplicación: recibe el cliente de Supabase como argumento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

/**
 * Cuántas filas se muestran como máximo de cada tipo. Las oportunidades traen su historial
 * incrustado, así que se acotan más para no inflar la respuesta.
 */
export const TOPES = { actividades: 200, ventas: 200, cambios: 200, avisos: 200, oportunidades: 100 } as const;

export type PermisosCuenta360 = {
  oportunidades: boolean;
  ventas: boolean;
  actividades: boolean;
  avisos: boolean;
};

export type CambioEtapaFila = Pick<
  Tables<"oportunidad_etapas_historial">,
  "id" | "oportunidad_id" | "etapa_anterior_id" | "etapa_nueva_id" | "observacion" | "cambiado_en" | "usuario_id"
>;

export type OportunidadCuenta = Pick<
  Tables<"oportunidades">,
  "id" | "titulo" | "monto" | "estado" | "etapa_id" | "empresa_id" | "contacto_id" | "created_at" | "fecha_cierre"
>;

export type ItemVentaCuenta = Pick<
  Tables<"venta_items">,
  "id" | "producto_id" | "cantidad" | "precio_unitario" | "fecha_entrega" | "vida_util_meses"
> & { producto: { nombre: string; categoria: string | null } | null };

export type VentaCuenta = Pick<Tables<"ventas">, "id" | "fecha" | "comprobante"> & {
  items: ItemVentaCuenta[];
  /** Suma de cantidad × precio de sus ítems. */
  total: number;
};

export type AvisoCuenta = Pick<Tables<"alertas_enviadas">, "id" | "canal" | "destinatario" | "enviado_at" | "enviado_por" | "venta_item_id"> & {
  producto: string;
};

export type EtapaCuenta = Pick<Tables<"etapas">, "id" | "nombre" | "tipo" | "orden">;

export type Cuenta360 = {
  oportunidades: OportunidadCuenta[];
  cambios: CambioEtapaFila[];
  etapas: EtapaCuenta[];
  ventas: VentaCuenta[];
  avisos: AvisoCuenta[];
  actividades: Tables<"bitacora_entradas">[];
  /** Fecha de la primera compra de TODA la cuenta (una consulta aparte: vale aunque las ventas estén truncadas). */
  primeraCompra: string | null;
  truncado: { oportunidades: boolean; ventas: boolean; actividades: boolean; cambios: boolean; avisos: boolean };
};

type Fila = Record<string, unknown>;

/** Un error de lectura se propaga: una historia "vacía de mentira" sería peor que un aviso de error. */
function leer<T>(r: { data: T[] | null; error: { message: string } | null }, que: string): T[] {
  if (r.error) throw new Error(`No se pudo leer ${que}: ${r.error.message}`);
  return r.data ?? [];
}

export async function leerCuenta360(
  supabase: SupabaseClient<Database>,
  columna: "empresa_id" | "contacto_id",
  id: string,
  permisos: PermisosCuenta360,
): Promise<Cuenta360> {
  const vacio = Promise.resolve({ data: [] as never[], error: null });

  const [opsRes, etapasRes, ventasRes, actRes, primeraRes] = await Promise.all([
    permisos.oportunidades
      ? supabase
          .from("oportunidades")
          .select(
            "id, titulo, monto, estado, etapa_id, empresa_id, contacto_id, created_at, fecha_cierre, historial:oportunidad_etapas_historial(id, oportunidad_id, etapa_anterior_id, etapa_nueva_id, observacion, cambiado_en, usuario_id)",
          )
          .eq(columna, id)
          .order("created_at", { ascending: false })
          .limit(TOPES.oportunidades + 1)
      : vacio,
    permisos.oportunidades ? supabase.from("etapas").select("id, nombre, tipo, orden").order("orden") : vacio,
    permisos.ventas
      ? supabase
          .from("ventas")
          .select(
            "id, fecha, comprobante, items:venta_items(id, producto_id, cantidad, precio_unitario, fecha_entrega, vida_util_meses, producto:productos(nombre, categoria), avisos:alertas_enviadas(id, canal, destinatario, enviado_at, enviado_por, venta_item_id))",
          )
          .eq(columna, id)
          .order("fecha", { ascending: false })
          .limit(TOPES.ventas + 1)
      : vacio,
    permisos.actividades
      ? supabase.from("bitacora_entradas").select("*").eq(columna, id).order("ocurrido_en", { ascending: false }).limit(TOPES.actividades + 1)
      : vacio,
    permisos.ventas ? supabase.from("ventas").select("fecha").eq(columna, id).order("fecha", { ascending: true }).limit(1) : vacio,
  ]);

  const opsLeidas = leer(opsRes as { data: Fila[] | null; error: { message: string } | null }, "las oportunidades");
  const opsTruncadas = opsLeidas.length > TOPES.oportunidades;
  const opsCrudas = opsLeidas.slice(0, TOPES.oportunidades);
  const oportunidades: OportunidadCuenta[] = [];
  const todosCambios: CambioEtapaFila[] = [];
  for (const o of opsCrudas) {
    const { historial, ...resto } = o as Fila & { historial?: CambioEtapaFila[] | null };
    oportunidades.push(resto as unknown as OportunidadCuenta);
    todosCambios.push(...(historial ?? []));
  }
  todosCambios.sort((a, b) => b.cambiado_en.localeCompare(a.cambiado_en));

  const ventasLeidas = leer(ventasRes as { data: Fila[] | null; error: { message: string } | null }, "las ventas");
  const ventasTruncadas = ventasLeidas.length > TOPES.ventas;
  const ventasCrudas = ventasLeidas.slice(0, TOPES.ventas);
  const ventas: VentaCuenta[] = [];
  const todosAvisos: AvisoCuenta[] = [];
  for (const v of ventasCrudas) {
    const fila = v as unknown as Pick<Tables<"ventas">, "id" | "fecha" | "comprobante"> & {
      items: (ItemVentaCuenta & { avisos?: Omit<AvisoCuenta, "producto">[] | null })[] | null;
    };
    const items = (fila.items ?? []).map(({ avisos, ...it }) => {
      for (const a of avisos ?? []) todosAvisos.push({ ...a, producto: it.producto?.nombre ?? "Producto sin nombre" });
      return it;
    });
    ventas.push({
      id: fila.id,
      fecha: fila.fecha,
      comprobante: fila.comprobante,
      items,
      total: items.reduce((acc, it) => acc + it.cantidad * Number(it.precio_unitario ?? 0), 0),
    });
  }
  // Sin `alertas.ver` la RLS ya los devuelve vacíos; esto lo deja explícito.
  if (!permisos.avisos) todosAvisos.length = 0;
  todosAvisos.sort((a, b) => b.enviado_at.localeCompare(a.enviado_at));

  const actividadesLeidas = leer(actRes as { data: Tables<"bitacora_entradas">[] | null; error: { message: string } | null }, "las actividades");
  const actividadesTruncadas = actividadesLeidas.length > TOPES.actividades;
  const actividades = actividadesLeidas.slice(0, TOPES.actividades);
  const primera = leer(primeraRes as { data: { fecha: string }[] | null; error: { message: string } | null }, "la primera compra");
  const etapas = leer(etapasRes as { data: EtapaCuenta[] | null; error: { message: string } | null }, "las etapas");

  return {
    oportunidades,
    cambios: todosCambios.slice(0, TOPES.cambios),
    etapas,
    ventas,
    avisos: todosAvisos.slice(0, TOPES.avisos),
    actividades,
    primeraCompra: primera[0]?.fecha ?? null,
    truncado: {
      oportunidades: opsTruncadas,
      ventas: ventasTruncadas,
      actividades: actividadesTruncadas,
      cambios: todosCambios.length > TOPES.cambios,
      avisos: todosAvisos.length > TOPES.avisos,
    },
  };
}
