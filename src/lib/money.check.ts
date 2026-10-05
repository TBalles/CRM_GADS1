/**
 * Self-check for the es-AR money mask. Run it with:
 *   node --test src/lib/money.check.ts
 *
 * No framework — Node's built-in runner strips the types itself. This covers
 * the mask because it's the one piece of non-trivial pure logic in the UI, and
 * it handles amounts: a silent rounding bug here writes wrong numbers to the DB.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { caretAfterMask, caretAfterRejected, maskMoney, maskFromNumber, offsetAfterDigits, parseMoney, shouldRestoreCaret } from "./money.ts";

test("maskMoney groups thousands with dots", () => {
  assert.equal(maskMoney("1000"), "1.000");
  assert.equal(maskMoney("23423424"), "23.423.424");
  assert.equal(maskMoney(""), "");
});

test("maskMoney keeps a comma as the decimal separator, capped at 2 places", () => {
  assert.equal(maskMoney("1234,5"), "1.234,5");
  assert.equal(maskMoney("1234,567"), "1.234,56");
  // A bare comma is a decimal point the user is still typing.
  assert.equal(maskMoney(",5"), "0,5");
});

test("maskMoney strips junk and leading zeros", () => {
  assert.equal(maskMoney("$ 1.500 ARS"), "1.500");
  assert.equal(maskMoney("000450"), "450");
});

test("maskMoney treats the last separator as the decimal one", () => {
  assert.equal(maskMoney("1.234.567,89"), "1.234.567,89");
  // Dot last → it's the decimal separator, so the comma groups.
  assert.equal(maskMoney("1,234.56"), "1.234,56");
});

test("parseMoney round-trips a masked amount back to a number", () => {
  assert.equal(parseMoney("23.423.424,56"), 23423424.56);
  assert.equal(parseMoney("1.500"), 1500);
  assert.equal(parseMoney("0,5"), 0.5);
  assert.equal(parseMoney("-1.200,50"), -1200.5);
});

test("parseMoney is total: never NaN, never throws", () => {
  assert.equal(parseMoney(""), 0);
  assert.equal(parseMoney(null), 0);
  assert.equal(parseMoney(undefined), 0);
  assert.equal(parseMoney("abc"), 0);
});

test("offsetAfterDigits anchors a caret to a digit count, not a char offset", () => {
  // "1.234.567" — after the 4th digit is index 5 ("1.234|.567").
  assert.equal(offsetAfterDigits("1.234.567", 4), 5);
  assert.equal(offsetAfterDigits("1.234.567", 0), 0);
  // Asking past the end clamps to the end instead of overflowing.
  assert.equal(offsetAfterDigits("1.234.567", 99), 9);
  assert.equal(offsetAfterDigits("", 3), 0);
  assert.equal(offsetAfterDigits("1.234.567", -1), 0);
});

test("caret survives the mask inserting a new thousands separator", () => {
  // Typing "4" at the end of "123" -> raw "1234", caret 4, 4 digits before it.
  const masked = maskMoney("1234");
  assert.equal(masked, "1.234");
  // The caret must land after the 4th digit (end), not be dragged by the new dot.
  assert.equal(offsetAfterDigits(masked, 4), 5);
});

test("caret stays put when editing the middle of an amount", () => {
  // "1.234.567,89" with the caret after the 6th digit; typing a digit there
  // gives raw "1.234.5X67,89" -> 7 digits before the caret in the new value.
  const masked = maskMoney("1.234.5967,89");
  assert.equal(masked, "12.345.967,89");
  // 7th digit is the "6" of 967; the caret belongs right after it, mid-string.
  const at = offsetAfterDigits(masked, 7);
  assert.equal(masked.slice(0, at), "12.345.96");
  assert.ok(at < masked.length, "caret must not be pushed to the end");
});

test("maskFromNumber seeds an edit form, and parses back unchanged", () => {
  assert.equal(maskFromNumber(450000), "450.000,00");
  assert.equal(maskFromNumber(null), "");
  // The round trip that matters: load a stored amount, save it untouched.
  for (const n of [0.5, 1500, 450000, 23423424.56]) {
    assert.equal(parseMoney(maskFromNumber(n)), n, `round trip failed for ${n}`);
  }
});

/** Una edición del campo: reemplaza [desde, hasta) por `texto` y enmascara, como hace MoneyInput (crm). */
function editar(v: { valor: string; caret: number }, texto: string, desde = v.caret, hasta = v.caret) {
  const raw = v.valor.slice(0, desde) + texto + v.valor.slice(hasta);
  const masked = maskMoney(raw);
  return { valor: masked, caret: caretAfterMask(raw, desde + texto.length, masked) };
}
/** Lo mismo con la cuenta de dígitos sola (ui/MoneyInput legacy, que usa `offsetAfterDigits`). */
function editarLegacy(v: { valor: string; caret: number }, texto: string) {
  const raw = v.valor.slice(0, v.caret) + texto + v.valor.slice(v.caret);
  const masked = maskMoney(raw);
  const digitos = raw.slice(0, v.caret + texto.length).replace(/\D/g, "").length;
  return { valor: masked, caret: offsetAfterDigits(masked, digitos) };
}
const tipear = (texto: string, paso = editar) => [...texto].reduce((v, c) => paso(v, c), { valor: "", caret: 0 });

