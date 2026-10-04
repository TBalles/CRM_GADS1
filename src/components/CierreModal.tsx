"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, CircleCheck, CircleX, Loader2, Repeat, RotateCcw } from "lucide-react";
import { Campo, CampoSelect, CampoTextarea, FormBanner } from "@/components/form";
import { Button, FieldLabel } from "@/components/ui/UIComponents";
import { useModalAnimation } from "@/components/ui/overlay";
import { backdropClose } from "@/components/ui/backdropClose";
import { useToast } from "@/components/ui/Toast";
import { cambiarEtapa } from "@/lib/cambiarEtapa";
import {
  etapasParaModo,
  hoyAR,
  mensajeErrorOportunidad,
  resultadoContrario,
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
};

/** Nombre e ícono de cada acción, para los menús y botones que abren el modal. */
export const ACCION_CAMBIO: Record<ModoCambio, { label: string; icon: React.ElementType }> = {
  etapa: { label: "Cambiar etapa", icon: ArrowRightLeft },
  ganada: { label: "Marcar ganada", icon: CircleCheck },
  perdida: { label: "Marcar perdida", icon: CircleX },
  reabrir: { label: "Reabrir", icon: RotateCcw },
  resultado: { label: "Cambiar resultado", icon: Repeat },
};

const COPY: Record<ModoCambio, { titulo: string; confirmar: string; bajada: string }> = {
  etapa: {
    titulo: "Cambiar de etapa",
    confirmar: "Mover",
    bajada: "Queda en el historial con tu usuario y la fecha.",
  },
  ganada: {
    titulo: "Marcar como ganada",
    confirmar: "Marcar ganada",
    bajada: "La oportunidad se cierra con la fecha que indiques. Cualquier cambio posterior queda auditado.",
  },
  perdida: {
    titulo: "Marcar como perdida",
    confirmar: "Marcar perdida",
    bajada: "Una oportunidad no se borra: se cierra con su motivo para aprender de la pérdida.",
  },
  reabrir: {
    titulo: "Reabrir oportunidad",
    confirmar: "Reabrir",
    bajada: "Vuelve al embudo y pierde su fecha de cierre. Contá por qué se reabre.",
  },
  resultado: {
    titulo: "Cambiar resultado",
    confirmar: "Cambiar resultado",
    bajada: "Pasa de ganada a perdida (o al revés) sin reabrirla, con su propia fecha de cierre. Queda en el historial y en la auditoría.",
  },
};

/**
 * Estado del modal de cambio de etapa. El payload (`target`) sobrevive al cierre
 * a proposito: si no, el titulo del modal cambiaria a mitad de la animacion de salida.
 */
