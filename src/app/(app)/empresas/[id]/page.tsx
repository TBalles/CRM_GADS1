import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { hoyAR } from "@/lib/oportunidades";
import { agruparParque, type GrupoParque, type ItemParque } from "@/lib/parque";
import { leerCuenta360 } from "@/lib/cuenta360";
import { iaDisponible } from "@/lib/ia/config";
import EmpresaDetalle from "./EmpresaDetalle";

export const metadata = { title: "Empresa" };

/** Equipos entregados que se leen para el parque instalado (PostgREST corta en 1000 sin avisar). */
const TOPE_PARQUE = 1000;

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso("clientes.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const puedeVerOportunidades = sesion.puede("oportunidades.ver");
  const puedeVerVentas = sesion.puede("ventas.ver");
  const puedeVerActividades = sesion.puede("bitacora.ver");
  const puedeVerAvisos = sesion.puede("alertas.ver");

  // Un id que no existe y uno que la RLS esconde (la cartera de otro vendedor)
  // son lo mismo para esta pantalla: no hay ficha.
  const [
    { data: empresa },
    { data: contactos },
    cuenta,
    { data: tipos },
    { data: perfiles },
    { data: origenes },
    canchasRes,
    itemsRes,
  ] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
    supabase.from("contactos").select("*").eq("empresa_id", id).order("nombre"),
    // F5: oportunidades (con su historial), ventas (con ítems y avisos) y actividades, acotadas.
    leerCuenta360(supabase, "empresa_id", id, {
      oportunidades: puedeVerOportunidades,
      ventas: puedeVerVentas,
      actividades: puedeVerActividades,
      avisos: puedeVerAvisos,
    }),
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
    // F4: la tabla es de la migracion 0011. Si todavia no esta aplicada, la seccion no se muestra.
    supabase.from("canchas").select("*").eq("empresa_id", id).order("nombre"),
    // Parque instalado: TODO lo entregado a la empresa, no solo lo de las ventas que muestra la historia (que llevan tope).
    puedeVerVentas
      ? supabase
          .from("venta_items")
          .select("id, cantidad, fecha_entrega, vida_util_meses, producto:productos(nombre, categoria), ventas!inner(empresa_id)")
          .eq("ventas.empresa_id", id)
          .order("fecha_entrega", { ascending: false })
          .limit(TOPE_PARQUE + 1)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!empresa) notFound();

  // Parque instalado: lo entregado a esta empresa, con la vida util que le queda a cada item.
  if (itemsRes.error) throw new Error(`No se pudo leer el parque instalado: ${itemsRes.error.message}`);
  const filasParque = itemsRes.data ?? [];
  const parqueTruncado = filasParque.length > TOPE_PARQUE;
  let parque: GrupoParque[] | null = null;
  if (puedeVerVentas) {
    const itemsParque: ItemParque[] = filasParque.slice(0, TOPE_PARQUE).map((i) => ({
      id: i.id,
      producto: i.producto?.nombre ?? "Producto sin nombre",
      categoria: i.producto?.categoria ?? null,
      cantidad: i.cantidad,
      fechaEntrega: i.fecha_entrega,
      vidaUtilMeses: i.vida_util_meses,
    }));
    parque = agruparParque(itemsParque, hoyAR());
  }

  // Cualquier error de la tabla que no sea "todavia no existe" es un error de verdad.
  const faltaMigracion = esErrorDeEsquema(canchasRes.error);
  if (canchasRes.error && !faltaMigracion) throw new Error(`No se pudieron leer las canchas: ${canchasRes.error.message}`);

  return (
    <EmpresaDetalle
      empresa={empresa}
      contactos={contactos ?? []}
      oportunidades={cuenta.oportunidades}
      etapas={cuenta.etapas}
      ventas={cuenta.ventas}
      actividades={cuenta.actividades}
      cambios={cuenta.cambios}
      avisos={cuenta.avisos}
      truncado={cuenta.truncado}
      primeraCompra={cuenta.primeraCompra}
      parqueTruncado={parqueTruncado}
      hoy={hoyAR()}
      tipos={tipos ?? []}
      perfiles={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }))}
      origenes={origenes ?? []}
      parque={parque}
      canchas={faltaMigracion ? null : (canchasRes.data ?? [])}
      mostrarAvisoMigracion={faltaMigracion && sesion.puede("configuracion.gestionar")}
      puedeCrearOportunidad={sesion.puede("oportunidades.editar")}
      yoId={sesion.user.id}
      puedeEditar={sesion.puede("clientes.editar")}
      puedeAsignar={sesion.puede("clientes.asignar")}
      puedeVerOportunidades={puedeVerOportunidades}
      puedeVerVentas={puedeVerVentas}
      puedeVerActividades={puedeVerActividades}
      puedeVerAvisos={puedeVerAvisos}
      puedeEscribirActividad={sesion.puede("bitacora.escribir")}
      iaDisponible={iaDisponible()}
    />
  );
}
