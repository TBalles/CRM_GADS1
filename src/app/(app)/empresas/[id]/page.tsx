import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { hoyAR } from "@/lib/oportunidades";
import { agruparParque, type GrupoParque, type ItemParque } from "@/lib/parque";
import EmpresaDetalle from "./EmpresaDetalle";

export const metadata = { title: "Empresa" };

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso("clientes.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const puedeVerOportunidades = sesion.puede("oportunidades.ver");
  const puedeVerVentas = sesion.puede("ventas.ver");
  const puedeVerActividades = sesion.puede("bitacora.ver");
  const nada = Promise.resolve({ data: null });

  // Un id que no existe y uno que la RLS esconde (la cartera de otro vendedor)
  // son lo mismo para esta pantalla: no hay ficha.
  const [
    { data: empresa },
    { data: contactos },
    { data: oportunidades },
    { data: etapas },
    { data: ventas },
    { data: actividades },
    { data: tipos },
    { data: perfiles },
    { data: origenes },
    canchasRes,
  ] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
    supabase.from("contactos").select("*").eq("empresa_id", id).order("nombre"),
    puedeVerOportunidades
      ? supabase
          .from("oportunidades")
          .select("id, titulo, monto, estado, etapa_id")
          .eq("empresa_id", id)
          .order("created_at", { ascending: false })
      : nada,
    puedeVerOportunidades ? supabase.from("etapas").select("id, nombre, tipo, orden") : nada,
    puedeVerVentas
      ? supabase.from("ventas").select("id, fecha, comprobante").eq("empresa_id", id).order("fecha", { ascending: false })
      : nada,
    puedeVerActividades
      ? supabase.from("bitacora_entradas").select("*").eq("empresa_id", id).order("ocurrido_en", { ascending: false })
      : nada,
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
    // F4: la tabla es de la migracion 0011. Si todavia no esta aplicada, la seccion no se muestra.
    supabase.from("canchas").select("*").eq("empresa_id", id).order("nombre"),
  ]);

  if (!empresa) notFound();

  // El total de cada venta es la suma de sus items. Dos consultas planas, como en /ventas.
  const idsVentas = (ventas ?? []).map((v) => v.id);
  const { data: items } = idsVentas.length
    ? await supabase
        .from("venta_items")
        .select("id, venta_id, producto_id, cantidad, precio_unitario, fecha_entrega, vida_util_meses")
        .in("venta_id", idsVentas)
    : { data: [] };
  const totalPorVenta = new Map<string, number>();
  for (const it of items ?? []) {
    totalPorVenta.set(it.venta_id, (totalPorVenta.get(it.venta_id) ?? 0) + it.cantidad * Number(it.precio_unitario ?? 0));
  }


  // Parque instalado: lo entregado a esta empresa, con la vida util que le queda a cada item (mismas ventas que arriba).
  let parque: GrupoParque[] | null = null;
  if (puedeVerVentas) {
    const idsProductos = [...new Set((items ?? []).map((i) => i.producto_id))];
    const { data: productos } = idsProductos.length
      ? await supabase.from("productos").select("id, nombre, categoria").in("id", idsProductos)
      : { data: [] };
    const productoPorId = new Map((productos ?? []).map((p) => [p.id, p]));
    const itemsParque: ItemParque[] = (items ?? []).map((i) => ({
      id: i.id,
      producto: productoPorId.get(i.producto_id)?.nombre ?? "Producto sin nombre",
      categoria: productoPorId.get(i.producto_id)?.categoria ?? null,
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
      oportunidades={oportunidades ?? []}
      etapas={etapas ?? []}
      ventas={(ventas ?? []).map((v) => ({ ...v, total: totalPorVenta.get(v.id) ?? 0 }))}
      actividades={actividades ?? []}
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
      puedeEscribirActividad={sesion.puede("bitacora.escribir")}
    />
  );
}