export function useCierre() {
  const [target, setTarget] = useState<CierreTarget | null>(null);
  const [open, setOpen] = useState(false);
  return {
    abrir: (next: CierreTarget) => {
      setTarget(next);
      setOpen(true);
    },
    modalProps: { open, target, onClose: () => setOpen(false) },
  };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trampa de foco minima para el dialogo: al abrir, el foco va al primer campo; Tab y
 * Shift+Tab dan la vuelta adentro; al cerrar, el foco vuelve a quien lo tenia. Solo
 * mira el DOM del dialogo: los desplegables (Select) viven en un portal y manejan su
 * propio teclado.
 */
function useTrampaDeFoco(dialogo: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = dialogo.current?.querySelector<HTMLElement>("input, textarea, button[role=combobox]");
    (primero ?? dialogo.current)?.focus();
    return () => {
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [dialogo]);

  return function alTabular(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogo.current?.contains(e.target as Node)) return;
    const lista = [...dialogo.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!lista.length) {
      e.preventDefault();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === dialogo.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };
}

/**
 * Cambiar de etapa, cerrar (ganada / perdida), reabrir y cambiar el resultado de una
 * oportunidad, todo por la RPC `cambiar_etapa`. Las reglas las impone la base; el modal
 * pide lo que la base va a exigir (motivo al perder, fecha de cierre, razon al reabrir
 * o cambiar el resultado) y traduce sus errores.
 *
 * `onHecho` solo aplica los datos; el modal se cierra solo y unicamente si sigue siendo
 * el mismo (un pedido lento de otra oportunidad no cierra el modal de la que se abrio despues).
 */
export default function CierreModal({
  open,
  target,
  etapas,
  motivos,
  onClose,
  onHecho,
}: {
  open: boolean;
  target: CierreTarget | null;
  etapas: Etapa[];
  motivos: Motivo[];
  onClose: () => void;
  /** Recibe la fila ya guardada (la devuelve la RPC) y la observacion que se asento. */
  onHecho: (fila: Oportunidad, info: { modo: ModoCambio; observacion: string }) => void;
}) {
  const { visible, overlayClass, modalClass } = useModalAnimation(open);
  // Mientras se guarda, ni el fondo, ni Escape, ni Cancelar cierran: el modal no puede desaparecer a mitad del pedido.
  const [guardando, setGuardando] = useState(false);
  if (!visible || !target) return null;

  return createPortal(
    // z-50 como el Drawer: los desplegables (Select) salen en z-90 y tienen que quedar por encima.
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${overlayClass}`}
      {...backdropClose(() => {
        if (!guardando) onClose();
      })}
    >
      <Contenido
        key={`${target.modo}-${target.oportunidad.id}`}
        target={target}
        etapas={etapas}
        motivos={motivos}
        modalClass={modalClass}
        cerrando={!open}
        guardando={guardando}
        setGuardando={setGuardando}
        onClose={onClose}
        onHecho={onHecho}
      />
    </div>,
    document.body,
  );
}

function Contenido({
  target,
  etapas,
  motivos,
  modalClass,
  cerrando,
  guardando: saving,
  setGuardando: setSaving,
  onClose,
  onHecho,
}: {
  target: CierreTarget;
  etapas: Etapa[];
  motivos: Motivo[];
  modalClass: string;
  cerrando: boolean;
  guardando: boolean;
  setGuardando: (v: boolean) => void;
  onClose: () => void;
  onHecho: (fila: Oportunidad, info: { modo: ModoCambio; observacion: string }) => void;
}) {
  const { modo, oportunidad } = target;
  const copy = COPY[modo];
  const Icon = ACCION_CAMBIO[modo].icon;
  const tituloId = useId();
  const { showToast } = useToast();

  const destinos = etapasParaModo(etapas, modo, oportunidad.etapa_id, oportunidad.estado);
  const cierra = modo === "ganada" || modo === "perdida" || modo === "resultado";
  const destinoTipo = modo === "resultado" ? resultadoContrario(oportunidad.estado) : modo;
  const aPerdida = destinoTipo === "perdida";
  // Al mover, la siguiente en el embudo; al reabrir y al cerrar, la primera.
  const actual = etapas.find((e) => e.id === oportunidad.etapa_id);
  const siguiente = modo === "etapa" ? (destinos.find((e) => e.orden > (actual?.orden ?? 0)) ?? destinos[0]) : destinos[0];

  const [hoy] = useState(hoyAR);
  const [etapaId, setEtapaId] = useState(siguiente?.id ?? "");
  const [motivoId, setMotivoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [observacion, setObservacion] = useState("");
  const [errores, setErrores] = useState<Partial<Record<CampoCambio, string>>>({});
  const [error, setError] = useState<string | null>(null);

  // Sigue montado? Si el modal ya se cerro o se reemplazo por el de otra oportunidad, la
  // respuesta tardia aplica los datos pero no toca el modal que haya ahora.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const dialogoRef = useRef<HTMLDivElement>(null);
  const alTabular = useTrampaDeFoco(dialogoRef);

  const motivosActivos = motivos.filter((m) => m.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  function limpiar(campo: CampoCambio) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const nuevos = validarCambio({
      modo,
      etapaId,
      motivoId,
      fecha,
      observacion,
      hoy,
      destinoTipo,
      fechaActual: oportunidad.fecha_cierre,
    });
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
      if (montado.current) {
        setError(mensajeErrorOportunidad(dbError, "No se pudo completar el cambio. Revisá los datos e intentá de nuevo."));
      } else {
        showToast(mensajeErrorOportunidad(dbError, "No se pudo completar el cambio."), "error");
      }
      return;
    }

    const nombreEtapa = etapas.find((x) => x.id === etapaId)?.nombre ?? "la nueva etapa";
    showToast(
      modo === "ganada"
        ? `«${oportunidad.titulo}» quedó ganada.`
        : modo === "perdida"
          ? `«${oportunidad.titulo}» quedó perdida. El motivo queda registrado.`
          : modo === "resultado"
            ? `«${oportunidad.titulo}» ahora figura como ${aPerdida ? "perdida" : "ganada"}.`
            : modo === "reabrir"
              ? `«${oportunidad.titulo}» se reabrió en «${nombreEtapa}».`
              : `«${oportunidad.titulo}» pasó a «${nombreEtapa}».`,
      "success",
    );
    onHecho(row, { modo, observacion: observacion.trim() });
    if (montado.current) onClose();
  }

  // Escape cierra, salvo mientras se guarda, o si lo que se esta cerrando es un
  // desplegable (el Select vive en un portal y su Escape es solo suyo).
  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>) {
    alTabular(e);
    if (e.key !== "Escape" || saving) return;
    const destino = e.target as HTMLElement;
    if (!e.currentTarget.contains(destino) || destino.closest('[aria-expanded="true"]')) return;
    e.stopPropagation();
    onClose();
  }

  const etapaUnica = cierra && destinos.length === 1 ? destinos[0] : null;
  const etiquetaEtapa = modo === "reabrir" ? "Volver a la etapa" : cierra ? "Etapa de cierre" : "Nueva etapa";
  const pideRazon = modo === "reabrir" || modo === "resultado";

  return (
    <div
      ref={dialogoRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onKeyDown={alTeclear}
      inert={cerrando}
      className={`${modalClass} flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus-visible:outline-none`}
    >
      <form onSubmit={confirmar} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id={tituloId} className="text-base font-bold tracking-tight">
              {copy.titulo}
            </h2>
            <p className="truncate text-xs text-muted-foreground" title={oportunidad.titulo}>
              {oportunidad.titulo}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-muted-foreground">{copy.bajada}</p>

          {error && <FormBanner message={error} />}
          {!destinos.length && (
            <FormBanner
              message={
                cierra
                  ? `El embudo no tiene una etapa de tipo ${destinoTipo === "ganada" ? "Ganada" : "Perdida"}. Se configura en Configuración.`
                  : "El embudo no tiene otra etapa abierta a la que mover. Se configura en Configuración."
              }
            />
          )}

          {etapaUnica ? (
            <div role="group" aria-labelledby={`${tituloId}-etapa`}>
              <FieldLabel id={`${tituloId}-etapa`}>{etiquetaEtapa}</FieldLabel>
              <p className="flex h-10 items-center rounded-lg border border-input bg-secondary px-3 text-sm">{etapaUnica.nombre}</p>
            </div>
          ) : (
            <CampoSelect
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
            <CampoSelect
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
            <Campo
              id="fecha_cierre"
              label={modo === "resultado" ? "Fecha del nuevo cierre" : "Fecha de cierre"}
              required
              type="date"
              max={hoy}
              value={fecha}
              onChange={(v) => {
                setFecha(v);
                limpiar("fecha");
              }}
              error={errores.fecha}
            />
          )}

          <CampoTextarea
            id="cambio_observacion"
            label={modo === "reabrir" ? "Por qué se reabre" : modo === "resultado" ? "Por qué cambia el resultado" : "Observación"}
            required={pideRazon}
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
            onChange={(v) => {
              setObservacion(v);
              limpiar("observacion");
            }}
            error={errores.observacion}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !destinos.length} className="w-full gap-2 sm:w-auto sm:min-w-[140px]">
            {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {saving ? "Guardando…" : copy.confirmar}
          </Button>
        </div>
      </form>
    </div>
  );
}