test("typing 1500,50 key by key keeps the decimals (crm and legacy caret)", () => {
  assert.deepEqual(tipear("1500,50"), { valor: "1.500,50", caret: 8 });
  assert.deepEqual(tipear("1500,50", editarLegacy), { valor: "1.500,50", caret: 8 });
  assert.equal(parseMoney(tipear("1500,50").valor), 1500.5);
});

test("a comma typed at the end leaves the caret after it", () => {
  assert.deepEqual(tipear("1500,"), { valor: "1.500,", caret: 6 });
  assert.deepEqual(tipear("1500,", editarLegacy), { valor: "1.500,", caret: 6 });
});

test("a comma typed mid-amount leaves the caret after it", () => {
  // "1.5|00" + "," -> raw "1.5,00" -> "15,00", caret after the comma.
  assert.deepEqual(editar({ valor: "1.500", caret: 3 }, ","), { valor: "15,00", caret: 3 });
});

test("deleting (backspace) from the end and from the middle", () => {
  const conDecimal = { valor: "1.500,5", caret: 7 };
  const a = editar(conDecimal, "", 6, 7);
  assert.deepEqual(a, { valor: "1.500,", caret: 6 });
  assert.deepEqual(editar(a, "", 5, 6), { valor: "1.500", caret: 5 });
  // "1.5|00" backspace -> raw "1.00" -> "100", caret after the "1".
  assert.deepEqual(editar({ valor: "1.500", caret: 3 }, "", 2, 3), { valor: "100", caret: 1 });
});

test("pasting a whole amount, and over a selection", () => {
  assert.deepEqual(editar({ valor: "", caret: 0 }, "1500,50"), { valor: "1.500,50", caret: 8 });
  assert.deepEqual(editar({ valor: "1.500", caret: 0 }, "2000", 0, 5), { valor: "2.000", caret: 5 });
});

test("a rejected character leaves the value as it was", () => {
  // MoneyInput detecta "no cambió" y repone el cursor donde estaba (el input controlado lo mandaría al final).
  assert.equal(maskMoney("1.5a00"), "1.500");
});

test("a rejected key puts the caret back where it was, never past the value", () => {
  // "1.5|00" + "a" -> raw "1.5a00", caret 4 -> back to 3.
  assert.equal(caretAfterRejected("1.500", "1.5a00", 4), 3);
  assert.equal(caretAfterRejected("", "-", 1), 0);
  assert.equal(caretAfterRejected("12", "12x", 3), 2);
});

/**
 * Tipeo rápido: el cursor se repone UN cuadro después del rechazo y para entonces pudieron llegar otras teclas. Se modela
 * con `restos` = cuántas teclas válidas llegan antes de ese cuadro. Sin la guarda (`guarda: false`) se reproduce el bug.
 */
function tipearRapido(texto: string, restos: number, guarda = true) {
  let v = { valor: "", caret: 0 };
  let pendiente: { caret: number; conservado: string; quedan: number } | null = null;
  for (const c of texto) {
    const raw = v.valor.slice(0, v.caret) + c + v.valor.slice(v.caret);
    const masked = maskMoney(raw);
    if (masked === v.valor) pendiente = { caret: caretAfterRejected(v.valor, raw, v.caret + 1), conservado: v.valor, quedan: restos };
    else v = { valor: masked, caret: caretAfterMask(raw, v.caret + 1, masked) };
    if (pendiente && pendiente.quedan-- <= 0) {
      if (!guarda || shouldRestoreCaret(true, v.valor, pendiente.conservado)) v = { ...v, caret: pendiente.caret };
      pendiente = null;
    }
  }
  return v.valor;
}

test("fast typing after a rejected key keeps every digit", () => {
  for (const restos of [0, 1, 2]) {
    assert.equal(tipearRapido("-200", restos), "200");
    assert.equal(tipearRapido("a1500,50", restos), "1.500,50");
    assert.equal(tipearRapido("1500,50", restos), "1.500,50");
  }
  // Sin la guarda, el cuadro tardío lleva el cursor al 0 y se pierden dígitos (en el navegador "-200" quedó en "20").
  assert.notEqual(tipearRapido("-200", 1, false), "200");
  assert.equal(shouldRestoreCaret(true, "1.500", "1.500"), true);
  assert.equal(shouldRestoreCaret(false, "1.500", "1.500"), false);
});
