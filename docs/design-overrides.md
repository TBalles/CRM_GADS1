# CRM GADS1 — Divergencias del Sumar UI Kit

`docs/DESIGN.md` es el **Sumar UI Kit canónico**, vendoreado acá como **referencia
read-only**. No se edita: su valor es ser un espejo exacto del kit del estudio, así una app
nueva que lo siga se ve indistinguible.

Este archivo registra dónde **CRM GADS1 se desvía a propósito** del kit. Regla general:
al crear o modificar UI, **DESIGN.md manda salvo lo listado acá**. Cada override abajo tiene
qué dice el kit, qué hace CRM GADS1, dónde vive el cambio real y por qué.

---

## 1. Color de marca — verde cancha, no wine

- **Kit**: brand token = wine `#800020`; es el único parámetro por cliente
  (`docs/DESIGN.md` §1.4, §1.5).
- **CRM GADS1**: verde cancha profundo `#0d6d4d` (`--brand: 160 78% 24%`). Es el ÚNICO color
  de marca. En oscuro se aclara a `160 58% 46%` y su `--brand-foreground` se invierte a
  oscuro — el verde profundo desaparece sobre fondo oscuro, y texto blanco sobre el verde
  claro no daría contraste.
- **Dónde vive el override**: `src/app/globals.css` (tokens `--brand` / `--brand-foreground`)
  y el hex horneado en `src/app/icon.svg` (el favicon es un archivo estático, no puede leer
  un token CSS).
- **Por qué**: el dominio es equipamiento para canchas de fútbol. El kit prevé el color de
  marca como el único parámetro por cliente.

## 2. `primary` ES la marca — el verde es el color principal, no el negro

- **Kit**: `primary` = `#1a1a1a`, un negro **fijo** que no cambia entre clientes; el color de
  marca se reserva para logo, acentos, KPI destacado y charts. Es la regla de oro #3:
  *"`primary` (negro) y neutros no se tocan entre clientes"* (`docs/DESIGN.md` §1.4, §15).
- **CRM GADS1**: `primary` **aliasea** `brand`, así el verde es el color principal de la
  interfaz y llega a botones, ítem de nav activo, links (`variant="link"`), tints
  `bg-primary/5` y focus rings con **un solo token**, sin overrides por componente:
  ```css
  --brand: 160 78% 24%;
  --primary: var(--brand);
  --primary-foreground: var(--brand-foreground);
  --ring: var(--brand);
  ```
  El `var(--brand)` se lee **dentro del mismo bloque** (`:root` y `.dark` lo redeclaran cada
  uno), así nunca se desfasan y rebrandear sigue siendo un valor por tema.
- **Contraste verificado** (no asumido): texto sobre `primary` da **6.34:1** en claro y
  **7.25:1** en oscuro → AA para texto normal en ambos, AAA en oscuro.
- **Consecuencias**: las variantes `brand` de `Button` y `Badge` quedaron duplicadas de
  `default` y se eliminaron. El thumb del scrollbar en hover pasó de `--ring` a
  `--muted-foreground`, porque un scrollbar verde es ruido de marca, no identidad.
- **Dónde vive**: `src/app/globals.css`.
- **Por qué**: pedido de producto — "que el verde sea el color main". El kit separa
  `primary` (controles) de `brand` (identidad) para que una app se vea igual entre clientes
  cambiando un solo color; acá la decisión es que la identidad **sea** la interfaz. Los
  tokens se mantienen separados igualmente para no romper el contrato del kit: si mañana se
  quiere volver al negro, se borran las tres líneas del alias y listo.

## 3. Tailwind v4, no v3 — los tokens viven en `@theme`, no en `tailwind.config.js`

- **Kit**: `tailwind.config.js` con `darkMode: 'class'`, `theme.extend.colors`, y el sufijo
  `/ <alpha-value>` OBLIGATORIO en cada color para que anden los modificadores de opacidad
  (`bg-brand/10`) — regla de oro #14 (`docs/DESIGN.md` §1.2).
- **CRM GADS1**: Tailwind v4, que no usa archivo de config. Los tokens se declaran en
  `@theme inline { --color-brand: hsl(var(--brand)); … }` dentro de `globals.css`, y el dark
  mode con `@custom-variant dark (&:where(.dark, .dark *))`.
  - **`<alpha-value>` se elimina a propósito**: era un requisito de v3. v4 implementa los
    modificadores de opacidad con `color-mix(in oklab, …)`, que funciona sobre cualquier
    valor de color. `bg-brand/10`, `border-border/50` y `ring-primary/20` siguen andando
    igual — el espíritu de la regla #14 se cumple, su implementación cambia.
  - **Los radios NO se redefinen**: los valores del kit (`lg` .5rem / `md` .375rem /
    `sm` .25rem) ya son idénticos a los defaults de v4.
  - **TODOS los semánticos son variable-driven** (`card`/`popover`/`primary`/`secondary`/
    `muted`/`accent`/`destructive` + sus `-foreground`). El kit los deja hardcodeados en hex,
    y así no invierten en oscuro.
