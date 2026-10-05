"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CircleCheck, CircleX, Repeat, RotateCcw } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { Dialog } from "@/components/crm/Dialog";
import { InlineBanner } from "@/components/crm/Feedback";
import { Field, Textarea } from "@/components/crm/Field";
import { useCrmToast } from "@/components/crm/Toast";
import { TYPE, cn } from "@/components/crm/cx";
import { CampoFecha, CampoOpciones } from "@/components/crm/cuenta/FormDrawer";
import { cambiarEtapa } from "@/lib/cambiarEtapa";
import { bloqueoGanada, type DatosApertura } from "@/lib/licitaciones";
import {
  COPY_CAMBIO,
  ETIQUETA_CAMBIO,
  etapaSugerida,
  etapasParaModo,
  hoyAR,
  mensajeErrorOportunidad,
  resultadoContrario,
  textoCambioHecho,
  validarCambio,
  type CampoCambio,
  type ModoCambio,
} from "@/lib/oportunidades";
import type { Tables } from "@/lib/supabase/types";

type Oportunidad = Tables<"oportunidades">;
type Etapa = Pick<Tables<"etapas">, "id" | "nombre" | "tipo" | "orden" | "color">;
type Motivo = Pick<Tables<"motivos_perdida">, "id" | "nombre" | "activo" | "orden">;

export type CierreTarget = {
  modo: ModoCambio;
  oportunidad: Pick<Oportunidad, "id" | "titulo" | "etapa_id" | "estado" | "fecha_cierre">;
  /**
   * Solo licitaciones (F4): su fecha de apertura. Mientras no abrió, "Marcar ganada" queda bloqueada con el mismo
   * mensaje de la base (trigger `oportunidades_licitacion_regla`). `undefined` = no es una licitación.
   */
  licitacion?: DatosApertura;
};

/** Nombre e ícono de cada acción, para los menús y botones que abren el diálogo. */
export const ACCION_CAMBIO: Record<ModoCambio, { label: string; icon: React.ElementType }> = {
  etapa: { label: ETIQUETA_CAMBIO.etapa, icon: ArrowRightLeft },
  ganada: { label: ETIQUETA_CAMBIO.ganada, icon: CircleCheck },
  perdida: { label: ETIQUETA_CAMBIO.perdida, icon: CircleX },
  reabrir: { label: ETIQUETA_CAMBIO.reabrir, icon: RotateCcw },
  resultado: { label: ETIQUETA_CAMBIO.resultado, icon: Repeat },
};

/** Las acciones del `⋮` que pueden sacar una fila de la lista o una tarjeta del tablero (foco después, `useFocoFilas`). */
export const ACCIONES_QUE_MUEVEN: ReadonlySet<string> = new Set(Object.values(ETIQUETA_CAMBIO));

/**
 * Estado del diálogo. El objetivo sobrevive al cierre (el título no cambia a mitad de la animación de salida) y `n`
 * cuenta las aperturas: como `key`, cada apertura arranca el formulario limpio.
 */
export function useCierre() {
  const [estado, setEstado] = useState<{ target: CierreTarget | null; open: boolean; n: number }>({ target: null, open: false, n: 0 });
  return {
    abrir: (target: CierreTarget) => setEstado((e) => ({ target, open: true, n: e.n + 1 })),
    dialogProps: { ...estado, onClose: () => setEstado((e) => ({ ...e, open: false })) },
  };
}

/**
 * Cambiar de etapa, cerrar (ganada / perdida), reabrir y cambiar el resultado de una oportunidad, todo por la RPC
 * `cambiar_etapa`, en un `Dialog` de CRM 2.0. Las reglas las impone la base; el diálogo pide lo que la base va a exigir
 * (motivo al perder, fecha de cierre, razón al reabrir o cambiar el resultado) y traduce sus errores. Mismos campos e
 * ids que antes (`#cambio_etapa`, `#motivo_perdida`, `#fecha_cierre`, `#cambio_observacion`) y el mismo nombre del
 * diálogo ("Cambiar de etapa", "Marcar como perdida"…, `role="dialog"`, contrato de E2E).
 *
 * `onHecho` recibe la fila guardada; el diálogo se cierra solo si sigue siendo el mismo (un pedido lento de otra
 * oportunidad no cierra el que se abrió después).
 */
