"use client";

import * as React from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { offsetAfterDigits } from "@/lib/money";
import { CrmPortal } from "./portal";
import { focusables, useAnchor, useLayer } from "./overlay";
import { Button, IconButton } from "./Button";
import { FieldError } from "./Field";
import { DISABLED, FIELD, FLOATING, FOCUS, UI_ROOT, cn } from "./cx";
import * as F from "./fecha";

export type DatePickerProps = {
  /** Va en el campo de texto visible: el `<label htmlFor>` de `Field` y los selectores de E2E (`#ocurrido_en`) lo usan. */
  id: string;
  /** "YYYY-MM-DD" (o "YYYY-MM-DDTHH:mm" con `time`, hora local); "" = vacío. Mismo contrato que el input nativo. */
  value: string;
  /** Recibe siempre un valor válido dentro de [min, max] o "" (un texto que no es una fecha deja el valor vacío). */
  onChange: (value: string) => void;
  /** Fecha y hora (24 h), como `datetime-local`. */
  time?: boolean;
  /** Límites por DÍA ("YYYY-MM-DD"; si traen hora, se ignora: la hora contra el límite la valida quien llama). */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  /** Si se pasa, un `<input type="hidden">` lleva el valor ISO (formularios con FormData). */
  name?: string;
  placeholder?: string;
  /** "Limpiar" en el calendario. Por defecto, si el campo no es obligatorio. */
  clearable?: boolean;
  /**
   * El error de validación de quien llama. Se pasa ACÁ y no a `Field`: el picker muestra un solo mensaje (el suyo de
   * formato —"El 31/02/2026 no existe."— o este) y lo ata con `aria-describedby`.
   */
  error?: string;
  /** 28 de alto (toolbars). */
  dense?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type Cierre = "input" | "boton" | null;

/**
 * Selector de fecha (y de fecha y hora) de CRM 2.0 (MASTER.md §10.15). Reemplaza a `type="date"` y `datetime-local`.
 *
 * - Campo de texto con máscara dd/mm/aaaa (+ hh:mm): se tipea, y se confirma al salir o con Enter.
 * - Botón "Abrir calendario" (o Alt+↓): calendario no modal en `#crm-portal` (`role="dialog"` + `role="grid"`, teclado del
 *   patrón APG). Escape lo cierra solo a él (pila de `useLayer`) y devuelve el foco al campo; dentro de un Drawer, la
 *   cerca de foco lo deja pasar porque es una capa posterior.
 */
export function DatePicker({
  id,
  value,
  onChange,
  time = false,
  min,
  max,
  required,
  disabled,
  name,
  placeholder,
  clearable = !required,
  error,
  dense,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DatePickerProps) {
  // Texto del campo y error de formato, atados al último valor visto: si el valor cambia desde afuera, se rehacen.
  const [sync, setSync] = React.useState({ value, texto: F.formatear(value, time), error: null as string | null });
  if (sync.value !== value) setSync({ value, texto: F.formatear(value, time), error: null });

  const [abierto, setAbierto] = React.useState(false);
  const [modo, setModo] = React.useState<"dias" | "meses">("dias");
  const [foco, setFoco] = React.useState("");
  // "Hoy" se calcula al abrir (en el navegador): el servidor nunca dibuja el calendario, así que no hay diferencia de hidratación.
  const [hoy, setHoy] = React.useState("");
  const [hh, setHh] = React.useState("00");
  const [mm, setMm] = React.useState("00");

  const caja = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const boton = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const cursor = React.useRef<number | null>(null);
  const enfocarDia = React.useRef(false);
  const panelId = React.useId();
  const pos = useAnchor(caja, panel, abierto);

  const formato = time ? "dd/mm/aaaa hh:mm" : "dd/mm/aaaa";
  const mensaje = sync.error ?? error;
  const errorId = `${id}-fecha`;
  const seleccionado = F.soloFecha(value);

  React.useLayoutEffect(() => {
    const c = cursor.current;
    cursor.current = null;
    if (c != null && input.current && document.activeElement === input.current) input.current.setSelectionRange(c, c);
  }, [sync.texto]);

  React.useEffect(() => {
    if (!abierto || !enfocarDia.current) return;
    enfocarDia.current = false;
    panel.current?.querySelector<HTMLElement>(`[data-dia="${foco}"]`)?.focus();
  }, [abierto, foco, modo]);

  const emitir = (v: string) => {
    setSync({ value: v, texto: F.formatear(v, time), error: null });
    if (v !== value) onChange(v);
  };

  /** Confirma lo tipeado. Devuelve el valor que queda (inválido → ""). */
  const confirmar = (): string => {
    // Sin cambios no se re-valida: un valor que llega de afuera fuera de rango no se borra solo por pasar el foco.
    if (!sync.error && sync.texto === F.formatear(value, time)) return value;
    const r = F.interpretar(sync.texto, time, min, max);
    if ("valor" in r) {
      emitir(r.valor);
      return r.valor;
    }
    setSync({ value: "", texto: sync.texto, error: r.error });
    if (value !== "") onChange("");
    return "";
  };

  const cerrar = (devolver: Cierre) => {
    setAbierto(false);
    if (devolver === "input") input.current?.focus();
    if (devolver === "boton") boton.current?.focus();
  };
  useLayer(abierto, (motivo) => cerrar(motivo === "escape" ? "input" : null), [caja, panel]);

  const abrir = (actual: string) => {
    const h = F.hoyIso();
    const ahora = new Date();
    const hora = F.horaDe(actual) ?? { h: ahora.getHours(), min: ahora.getMinutes() };
    setHoy(h);
    setFoco(F.soloFecha(actual) || F.acotar(h, min, max));
    setModo("dias");
    setHh(F.dosCifras(hora.h));
    setMm(F.dosCifras(hora.min));
    enfocarDia.current = true;
    setAbierto(true);
  };

  const horaActual = () => ({ h: F.acotarNumero(hh, 23, 0), min: F.acotarNumero(mm, 59, 0) });

  const elegir = (dia: string) => {
    if (!F.enRango(dia, min, max)) return;
    const { h, min: mi } = horaActual();
    emitir(time ? F.unirFechaHora(dia, h, mi) : dia);
    setFoco(dia);
    if (!time) cerrar("input");
  };

  const fijarHora = (h: number, mi: number) => {
    setHh(F.dosCifras(h));
    setMm(F.dosCifras(mi));
    if (seleccionado) emitir(F.unirFechaHora(seleccionado, h, mi));
  };

  const onTexto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const crudo = e.target.value;
    const caret = e.target.selectionStart ?? crudo.length;
    const texto = F.enmascarar(crudo, time, crudo.length > sync.texto.length);
    const digitos = crudo.slice(0, caret).replace(/\D/g, "").length;
    cursor.current = caret >= crudo.length ? texto.length : offsetAfterDigits(texto, digitos);
    setSync((s) => ({ ...s, texto, error: null }));
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      abrir(confirmar());
    } else if (e.key === "Enter" && (sync.texto !== F.formatear(value, time) || sync.error)) {
      // Con texto sin confirmar, Enter confirma (no envía el formulario con el valor viejo); el siguiente Enter, sí.
      e.preventDefault();
      confirmar();
    }
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const saltos: Record<string, () => string> = {
      ArrowLeft: () => F.sumarDias(foco, -1),
      ArrowRight: () => F.sumarDias(foco, 1),
      ArrowUp: () => F.sumarDias(foco, -7),
      ArrowDown: () => F.sumarDias(foco, 7),
      Home: () => F.inicioSemana(foco),
      End: () => F.finSemana(foco),
      PageUp: () => F.sumarMeses(foco, e.shiftKey ? -12 : -1),
      PageDown: () => F.sumarMeses(foco, e.shiftKey ? 12 : 1),
    };
    const salto = saltos[e.key];
    if (!salto) return;
    e.preventDefault();
    enfocarDia.current = true;
    setFoco(salto());
  };

  // Tab al salir del último (o Shift+Tab desde el primero) cierra y deja el foco en el botón del calendario, como Popover.
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const lista = focusables(panel.current);
    const activo = document.activeElement;
    if (e.shiftKey && activo === lista[0]) {
      e.preventDefault();
      cerrar("boton");
    } else if (!e.shiftKey && activo === lista[lista.length - 1]) {
      cerrar("boton");
    }
  };

  const campoHora = (parte: "h" | "min") => {
    const tope = parte === "h" ? 23 : 59;
    const texto = parte === "h" ? hh : mm;
    const setTexto = parte === "h" ? setHh : setMm;
    const actual = horaActual();
    const fijar = (n: number) => (parte === "h" ? fijarHora(n, actual.min) : fijarHora(actual.h, n));
    return (
      <input
        aria-label={parte === "h" ? "Hora" : "Minutos"}
        role="spinbutton"
        aria-valuemin={0}
        aria-valuemax={tope}
        aria-valuenow={actual[parte]}
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        value={texto}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 2);
          setTexto(t);
          if (t.length === 2) fijar(F.acotarNumero(t, tope, actual[parte]));
        }}
        onBlur={() => fijar(F.acotarNumero(texto, tope, actual[parte]))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            fijar(F.pasoCircular(actual[parte], e.key === "ArrowUp" ? 1 : -1, tope));
          } else if (e.key === "Enter") {
            e.preventDefault();
            fijar(F.acotarNumero(texto, tope, actual[parte]));
            cerrar("input");
          }
        }}
        className={cn(FIELD, "h-7 w-11 px-0 text-center tabular-nums pointer-coarse:h-9")}
      />
    );
  };

  const titulo = modo === "dias" ? F.tituloMes(foco) : foco.slice(0, 4);
  const hoyValido = hoy !== "" && F.enRango(hoy, min, max);
  const anio = Number(foco.slice(0, 4));

  return (
    <>
      <div ref={caja} className={cn("relative flex w-full min-w-0", className)}>
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={sync.texto}
          placeholder={placeholder ?? formato}
          disabled={disabled}
          required={required}
          aria-invalid={mensaje || ariaInvalid ? true : undefined}
          aria-describedby={[mensaje ? `${errorId}-error` : null, ariaDescribedBy].filter(Boolean).join(" ") || undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onChange={onTexto}
          onBlur={() => confirmar()}
          onKeyDown={onInputKey}
          className={cn(FIELD, dense ? "h-7 pr-8" : "h-8 pr-9", "tabular-nums", abierto && "border-(--crm-accent)")}
        />
        <button
          ref={boton}
          type="button"
          aria-label="Abrir calendario"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls={abierto ? panelId : undefined}
          disabled={disabled}
          onClick={() => (abierto ? cerrar(null) : abrir(confirmar()))}
          className={cn(
            "absolute right-0.5 top-1/2 grid -translate-y-1/2 cursor-pointer place-items-center rounded-(--crm-radius-sm) text-(--crm-text-2)",
            "transition-colors duration-(--crm-dur-fast) hover:bg-(--crm-hover) hover:text-(--crm-text) motion-reduce:transition-none",
            dense ? "size-6" : "size-7",
            FOCUS,
            DISABLED,
          )}
        >
          <CalendarDays aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      <FieldError id={errorId} error={mensaje} />

      {abierto && (
        <CrmPortal>
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={time ? "Elegir fecha y hora" : "Elegir fecha"}
            onKeyDown={onPanelKey}
            style={{ position: "fixed", ...pos }}
            className={cn(
              UI_ROOT,
              FLOATING,
              "z-(--crm-z-popover) w-70 p-3 tabular-nums outline-none",
              // Celular: hoja fija abajo, a lo ancho (la posición anclada de useAnchor queda pisada).
              "max-sm:top-auto! max-sm:right-2! max-sm:bottom-2! max-sm:left-2! max-sm:w-auto",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <IconButton
                size="sm"
                className="pointer-coarse:size-9"
                icon={ChevronLeft}
                label={modo === "dias" ? "Mes anterior" : "Año anterior"}
                onClick={() => setFoco(F.sumarMeses(foco, modo === "dias" ? -1 : -12))}
              />
              <button
                type="button"
                aria-label={modo === "dias" ? `${titulo}. Elegir mes y año` : `${titulo}. Volver a los días`}
                onClick={() => setModo(modo === "dias" ? "meses" : "dias")}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-(--crm-radius-sm) px-2 text-[14px] font-semibold pointer-coarse:h-9",
                  "transition-colors duration-(--crm-dur-fast) hover:bg-(--crm-hover) motion-reduce:transition-none",
                  FOCUS,
                )}
              >
                {titulo}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn("size-3.5 text-(--crm-text-2) transition-transform duration-(--crm-dur-fast) motion-reduce:transition-none", modo === "meses" && "rotate-180")}
                />
              </button>
              <IconButton
                size="sm"
                className="pointer-coarse:size-9"
                icon={ChevronRight}
                label={modo === "dias" ? "Mes siguiente" : "Año siguiente"}
                onClick={() => setFoco(F.sumarMeses(foco, modo === "dias" ? 1 : 12))}
              />
              {/* Anuncia el mes (o el año) al cambiarlo con los botones o con RePág/AvPág (patrón APG). */}
              <span aria-live="polite" className="sr-only">
                {titulo}
              </span>
            </div>

            {modo === "dias" ? (
              <div role="grid" aria-label={titulo} onKeyDown={onGridKey} className="flex flex-col">
                <div role="row" className="grid grid-cols-7 justify-items-center">
                  {F.DIAS_CORTOS.map((d, i) => (
                    <span key={d} role="columnheader" aria-label={F.DIAS[i]} className="grid h-7 w-8 place-items-center text-[12px] font-medium text-(--crm-text-2)">
                      {d}
                    </span>
                  ))}
                </div>
                {F.grillaMes(foco).map((semana) => (
                  <div key={semana[0]} role="row" className="grid grid-cols-7 justify-items-center">
                    {semana.map((dia) => {
                      const fuera = !F.enRango(dia, min, max);
                      const elegido = dia === seleccionado;
                      return (
                        <button
                          key={dia}
                          type="button"
                          role="gridcell"
                          data-dia={dia}
                          tabIndex={dia === foco ? 0 : -1}
                          aria-selected={elegido}
                          aria-current={dia === hoy ? "date" : undefined}
                          aria-disabled={fuera || undefined}
                          aria-label={F.textoLargo(dia)}
                          onClick={() => elegir(dia)}
                          className={cn(
                            "grid size-8 cursor-pointer place-items-center rounded-(--crm-radius-sm) text-[13px] pointer-coarse:size-9",
                            "transition-colors duration-(--crm-dur-fast) motion-reduce:transition-none",
                            FOCUS,
                            dia.slice(0, 7) === foco.slice(0, 7) ? "text-(--crm-text)" : "text-(--crm-text-2)",
                            dia === hoy && "font-semibold ring-1 ring-(--crm-border-strong) ring-inset",
                            elegido
                              ? "bg-(--crm-accent) font-semibold text-(--crm-on-accent) ring-0 hover:bg-(--crm-accent-hover)"
                              : "hover:bg-(--crm-hover)",
                            "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-transparent",
                          )}
                        >
                          {Number(dia.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div role="group" aria-label={`Meses de ${anio}`} className="grid grid-cols-3 gap-1">
                {F.MESES_CORTOS.map((corto, i) => {
                  const m = i + 1;
                  const elegido = seleccionado.slice(0, 7) === `${anio}-${F.dosCifras(m)}`;
                  return (
                    <button
                      key={corto}
                      type="button"
                      aria-label={`${F.MESES[i]} de ${anio}`}
                      aria-pressed={elegido}
                      aria-disabled={!F.mesEnRango(anio, m, min, max) || undefined}
                      onClick={() => {
                        if (!F.mesEnRango(anio, m, min, max)) return;
                        const d = Math.min(Number(foco.slice(8)), F.diasDelMes(anio, m));
                        enfocarDia.current = true;
                        setFoco(F.acotar(`${anio}-${F.dosCifras(m)}-${F.dosCifras(d)}`, min, max));
                        setModo("dias");
                      }}
                      className={cn(
                        "h-9 cursor-pointer rounded-(--crm-radius-sm) text-[13px] pointer-coarse:h-11 transition-colors duration-(--crm-dur-fast) motion-reduce:transition-none",
                        FOCUS,
                        elegido ? "bg-(--crm-accent) font-semibold text-(--crm-on-accent) hover:bg-(--crm-accent-hover)" : "hover:bg-(--crm-hover)",
                        Number(foco.slice(5, 7)) === m && !elegido && "ring-1 ring-(--crm-border-strong) ring-inset",
                        "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-transparent",
                      )}
                    >
                      {corto}
                    </button>
                  );
                })}
              </div>
            )}

            {time && (
              <div role="group" aria-label="Hora" className="mt-2 flex items-center gap-1.5 border-t border-(--crm-border) pt-2">
                <span aria-hidden="true" className="mr-auto text-[13px] text-(--crm-text-2)">
                  Hora
                </span>
                {campoHora("h")}
                <span aria-hidden="true" className="text-(--crm-text-2)">
                  :
                </span>
                {campoHora("min")}
                <Button
                  size="sm"
                  variant="ghost"
                  className="pointer-coarse:h-9"
                  onClick={() => {
                    const ahora = new Date();
                    const h = F.hoyIso(ahora);
                    setHh(F.dosCifras(ahora.getHours()));
                    setMm(F.dosCifras(ahora.getMinutes()));
                    if (F.enRango(h, min, max)) {
                      emitir(F.unirFechaHora(h, ahora.getHours(), ahora.getMinutes()));
                      setFoco(h);
                    } else if (seleccionado) {
                      emitir(F.unirFechaHora(seleccionado, ahora.getHours(), ahora.getMinutes()));
                    }
                  }}
                >
                  Ahora
                </Button>
              </div>
            )}

            <div className="mt-2 flex items-center gap-1 border-t border-(--crm-border) pt-2">
              <Button size="sm" variant="ghost" className="pointer-coarse:h-9" disabled={!hoyValido} onClick={() => elegir(hoy)}>
                Hoy
              </Button>
              <span className="flex-1" />
              {clearable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="pointer-coarse:h-9"
                  onClick={() => {
                    emitir("");
                    cerrar("input");
                  }}
                >
                  Limpiar
                </Button>
              )}
              {time && (
                <Button size="sm" variant="ghost" className="pointer-coarse:h-9" onClick={() => cerrar("input")}>
                  Listo
                </Button>
              )}
            </div>
          </div>
        </CrmPortal>
      )}
    </>
  );
}

/** `DatePicker` con hora (24 h): valor "YYYY-MM-DDTHH:mm" en hora local, como `datetime-local`. */
export function DateTimePicker(props: Omit<DatePickerProps, "time">) {
  return <DatePicker {...props} time />;
}