- **Dónde vive**: `src/app/globals.css`.
- **Por qué**: el repo ya venía en Next 16 + Tailwind v4 antes del rediseño. Migrar a v3 para
  copiar el config literal sería un downgrade del stack para ganar nada: los tokens, las
  clases y los primitivos se transfieren tal cual.

## 4. Next App Router, no Vite + React Router

- **Kit**: Vite, `react-router-dom`, `index.html` con el `@import` de Inter, providers
  cableados en `App.tsx` (`docs/DESIGN.md` §0.3, §0.4).
- **CRM GADS1**: Next 16 App Router.
  - **Inter** se carga con `next/font/google` (`src/app/layout.tsx`) en vez del `@import` de
    Google Fonts: queda self-hosted, sin flash de la tipografía de fallback.
  - **Providers**: `ToastProvider` + `TooltipHost` se montan una sola vez en el layout raíz.
  - **Anti-flash de dark mode**: script inline en el `<head>` que aplica la clase `dark`
    antes del primer paint (el kit §1.4 pide el toggle, no define el anti-flash).
  - **Favicon**: `src/app/icon.svg` (convención de Next, que lo sirve como ruta y emite el
    `<link>`), en vez de un `<link rel="icon">` a mano.
- **Dónde vive**: `src/app/layout.tsx`, `src/app/icon.svg`.

## 5. Sin `recharts` — los charts del dashboard son CSS

- **Kit**: los charts van con **Recharts**, única librería, envueltos en `Card` +
  `SectionTitle` (`docs/DESIGN.md` §4.6, §10).
- **CRM GADS1**: el dashboard no usa ninguna librería de charts. Las dos formas que necesita
  se construyen con divs y flex en `src/app/(app)/dashboard/charts.tsx`:
  - **Magnitud** (oportunidades por etapa, empresas con más valor) → `MagnitudeBars`: barra
    horizontal ordenada, **hue único de marca**, con el valor como label directo. Nada de
    multi-tint `shade(i)` por categoría nominal — eso double-encodea el largo de la barra
    como color sin agregar información.
  - **Part-to-whole** (distribución del embudo) → `ShareBar`: barra apilada 100% con los
    colores de etapa (uso categórico legítimo) y leyenda con porcentajes directos, así la
    identidad nunca depende solo del color.
  - Los **promedios y montos no son part-to-whole** → nunca torta.
- **Dónde vive**: `src/app/(app)/dashboard/charts.tsx`, consumido por `dashboard/page.tsx`.
- **Por qué**: dos formas de chart, ambas triviales en CSS. Recharts pinta `fill`/`stroke`
  como atributos SVG donde `var(--token)` NO resuelve, así que habría que duplicar toda la
  paleta en JS y sincronizarla a mano con el tema (el problema que TopRentals resolvió con un
  hook `useChartColors`). En CSS los charts heredan los tokens y andan en claro y oscuro sin
  una línea extra. Si aparecen series temporales o charts densos, traer Recharts y seguir
  §4.6 + el método `dataviz`.

## 6. Primitivos y hooks en módulos separados, no un único `UIComponents.tsx`

- **Kit**: todos los primitivos viven en **un solo** `components/ui/UIComponents.tsx`, junto
  con `cn` y `useModalAnimation` (`docs/DESIGN.md` §2, §3).
- **CRM GADS1**: los primitivos puros quedan en `src/components/ui/UIComponents.tsx`
  **sin `"use client"`** (módulos compartidos, renderizan a los dos lados de la frontera RSC),
  y los hooks de overlay (`useModalAnimation`, `useAnchoredPortal`, `popoverPanelClass`) se
  mudaron a `src/components/ui/overlay.ts`, que **sí** es `"use client"`.
- **Por qué**: el kit está escrito para Vite, donde no existe la frontera servidor/cliente.
  Meter los hooks en el mismo archivo obliga a marcarlo `"use client"`, y eso convierte a
  **cada primitivo del archivo** en client component. A partir de ahí, pasar un ícono como
  prop desde un Server Component (`<SectionTitle icon={Layers}>` en el dashboard) cruza la
  frontera y **tira runtime error**: un ícono de lucide es un objeto `forwardRef`
  (`{$$typeof, render}`), no un objeto plano, y no es serializable.
  Reproducido y verificado: con `"use client"` en ese archivo, una página de servidor que
  pase `icon={...}` devuelve **HTTP 500**; sin él, **200**.
