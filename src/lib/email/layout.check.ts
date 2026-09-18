/**
 * Auto-chequeo del armado de mails.
 *
 *   node --test src/lib/email/layout.check.ts
 *
 * Lo que importa probar es la SEGURIDAD del HTML (escapado, links) y que las
 * piezas lleguen al mail; el diseño se mira a ojo, no con asserts.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { esc, renderEmail, urlSegura, type ContenidoEmail } from "./layout.ts";
import { mailActivacion, mailRecuperacion } from "./plantillas.ts";
import { LOGO_CID } from "./logo.ts";

const base: ContenidoEmail = {
  preheader: "pre",
  encabezado: "Hola",
  icono: "✓",
  titulo: "Titulo",
  saludo: "Hola Juan,",
  parrafos: ["Uno", "Dos"],
  firma: "Equipo",
};

test("esc() neutraliza los caracteres de HTML", () => {
  assert.equal(esc(`<b>"Pérez" & 'Hijos'</b>`), "&lt;b&gt;&quot;Pérez&quot; &amp; &#39;Hijos&#39;&lt;/b&gt;");
});

test("el contenido dinámico no puede inyectar marcado", () => {
  const { html } = renderEmail({
    ...base,
    saludo: "Hola <script>alert(1)</script>,",
    detalle: [{ etiqueta: "Cliente", valor: `Club "Los <Pibes>" & Cía` }],
  });
  assert.ok(!html.includes("<script>"), "un <script> del contenido llegó crudo al HTML");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Club &quot;Los &lt;Pibes&gt;&quot; &amp; Cía"));
});

test("urlSegura() solo deja pasar http(s) y mailto", () => {
  assert.equal(urlSegura("https://ok.com/x"), "https://ok.com/x");
  assert.equal(urlSegura("mailto:a@b.com"), "mailto:a@b.com");
  assert.equal(urlSegura("javascript:alert(1)"), "#");
  assert.equal(urlSegura("  JavaScript:alert(1)"), "#");
});

test("un botón con javascript: no llega al href", () => {
  const { html } = renderEmail({ ...base, boton: { texto: "X", url: "javascript:alert(1)" } });
  assert.ok(!/href="javascript:/i.test(html));
});

test("el logo se referencia por CID, sin imágenes externas", () => {
  const { html } = renderEmail(base);
  assert.ok(html.includes(`src="cid:${LOGO_CID}"`));
  assert.ok(!/src="https?:/.test(html), "hay una imagen externa en el mail");
});

test("la versión en texto plano trae el contenido y el link", () => {
  const { text } = renderEmail({ ...base, boton: { texto: "Activar", url: "https://x.com/a" } });
  assert.match(text, /Hola Juan,/);
  assert.match(text, /Activar: https:\/\/x\.com\/a/);
  assert.ok(!text.includes("<"), "el texto plano tiene HTML");
});

test("activación: link en el botón y en la nota, y variante de reenvío", () => {
  const link = "https://app.test/auth/confirm?token_hash=abc&type=magiclink";
  const { asunto, contenido } = mailActivacion({ nombre: "Ana López", organizacion: "Club X", link });
  assert.equal(contenido.saludo, "Hola Ana,");
  assert.equal(contenido.boton?.url, link);
  assert.ok(contenido.nota?.includes(link));
  assert.match(asunto, /activá tu cuenta/i);

  const reenvio = mailActivacion({ nombre: null, organizacion: null, link, reenvio: true });
  assert.equal(reenvio.contenido.saludo, "Hola,");
  assert.match(reenvio.asunto, /nuevo link/);
  assert.match(reenvio.contenido.parrafos[0], /todavía no está activada/);
});

test("recuperación: tranquiliza si no lo pidió el usuario", () => {
  const { contenido } = mailRecuperacion({ nombre: "Ana", link: "https://app.test/x" });
  assert.ok(contenido.parrafos.some((p) => /ignorá este mail/.test(p)));
});
