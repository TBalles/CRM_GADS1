import { createClient } from "@/lib/supabase/server";
import { getRemitente } from "@/lib/contacto";
import { exigirPermiso } from "@/lib/sesion";
import { esErrorDeEsquema } from "@/lib/esquema";
import { iaDisponible } from "@/lib/ia/config";
import { abiertasPorItem, etapaInicialId, origenRecambioId } from "@/lib/recambio";
import { InlineBanner } from "@/components/crm/Feedback";
import AlertasView, { type DatosRecambio } from "./AlertasView";

export const metadata = { title: "Alertas" };

/** Tope de oportunidades de recambio abiertas que se consultan; las que queden afuera igual quedan protegidas por el indice unico de la 0011. */
const LIMITE_ABIERTAS = 1000;

/**
 * Las alertas no se guardan: se calculan. `alertas_vida_util` es una vista que
 * cruza los equipos entregados con su vida util y devuelve los que vencieron o
 * vencen dentro de 60 dias, siempre con los datos de hoy y sin ningun job
 * corriendo de fondo.
 */
export default async function AlertasPage() {
  const sesion = await exigirPermiso("alertas.ver");
  const supabase = await createClient();
  const { data: alertas } = await supabase
    .from("alertas_vida_util")
    .select("*")
    // Lo mas urgente primero: lo que hace mas tiempo que vencio.
    .order("dias_restantes", { ascending: true });

  // Recambio en 1 clic (F4): crear la oportunidad exige oportunidades.editar. Si a la base le falta la
  // columna `oportunidades.venta_item_id` (migracion 0011 sin aplicar) la funcion se esconde, no se rompe.
  let recambio: DatosRecambio | null = null;
  let faltaMigracion = false;
  let errorRecambio = false;
  if (sesion.puede("oportunidades.editar")) {
    // Todas las oportunidades de recambio ABIERTAS (sin pasar listas de ids por la URL): son pocas por definicion.
    const [abiertas, etapas, origenes] = await Promise.all([
      supabase
        .from("oportunidades")
        .select("id, venta_item_id, estado")
        .eq("estado", "abierta")
        .not("venta_item_id", "is", null)
        .limit(LIMITE_ABIERTAS),
      supabase.from("etapas").select("id, tipo, orden"),
      supabase.from("origenes").select("id, nombre, activo"),
    ]);
    faltaMigracion = esErrorDeEsquema(abiertas.error);
    const fallo = [abiertas.error, etapas.error, origenes.error].find((e) => e && !esErrorDeEsquema(e));
    if (fallo) {
      // Un error de verdad (no "falta la migracion"): se registra en el log del servidor y se avisa en pantalla.
      console.error("[alertas] no se pudieron leer los datos del recambio:", fallo.message);
      errorRecambio = true;
    } else if (!abiertas.error) {
      recambio = {
        etapaId: etapaInicialId(etapas.data ?? []),
        origenId: origenRecambioId(origenes.data ?? []),
        yoId: sesion.user.id,
        abiertas: Object.fromEntries(abiertasPorItem(abiertas.data ?? [])),
      };
    }
  }

  // Solo viaja el booleano al cliente, nunca las credenciales.
  return (
    <AlertasView
      alertas={alertas ?? []}
      enviaDesdeServidor={getRemitente() !== null}
      puedeEnviar={sesion.puede("alertas.enviar")}
      recambio={recambio}
      iaDisponible={iaDisponible()}
      avisos={
        <>
          {/* El aviso de `AvisoMigracion` (mismo texto y rol), con el banner de CRM 2.0. */}
          {faltaMigracion && sesion.puede("configuracion.gestionar") && (
            <InlineBanner tone="info" title="Se activa al aplicar la migración 0011.">
              Hasta entonces el botón «Crear oportunidad de recambio» no aparece. Los pasos están en la guía de despliegue.
            </InlineBanner>
          )}
          {errorRecambio && (
            <InlineBanner tone="warning" title="No pudimos consultar las oportunidades de recambio.">
              Por ahora el botón «Crear oportunidad de recambio» no está disponible; recargá la página para reintentar.
            </InlineBanner>
          )}
        </>
      }
    />
  );
}