- **Regla práctica**: si un componente de `ui/` necesita un hook, estado o un handler de
  eventos, va en un módulo `"use client"` propio. Si es presentacional puro, se deja
  compartido — no le agregues `"use client"` "por si acaso", porque es justamente lo que
  rompe el paso de íconos desde el servidor.

## 7. Pill de etapa tintada, no `StatusBadge` con fill sólido

- **Kit**: `StatusBadge` mapea un estado canónico a un par `bg-{c}-100 text-{c}-700`
  (`docs/DESIGN.md` §3.11, regla de oro #7).
- **CRM GADS1**: las etapas son **datos**, no un enum de código: nombre y color (hex) vienen
  de la tabla `etapas` y el usuario puede cambiarlos por seed/SQL. No hay mapa canónico
  estado→color que `StatusBadge` pueda usar. `EtapaBadge`
  (`src/app/(app)/oportunidades/OportunidadesView.tsx`) construye el pill desde el hex de la
  fila: superficie `color-mix(in srgb, {color} 14%, transparent)`, borde al 38%, texto en
  `foreground` y un dot saturado con el color puro.
- **Por qué**: los colores sembrados son tonos 400 (`#4ade80`, `#fbbf24`, `#60a5fa`). La
  versión anterior les ponía `text-white` encima — eso daba ~1.8:1 de contraste, ilegible, y
  fallaba en ambos temas. La superficie tintada + dot conserva la identidad de color de la
  etapa, es legible en claro y oscuro, y reusa el mismo dot que ya muestran el `Select` y las
  columnas del embudo.

## 8. Formularios en Drawer, no en modal centrado

- **Kit**: todo formulario va en el **modal centrado** de §4.1; el drawer lateral (§4.3) es
  para drill-down read-only.
- **CRM GADS1**: toda alta/edición (empresa, contacto, oportunidad) vive en el `Drawer`
  lateral derecho. El panel toma la estructura header / body scrolleable / footer del modal
  de §4.1 y la animación `drawer-enter-right` de §4.3; la barra de acción va pineada al pie
  del área de scroll con `FormActions` (§5.7), con negativos que cancelan el `p-5` del body.
- **Dónde vive**: `src/components/Drawer.tsx`, `FormActions` en `src/components/form.tsx`.
- **Por qué**: decisión de producto previa al rediseño, documentada en `CLAUDE.md` — es la
  razón por la que el CRUD muta desde Client Components en vez de Server Actions. No se toca.

## 9. `useAnchoredPortal` extraído — el kit lo prescribe y no lo hace

- **Kit**: §8.4 describe el patrón de popover portaled y dice explícitamente
  *"extraé esto a un hook `useAnchoredPortal()` en vez de repetirlo"*, pero su propio código
  lo duplica en 5+ lugares.
- **CRM GADS1**: el hook existe (`src/components/ui/UIComponents.tsx`) y lo comparten `Select`
  y `RowActions`: medición del trigger, flip vertical, clamp horizontal, y cierre por
  mousedown afuera / scroll / Escape.
- **Por qué**: es la prescripción del kit, cumplida.

## 10. Escala de z-index saneada (la de §8.2, no los `z-[9999]`)

- **Kit**: §8.2 define la escala saneada y aclara que el código real tiene `z-[9999]` y
  `zIndex: 999999` desprolijos.
- **CRM GADS1**: se usa la escala de §8.2: nav `z-20`, header mobile `z-30`, drawer mobile
  `z-40`, drawer/overlay `z-50`, popovers portaled `z-90`, confirm `z-100`, toasts `z-130`,
  tooltip `z-140`. Ningún popover usa `zIndex: 999999`.

## 11. Accesibilidad — se cumple la regla #24 desde el arranque

- **Kit**: regla de oro #24 pide `aria-invalid` / `role="alert"` en errores de campo y
  `aria-label` en botones-ícono, y avisa *"el código base no los tiene — no heredes esa deuda"*.
- **CRM GADS1**: los campos de `src/components/form.tsx` emiten `aria-invalid` +
  `aria-describedby` y el error va con `role="alert"`; todo botón-ícono lleva `aria-label`.
  El trigger del `Select` usa `role="combobox"` con `aria-controls` / `aria-expanded` sobre un
  panel `role="listbox"` con hijos `role="option"` y `aria-selected` — un `<button>` pelado no
  soporta `aria-invalid`.

---

> Si aparece una divergencia nueva respecto del kit, se agrega como un bloque más en este
> archivo (misma estructura: kit → CRM GADS1 → dónde → por qué), no editando `docs/DESIGN.md`.
