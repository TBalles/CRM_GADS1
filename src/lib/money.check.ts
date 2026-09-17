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

import { maskMoney, maskFromNumber, offsetAfterDigits, parseMoney } from "./money.ts";

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