export default function CierreDialog({
  open,
  target,
  n,
  etapas,
  motivos,
  onClose,
  onHecho,
}: {
  open: boolean;
  target: CierreTarget | null;
  n: number;
  etapas: Etapa[];
  motivos: Motivo[];
  onClose: () => void;
  /** Recibe la fila ya guardada (la devuelve la RPC) y la observación que se asentó. */
  onHecho: (fila: Oportunidad, info: { modo: ModoCambio; observacion: string }) => void;
}) {
  if (!target) return null;
  return <Contenido key={n} open={open} target={target} etapas={etapas} motivos={motivos} onClose={onClose} onHecho={onHecho} />;
}

function Contenido({
  open,
  target,
  etapas,
  motivos,
  onClose,
  onHecho,
}: {
  open: boolean;
  target: CierreTarget;
  etapas: Etapa[];
  motivos: Motivo[];
  onClose: () => void;
  onHecho: (fila: Oportunidad, info: { modo: ModoCambio; observacion: string }) => void;
}) {
  const { modo, oportunidad } = target;
  const copy = COPY_CAMBIO[modo];
  const { showToast } = useCrmToast();

  const destinos = etapasParaModo(etapas, modo, oportunidad.etapa_id, oportunidad.estado);
  const cierra = modo === "ganada" || modo === "perdida" || modo === "resultado";
  const destinoTipo = modo === "resultado" ? resultadoContrario(oportunidad.estado) : modo;
  const aPerdida = destinoTipo === "perdida";
  const actual = etapas.find((e) => e.id === oportunidad.etapa_id);

  const [hoy] = useState(hoyAR);
  // Una licitación no se gana antes de su apertura (ni cambiando el resultado de una perdida a ganada).
  const terminaEnGanada = modo === "ganada" || (modo === "resultado" && destinoTipo === "ganada");
  const bloqueoLicitacion = terminaEnGanada ? bloqueoGanada(target.licitacion, hoy) : null;
  const [etapaId, setEtapaId] = useState(() => etapaSugerida(destinos, modo, actual?.orden ?? 0)?.id ?? "");
  const [motivoId, setMotivoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [observacion, setObservacion] = useState("");
  const [errores, setErrores] = useState<Partial<Record<CampoCambio, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ¿Sigue montado? Si se reemplazó por el de otra oportunidad, la respuesta tardía aplica los datos pero no toca el
  // diálogo que haya ahora.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const motivosActivos = motivos.filter((m) => m.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  function limpiar(campo: CampoCambio) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (saving || bloqueoLicitacion || !destinos.length) return;
    const nuevos = validarCambio({ modo, etapaId, motivoId, fecha, observacion, hoy, destinoTipo, fechaActual: oportunidad.fecha_cierre });
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const { row, error: dbError } = await cambiarEtapa({
      oportunidadId: oportunidad.id,
      etapaId,
      observacion,
      motivoId: aPerdida && cierra ? motivoId : null,
      fechaCierre: cierra ? fecha : null,
    });
    setSaving(false);

    if (dbError || !row) {
      if (montado.current) setError(mensajeErrorOportunidad(dbError, "No se pudo completar el cambio. Revisá los datos e intentá de nuevo."));
      else showToast(mensajeErrorOportunidad(dbError, "No se pudo completar el cambio."), "error");
      return;
    }

    const nombreEtapa = etapas.find((x) => x.id === etapaId)?.nombre ?? "la nueva etapa";
    showToast(textoCambioHecho(modo, oportunidad.titulo, nombreEtapa, aPerdida), "success");
    onHecho(row, { modo, observacion: observacion.trim() });
    if (montado.current) onClose();
  }

  const etapaUnica = cierra && destinos.length === 1 ? destinos[0] : null;
  const etiquetaEtapa = modo === "reabrir" ? "Volver a la etapa" : cierra ? "Etapa de cierre" : "Nueva etapa";
  const pideRazon = modo === "reabrir" || modo === "resultado";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.titulo}
      description={oportunidad.titulo}
      busy={saving}
      onSubmit={confirmar}
      footer={
        <>
          <Button onClick={onClose} disabled={saving} className="max-sm:h-9">
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={!destinos.length || Boolean(bloqueoLicitacion)}
            className="max-sm:h-9 sm:min-w-32"
          >
            {saving ? "Guardando…" : copy.confirmar}
          </Button>
        </>
      }
    >
      <div className="mt-3 flex flex-col gap-4">
        <p className={cn(TYPE.ui, "text-(--crm-text-2)")}>{copy.bajada}</p>

        {error && <InlineBanner tone="danger">{error}</InlineBanner>}
        {bloqueoLicitacion && <InlineBanner tone="danger">{bloqueoLicitacion}</InlineBanner>}
        {!destinos.length && (
          <InlineBanner tone="danger">
            {cierra
              ? `El embudo no tiene una etapa de tipo ${destinoTipo === "ganada" ? "Ganada" : "Perdida"}. Se configura en Configuración.`
              : "El embudo no tiene otra etapa abierta a la que mover. Se configura en Configuración."}
          </InlineBanner>
        )}

        {etapaUnica ? (
          <div role="group" aria-labelledby="cambio-etapa-unica" className="flex flex-col gap-1">
            <span id="cambio-etapa-unica" className="text-[13px] font-medium leading-[18px]">
              {etiquetaEtapa}
            </span>
            <p className="flex h-8 items-center gap-1.5 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) px-3">
              {etapaUnica.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: etapaUnica.color }} />}
              {etapaUnica.nombre}
            </p>
          </div>
        ) : (
          <CampoOpciones
            id="cambio_etapa"
            label={etiquetaEtapa}
            required
            placeholder="Elegí la etapa"
            value={etapaId}
            onChange={(v) => {
              setEtapaId(v);
              limpiar("etapa");
            }}
            options={destinos.map((e) => ({ value: e.id, label: e.nombre, color: e.color }))}
            error={errores.etapa}
          />
        )}

        {cierra && aPerdida && (
          <CampoOpciones
            id="motivo_perdida"
            label="Motivo de pérdida"
            required
            placeholder={motivosActivos.length ? "¿Por qué se perdió?" : "No hay motivos cargados"}
            searchable={motivosActivos.length > 8}
            value={motivoId}
            onChange={(v) => {
              setMotivoId(v);
              limpiar("motivo");
            }}
            options={motivosActivos.map((m) => ({ value: m.id, label: m.nombre }))}
            error={errores.motivo}
          />
        )}

        {cierra && (
          <CampoFecha
            id="fecha_cierre"
            label={modo === "resultado" ? "Fecha del nuevo cierre" : "Fecha de cierre"}
            required
            max={hoy}
            value={fecha}
            onChange={(v) => {
              setFecha(v);
              limpiar("fecha");
            }}
            error={errores.fecha}
          />
        )}

        <Field id="cambio_observacion" label={modo === "reabrir" ? "Por qué se reabre" : modo === "resultado" ? "Por qué cambia el resultado" : "Observación"} required={pideRazon} error={errores.observacion}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={500}
              placeholder={
                modo === "perdida"
                  ? "Opcional: qué pasó, con quién se definió…"
                  : modo === "reabrir"
                    ? "El club retomó la compra, hay un nuevo presupuesto…"
                    : modo === "resultado"
                      ? "Se cayó la entrega, el club devolvió el pedido…"
                      : "Opcional: lo que se habló, lo que falta…"
              }
              value={observacion}
              onChange={(e) => {
                setObservacion(e.target.value);
                limpiar("observacion");
              }}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
