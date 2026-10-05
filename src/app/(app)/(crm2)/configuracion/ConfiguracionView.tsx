"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageBar } from "@/components/crm/PageBar";
import { TabPanel, Tabs } from "@/components/crm/Tabs";
import { UI_ROOT, cn } from "@/components/crm/cx";
import type { Tables } from "@/lib/supabase/types";
import CatalogoTab from "./CatalogoTab";
import DatosEmpresa from "./DatosEmpresa";
import EtapasTab from "./EtapasTab";
import { SECCIONES, hrefSeccion, seccionDe } from "./logica";

const TABS_ID = "configuracion";

/**
 * Configuración (CRM 2.0, Lote F): PageBar + sub-navegación por URL (`?s=empresa|etapas|tipos|origenes|motivos`; sin
 * parámetro, "Datos de la empresa", como abría el legacy) + la sección, sin cajas.
 *
 * - Desde 1024 px la sub-navegación es una columna a la izquierda del área de trabajo; debajo, la fila de tabs con
 *   scroll de siempre (un solo markup: `Tabs vertical`). Mismo tablist "Secciones de la configuración" y tabs por nombre.
 * - Cambiar de sección NO va al servidor: la página ya trae todo, así que el link se resuelve con `history.pushState`
 *   (Next lo integra a su router: `useSearchParams` se entera y atrás/adelante funcionan). Ctrl/Cmd+clic abre otra
 *   pestaña como cualquier link.
 * - Todas las secciones quedan montadas y solo se esconde la inactiva (como antes): lo que quedó a medio escribir en
 *   "Datos de la empresa" no se pierde al mirar otra sección; mientras haya cambios sin guardar, su tab lleva un punto.
 */
export default function ConfiguracionView({
  organizacion,
  logoUrl,
  etapas,
  tipos,
  origenes,
  motivos,
  iaActiva,
}: {
  organizacion: Tables<"organizaciones">;
  logoUrl: string | null;
  etapas: Tables<"etapas">[];
  tipos: Tables<"tipos_actividad">[];
  origenes: Tables<"origenes">[];
  motivos: Tables<"motivos_perdida">[];
  /** F7: solo lectura. La IA se activa o apaga con la variable ANTHROPIC_API_KEY del servidor, no desde acá. */
  iaActiva: boolean;
}) {
  const seccion = seccionDe(useSearchParams().get("s"));
  const [datosSucios, setDatosSucios] = useState(false);

  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar
        title="Configuración"
        count={
          <>
            {organizacion.razon_social ?? organizacion.nombre} ·{" "}
            <span className="whitespace-nowrap">IA: {iaActiva ? "activa" : "desactivada"}</span>
          </>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <Tabs
          id={TABS_ID}
          label="Secciones de la configuración"
          vertical
          value={seccion}
          navigate={(href) => window.history.pushState(null, "", href)}
          prefetch={false}
          items={SECCIONES.map((s) => ({
            value: s.value,
            label: s.label,
            href: hrefSeccion(s.value),
            dot: s.value === "empresa" && datosSucios,
            dotLabel: "cambios sin guardar",
          }))}
          className="shrink-0 lg:sticky lg:top-3 lg:w-52"
        />

        <TabPanel tabsId={TABS_ID} value={seccion} className="min-w-0 flex-1">
          <div hidden={seccion !== "empresa"}>
            <DatosEmpresa organizacion={organizacion} logoUrl={logoUrl} onCambios={setDatosSucios} />
          </div>
          <div hidden={seccion !== "etapas"}>
            <EtapasTab etapas={etapas} />
          </div>
          <div hidden={seccion !== "tipos"}>
            <CatalogoTab
              tabla="tipos_actividad"
              items={tipos}
              titulo="Tipos de actividad"
              singular="tipo de actividad"
              plural="tipos de actividad"
              bajada="Lo que elegís al anotar una actividad en un cliente: llamada, reunión, visita a cancha…"
            />
          </div>
          <div hidden={seccion !== "origenes"}>
            <CatalogoTab
              tabla="origenes"
              items={origenes}
              titulo="Orígenes"
              singular="origen"
              plural="orígenes"
              bajada="De dónde llegó la consulta: un referido, una licitación, las redes. Sirve para saber qué canal te trae clientes."
            />
          </div>
          <div hidden={seccion !== "motivos"}>
            <CatalogoTab
              tabla="motivos_perdida"
              items={motivos}
              titulo="Motivos de pérdida"
              singular="motivo de pérdida"
              plural="motivos de pérdida"
              bajada="Por qué se cayó una oportunidad. Es obligatorio elegir uno al marcarla como perdida."
            />
          </div>
        </TabPanel>
      </div>
    </div>
  );
}
