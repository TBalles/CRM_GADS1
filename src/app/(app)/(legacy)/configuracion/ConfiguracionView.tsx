"use client";

import { useRef, useState } from "react";
import { Building2, Flag, ListChecks, MapPinned, Route } from "lucide-react";
import { PageHeader, cn } from "@/components/ui/UIComponents";
import DatosEmpresa from "./DatosEmpresa";
import EtapasTab from "./EtapasTab";
import CatalogoTab from "./CatalogoTab";
import type { Tables } from "@/lib/supabase/types";

type Tab = "empresa" | "etapas" | "tipos" | "origenes" | "motivos";

const TABS: { id: Tab; etiqueta: string; icon: React.ElementType }[] = [
  { id: "empresa", etiqueta: "Datos de la empresa", icon: Building2 },
  { id: "etapas", etiqueta: "Etapas", icon: Route },
  { id: "tipos", etiqueta: "Tipos de actividad", icon: ListChecks },
  { id: "origenes", etiqueta: "Orígenes", icon: MapPinned },
  { id: "motivos", etiqueta: "Motivos de pérdida", icon: Flag },
];

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
  const [tab, setTab] = useState<Tab>("empresa");
  const botones = useRef<Record<string, HTMLButtonElement | null>>({});

  // Patron de pestañas del APG: flechas, Inicio y Fin mueven el foco y la
  // seleccion; solo la pestaña activa entra en el orden de Tab.
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const ultimo = TABS.length - 1;
    const destino =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (destino == null) return;
    e.preventDefault();
    setTab(TABS[destino].id);
    botones.current[TABS[destino].id]?.focus();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        titulo="Configuración"
        eyebrow="Puesta a punto"
        meta={`${organizacion.razon_social ?? organizacion.nombre} · IA: ${iaActiva ? "activa" : "desactivada"}`}
        bajada="Los datos que salen en tus presupuestos y las listas que ordenan el embudo: etapas, tipos de actividad, orígenes y motivos de pérdida."
      />

      {/* En un teléfono las cinco pestañas no entran en una fila: se desplazan. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="tablist"
          aria-label="Secciones de la configuración"
          className="flex w-max min-w-full gap-1 border-b sm:w-full"
        >
          {TABS.map(({ id, etiqueta, icon: Icon }, i) => {
            const activa = tab === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  botones.current[id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={activa}
                aria-controls={`panel-${id}`}
                tabIndex={activa ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activa
                    ? "border-brand font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className={cn("h-4 w-4", activa && "text-brand")} />
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      {/* Todos los paneles quedan montados y solo se esconde el inactivo: asi lo
          que quedó a medio escribir en "Datos de la empresa" no se pierde al
          mirar otra pestaña. */}
      {TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          hidden={tab !== id}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {id === "empresa" && <DatosEmpresa organizacion={organizacion} logoUrl={logoUrl} />}
          {id === "etapas" && <EtapasTab etapas={etapas} />}
          {id === "tipos" && (
            <CatalogoTab
              tabla="tipos_actividad"
              items={tipos}
              singular="tipo de actividad"
              plural="tipos de actividad"
              bajada="Lo que elegís al anotar una actividad en un cliente: llamada, reunión, visita a cancha…"
            />
          )}
          {id === "origenes" && (
            <CatalogoTab
              tabla="origenes"
              items={origenes}
              singular="origen"
              plural="orígenes"
              bajada="De dónde llegó la consulta: un referido, una licitación, las redes. Sirve para saber qué canal te trae clientes."
            />
          )}
          {id === "motivos" && (
            <CatalogoTab
              tabla="motivos_perdida"
              items={motivos}
              singular="motivo de pérdida"
              plural="motivos de pérdida"
              bajada="Por qué se cayó una oportunidad. Es obligatorio elegir uno al marcarla como perdida."
            />
          )}
        </div>
      ))}
    </div>
  );
}
