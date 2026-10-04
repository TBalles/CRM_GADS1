import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { hoyAR } from "@/lib/oportunidades";
import PresupuestoView from "./PresupuestoView";

export const metadata = { title: "Presupuesto" };

/** La URL firmada del logo (el bucket es privado) dura 1 h; la pantalla la renueva sola (focus, 50 min y antes de imprimir). */
const VIGENCIA_LOGO = 60 * 60;

export default async function PresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso("oportunidades.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  // Un id que no existe y uno que la RLS esconde (la cartera de otra persona) son lo mismo: no hay presupuesto.
  const { data: oportunidad } = await supabase.from("oportunidades").select("*").eq("id", id).maybeSingle();
  if (!oportunidad) notFound();

  const orgId = sesion.perfil?.organizacion_id;
  if (!orgId) notFound();

  const nada = Promise.resolve({ data: null, error: null });
  const puedeRegistrarActividad = sesion.puede("bitacora.escribir") && sesion.puede("bitacora.ver");

  const [orgRes, empresaRes, contactoRes, productosRes, previosRes, tiposRes] = await Promise.all([
    supabase.from("organizaciones").select("*").eq("id", orgId).maybeSingle(),
    oportunidad.empresa_id
      ? supabase.from("empresas").select("id, nombre, cuit, direccion, telefono, email").eq("id", oportunidad.empresa_id).maybeSingle()
      : nada,
    oportunidad.contacto_id
      ? supabase.from("contactos").select("id, nombre, apellido, cargo, email, telefono").eq("id", oportunidad.contacto_id).maybeSingle()
      : nada,
    supabase.from("productos").select("id, nombre, precio").eq("activo", true).order("nombre").limit(500),
    // F6: la tabla es de la migracion 0012. Si todavia no esta aplicada, el presupuesto se arma e imprime como borrador.
    supabase.from("presupuestos").select("*").eq("oportunidad_id", id).order("numero", { ascending: false }),
    puedeRegistrarActividad ? supabase.from("tipos_actividad").select("id, nombre, codigo, activo") : nada,
  ]);

  const organizacion = orgRes.data;
  if (!organizacion) throw new Error("No se pudieron leer los datos de tu empresa.");

  const presupuestosActivos = !esErrorDeEsquema(previosRes.error);
  if (previosRes.error && presupuestosActivos) {
    throw new Error(`No se pudieron leer los presupuestos: ${previosRes.error.message}`);
  }

  // El bucket `logos` es privado: se firma una URL que vence (igual que en /configuracion).
  let logoUrl: string | null = null;
  if (organizacion.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(organizacion.logo_path, VIGENCIA_LOGO);
    logoUrl = data?.signedUrl ?? null;
  }

  // El tipo "Envio de propuesta": por su codigo (no cambia si renombran el tipo) y, si no, por su nombre.
  const tipos = (tiposRes.data ?? []) as { id: string; nombre: string; codigo: string | null; activo: boolean }[];
  const tipoPropuesta = tipos.find((t) => t.activo && (t.codigo === "propuesta" || t.nombre === "Envío de propuesta"));

  return (
    <PresupuestoView
      oportunidad={{
        id: oportunidad.id,
        titulo: oportunidad.titulo,
        empresa_id: oportunidad.empresa_id,
        contacto_id: oportunidad.contacto_id,
        producto_id: oportunidad.producto_id,
        monto: oportunidad.monto == null ? null : Number(oportunidad.monto),
      }}
      organizacion={{
        nombre: organizacion.nombre,
        razon_social: organizacion.razon_social,
        cuit: organizacion.cuit,
        condicion_iva: organizacion.condicion_iva,
        direccion: organizacion.direccion,
        telefono: organizacion.telefono,
        email: organizacion.email,
        sitio_web: organizacion.sitio_web,
        presupuesto_validez_dias: organizacion.presupuesto_validez_dias,
        presupuesto_condiciones: organizacion.presupuesto_condiciones,
      }}
      logoUrl={logoUrl}
      logoPath={organizacion.logo_path}
      empresa={empresaRes.data ?? null}
      contacto={contactoRes.data ?? null}
      productos={(productosRes.data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio == null ? null : Number(p.precio) }))}
      previos={previosRes.data ?? []}
      presupuestosActivos={presupuestosActivos}
      tipoPropuestaId={tipoPropuesta?.id ?? null}
      hoy={hoyAR()}
      puedeGuardar={sesion.puede("oportunidades.editar")}
      puedeConfigurar={sesion.puede("configuracion.gestionar")}
    />
  );
}
