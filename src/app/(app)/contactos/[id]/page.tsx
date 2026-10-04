import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import ContactoDetalle from "./ContactoDetalle";

export const metadata = { title: "Contacto" };

export default async function ContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso("clientes.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  // Un id que no existe y uno que la RLS esconde son lo mismo para esta pantalla: no hay ficha.
  const { data: contacto } = await supabase.from("contactos").select("*").eq("id", id).maybeSingle();
  if (!contacto) notFound();

  const puedeVerOportunidades = sesion.puede("oportunidades.ver");
  const puedeVerVentas = sesion.puede("ventas.ver");
  const puedeVerActividades = sesion.puede("bitacora.ver");
  const nada = Promise.resolve({ data: null });

  const [
    { data: empresas },
    { data: oportunidades },
    { data: etapas },
    { data: ventas },
    { data: actividades },
    { data: tipos },
    { data: perfiles },
    { data: origenes },
  ] = await Promise.all([
    supabase.from("empresas").select("id, nombre, estado").order("nombre"),
    puedeVerOportunidades
      ? supabase
          .from("oportunidades")
          .select("id, titulo, monto, estado, etapa_id, empresa_id")
          .eq("contacto_id", id)
          .order("created_at", { ascending: false })
      : nada,
    puedeVerOportunidades ? supabase.from("etapas").select("id, nombre") : nada,
    puedeVerVentas
      ? supabase.from("ventas").select("id, fecha, comprobante").eq("contacto_id", id).order("fecha", { ascending: false })
      : nada,
    puedeVerActividades
      ? supabase.from("bitacora_entradas").select("*").eq("contacto_id", id).order("ocurrido_en", { ascending: false })
      : nada,
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
  ]);

  // La empresa del contacto puede ser de otra cartera: si la RLS no la muestra,
  // la actividad no se cuelga de ella (la base la rechazaría).
  const empresaVisible = (empresas ?? []).find((e) => e.id === contacto.empresa_id) ?? null;

  const idsVentas = (ventas ?? []).map((v) => v.id);
  const { data: items } = idsVentas.length
    ? await supabase.from("venta_items").select("venta_id, cantidad, precio_unitario").in("venta_id", idsVentas)
    : { data: [] };
  const totalPorVenta = new Map<string, number>();
  for (const it of items ?? []) {
    totalPorVenta.set(it.venta_id, (totalPorVenta.get(it.venta_id) ?? 0) + it.cantidad * Number(it.precio_unitario ?? 0));
  }

  return (
    <ContactoDetalle
      contacto={contacto}
      empresa={empresaVisible}
      empresas={empresas ?? []}
      oportunidades={oportunidades ?? []}
      etapas={etapas ?? []}
      ventas={(ventas ?? []).map((v) => ({ ...v, total: totalPorVenta.get(v.id) ?? 0 }))}
      actividades={actividades ?? []}
      tipos={tipos ?? []}
      perfiles={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }))}
      origenes={origenes ?? []}
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
