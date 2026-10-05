import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { EmptyState } from "@/components/crm/Feedback";
import { PageBar } from "@/components/crm/PageBar";
import { UI_ROOT, cn } from "@/components/crm/cx";
import { iaDisponible } from "@/lib/ia/config";
import ConfiguracionView from "./ConfiguracionView";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const sesion = await exigirPermiso("configuracion.gestionar");
  const orgId = sesion.perfil?.organizacion_id;

  // Sin organizacion (el superadmin de la plataforma) no hay nada que configurar
  // aca: sus clientes se manejan desde /admin.
  if (!orgId) {
    return (
      <SinDatos
        titulo="Tu usuario no pertenece a ninguna empresa"
        texto="La configuración es de cada empresa cliente. Los clientes se administran desde el panel de plataforma."
      />
    );
  }

  const supabase = await createClient();
  const [{ data: organizacion }, { data: etapas }, { data: tipos }, { data: origenes }, { data: motivos }] =
    await Promise.all([
      supabase.from("organizaciones").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("etapas").select("*").order("orden"),
      supabase.from("tipos_actividad").select("*").order("orden").order("nombre"),
      supabase.from("origenes").select("*").order("orden").order("nombre"),
      supabase.from("motivos_perdida").select("*").order("orden").order("nombre"),
    ]);

  if (!organizacion) {
    return (
      <SinDatos
        titulo="No se pudieron leer los datos de tu empresa"
        texto="Recargá la página. Si sigue pasando, avisale a quien administra la plataforma."
      />
    );
  }

  // El bucket `logos` es privado: la imagen se ve con una URL firmada que vence.
  // Se firma acá para que el logo ya venga en el primer render.
  let logoUrl: string | null = null;
  if (organizacion.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(organizacion.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <ConfiguracionView
      organizacion={organizacion}
      logoUrl={logoUrl}
      etapas={etapas ?? []}
      tipos={tipos ?? []}
      origenes={origenes ?? []}
      motivos={motivos ?? []}
      iaActiva={iaDisponible()}
    />
  );
}

/** Los dos casos sin configuración para mostrar (mismos textos que el legacy), con el h1 de la pantalla. */
function SinDatos({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar title="Configuración" />
      <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
        <EmptyState title={titulo} description={texto} />
      </div>
    </div>
  );
}
