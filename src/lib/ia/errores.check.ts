/**
 * Self-check de la configuración y del mapeo de errores de la IA (F7): node --test src/lib/ia/errores.check.ts
 *
 * Usa errores REALES del SDK (se construyen a mano, sin red): si el SDK cambia una clase, esto lo nota.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { interpretarRespuesta, mensajeDeError, resumenParaLog } from "./errores.ts";
import { MAX_MENSAJE_BORRADOR, MENSAJES_IA, MODELO_POR_DEFECTO, admiteEffort, admiteFallback, iaDisponible, modeloIA } from "./config.ts";

const HEADERS = new Headers();
const apiError = (status: number, mensaje = "detalle interno del proveedor sk-ant-secreto") =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: mensaje } }, mensaje, HEADERS);

/* --------------------------------- config ----------------------------------- */

test("iaDisponible solo con clave no vacía", () => {
  assert.equal(iaDisponible({}), false);
  assert.equal(iaDisponible({ ANTHROPIC_API_KEY: "" }), false);
  assert.equal(iaDisponible({ ANTHROPIC_API_KEY: "   " }), false);
  assert.equal(iaDisponible({ ANTHROPIC_API_KEY: "sk-ant-test" }), true);
});

test("modeloIA: por defecto claude-opus-5-5, configurable", () => {
  assert.equal(MODELO_POR_DEFECTO, "claude-opus-5-5");
  assert.equal(modeloIA({}), "claude-opus-5-5");
  assert.equal(modeloIA({ ANTHROPIC_MODEL: "  " }), "claude-opus-5-5");
  assert.equal(modeloIA({ ANTHROPIC_MODEL: "claude-sonnet-5-5" }), "claude-sonnet-5-5");
});

test("admiteFallback solo para los modelos que lo aceptan", () => {
  assert.equal(admiteFallback("claude-opus-5-5"), true);
  assert.equal(admiteFallback("claude-haiku-4-5"), false);
});

test("admiteEffort: solo los modelos que lo aceptan; Haiku 4.5, Sonnet 4.5 y los desconocidos no", () => {
  for (const m of ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8", "claude-sonnet-5-5", "claude-sonnet-4-6", "claude-fable-5-1"]) {
    assert.equal(admiteEffort(m), true, m);
  }
  for (const m of ["claude-haiku-4-5", "claude-sonnet-4-5", "gpt-algo", "", "claude-opus-5-5-20260101"]) {
    assert.equal(admiteEffort(m), false, m);
  }
});

test("un solo tope de largo: lo que devuelve la IA nunca supera lo que el servidor registra como enviado", () => {
  assert.equal(MAX_MENSAJE_BORRADOR, 2000);
});

/* ---------------------------- errores del SDK -> frase ---------------------- */

test("429 -> límite", () => assert.equal(mensajeDeError(apiError(429)), MENSAJES_IA.limite));
test("401 y 403 -> configuración", () => {
  assert.equal(mensajeDeError(apiError(401)), MENSAJES_IA.configuracion);
  assert.equal(mensajeDeError(apiError(403)), MENSAJES_IA.configuracion);
});
test("529 y 500 -> saturado", () => {
  assert.equal(mensajeDeError(apiError(529)), MENSAJES_IA.saturado);
  assert.equal(mensajeDeError(apiError(500)), MENSAJES_IA.saturado);
});
test("400 y 404 -> genérico", () => {
  assert.equal(mensajeDeError(apiError(400)), MENSAJES_IA.generico);
  assert.equal(mensajeDeError(apiError(404)), MENSAJES_IA.generico);
});
test("sin conexión y timeout (el timeout es más específico y va primero)", () => {
  assert.equal(mensajeDeError(new Anthropic.APIConnectionError({ message: "ECONNREFUSED" })), MENSAJES_IA.conexion);
  assert.equal(mensajeDeError(new Anthropic.APIConnectionTimeoutError()), MENSAJES_IA.demora);
});
test("cualquier otra cosa -> genérico", () => {
  assert.equal(mensajeDeError(new Error("boom")), MENSAJES_IA.generico);
  assert.equal(mensajeDeError("texto"), MENSAJES_IA.generico);
  assert.equal(mensajeDeError(undefined), MENSAJES_IA.generico);
});

test("ninguna frase deja pasar el mensaje del proveedor ni una clave", () => {
  for (const status of [400, 401, 403, 404, 429, 500, 529]) {
    const frase = mensajeDeError(apiError(status));
    assert.ok(!/sk-ant|proveedor|interno/i.test(frase), `${status}: ${frase}`);
  }
});

test("resumenParaLog: clase y status, nunca el mensaje", () => {
  const l = resumenParaLog(apiError(429));
  assert.match(l, /status=429/);
  assert.ok(!l.includes("sk-ant"));
  assert.equal(resumenParaLog(new TypeError("x")), "TypeError");
});

/* ------------------------------ stop_reason -> texto ------------------------ */

const texto = (t: string) => ({ type: "text", text: t });

test("end_turn con texto -> ok", () => {
  assert.deepEqual(interpretarRespuesta({ stop_reason: "end_turn", content: [texto("  Hola Marcela  ")] }), { ok: true, texto: "Hola Marcela" });
});
test("junta varios bloques de texto y se salta los que no son texto", () => {
  const r = interpretarRespuesta({ stop_reason: "end_turn", content: [{ type: "thinking" }, texto("Uno"), texto("Dos")] });
  assert.deepEqual(r, { ok: true, texto: "Uno\nDos" });
});
test("refusal -> frase de rechazo, aunque haya texto", () => {
  assert.deepEqual(interpretarRespuesta({ stop_reason: "refusal", content: [texto("parcial")] }), { ok: false, motivo: MENSAJES_IA.rechazo });
});
test("max_tokens -> cortado, aunque haya texto", () => {
  assert.deepEqual(interpretarRespuesta({ stop_reason: "max_tokens", content: [texto("a medias")] }), { ok: false, motivo: MENSAJES_IA.cortado });
});
test("sin texto -> vacío", () => {
  assert.deepEqual(interpretarRespuesta({ stop_reason: "end_turn", content: [{ type: "thinking" }] }), { ok: false, motivo: MENSAJES_IA.vacio });
  assert.deepEqual(interpretarRespuesta({ stop_reason: "end_turn", content: [texto("   ")] }), { ok: false, motivo: MENSAJES_IA.vacio });
});
test("otros stop_reason (tool_use, pause_turn, null) no son un borrador", () => {
  for (const s of ["tool_use", "pause_turn", "model_context_window_exceeded", null]) {
    assert.equal(interpretarRespuesta({ stop_reason: s, content: [texto("x")] }).ok, false, String(s));
  }
});
test("el texto de vuelta tiene tope", () => {
  const r = interpretarRespuesta({ stop_reason: "end_turn", content: [texto("a".repeat(MAX_MENSAJE_BORRADOR + 500))] });
  assert.ok(r.ok && r.texto.length === MAX_MENSAJE_BORRADOR);
});
