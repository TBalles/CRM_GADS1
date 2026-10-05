# Tuco & Nito — Divergencias del Sumar UI Kit

`docs/DESIGN.md` es el **Sumar UI Kit canónico**, vendoreado acá como **referencia
read-only**. No se edita: su valor es ser un espejo exacto del kit del estudio, así una app
nueva que lo siga se ve indistinguible.

Este archivo registra dónde **Tuco & Nito se desvía a propósito** del kit. Regla general:
al crear o modificar UI, **DESIGN.md manda salvo lo listado acá**, con una excepción: **el CRM
(desde CRM 2.0) se rige por `design-system/crm-2/MASTER.md`**, ver la sección siguiente. Cada override abajo tiene
qué dice el kit, qué hace Tuco & Nito, dónde vive el cambio real y por qué.

---

## CRM 2.0 (Ledger)

Desde CRM 2.0 (v2.0.0) **todo el CRM** (las pantallas de `src/app/(app)/(crm2)/`, el panel de plataforma `/admin` y el
marco `src/components/crm/shell/`) sigue [`design-system/crm-2/MASTER.md`](../design-system/crm-2/MASTER.md) (§10.1–§10.25), el
sistema "Ledger": denso, sobrio, un solo acento verde, tipografía IBM Plex. Para el CRM, **MASTER.md de crm-2 manda sobre este
archivo y sobre `docs/DESIGN.md`**.

- **Tokens:** `--crm-*`, definidos en `src/app/(app)/crm.css` y colgados de `[data-crm]` (claro y `.dark`). No se redefine ninguna
  variable global.
- **Primitivos:** `src/components/crm/` (Button, DataTable, DatePicker, Dialog, Drawer, Field, Menu, Select, Tabs, Toast…).
- **Fuentes:** IBM Plex Sans y Mono se cargan solo en `CrmRoot` (`src/components/crm/CrmRoot.tsx`, lo usan los layouts de `(app)` y
  de `admin`); la landing y el acceso no las descargan.
- **Aislamiento:** la landing (`/`) y `/login`, `/recuperar`, `/definir-clave` no cambian: sus archivos y todo lo que importan
  están congelados y `npm run guard` lo verifica. El contrato está en [`design-system/crm-2/README.md`](../design-system/crm-2/README.md).
  Decisión: [ADR 0014](./decisiones/0014-crm-2-redisenio-por-slices-con-aislamiento-de-la-landing.md).

**Qué sigue valiendo de este archivo.** Las secciones de abajo se conservan como historia, y se leen así:

| § | Tema | Estado |
|---|---|---|
| 1 | Verde cancha como marca | Vigente para la landing y el acceso (`globals.css`, `icon.svg`). El CRM usa `--crm-accent` |
| 2 | `primary` aliasea `brand` | Vigente para la landing y el acceso (los formularios de `/login`, `/recuperar` y `/definir-clave` usan `ui/UIComponents.tsx`). **Superseded** para el CRM |
| 3 | Tailwind v4, tokens en `@theme` | **Vigente** (es el stack de toda la app) |
| 4 | Next App Router | **Vigente**. Inter (y las demás fuentes del layout raíz) siguen para landing y acceso; el CRM carga IBM Plex aparte |
| 5 | Sin `recharts` | **Vigente** (ya describe CRM 2.0) |
| 6 | Primitivos y hooks separados | Vigente para `src/components/ui/` (congelado). El CRM tiene su propio `src/components/crm/overlay.ts` |
| 7 | Pill de etapa tintada | **Superseded** por `StatusDot` / `StatusBadge` (ya describe CRM 2.0) |
| 8 | Formularios en Drawer | La decisión sigue; el `Drawer` y `form.tsx` de esta sección ya no existen (ver la sección) |
| 9 | `useAnchoredPortal` | Vigente solo para `ui/Select.tsx`. **Superseded** para el CRM por `useAnchor` (`crm/overlay.ts`) |
| 10 | Escala de z-index | Vigente para el toast y el tooltip del layout raíz. **Superseded** para el CRM por `--crm-z-*` |
| 11 | Accesibilidad desde el arranque | La regla sigue; los campos ahora son `crm/Field.tsx` (ver la sección) |
| 12 | Estética de marketing de la landing | **Vigente** |
| 13 | Estados vacíos con escena de cancha | **Superseded**: `EmptyState` del CRM no lleva ilustración (`crm/Feedback.tsx`, MASTER §10.9) y `ui/EmptyState.tsx` se borró |
| 14 | El CRM viste la cancha | **Superseded** para el CRM. `.cesped`, `MarcasCancha` y los tokens `--pitch*` quedan solo para `/login` |
| 15 | Iconografía del rubro | **Vigente** (`Equipamiento.tsx` se usa en Productos, Ventas, Alertas, Inicio, Oportunidades y la ficha de empresa) |
| 16 | Embudo en barras y búsqueda global | **Superseded**: ver §5 (`CellBar`) y `CommandPalette` (`crm/shell/`) |
| 17 | DatePicker propio | **Vigente**; ya no queda ningún `type="date"` en el CRM |

**Aplicado a archivos de la landing y el acceso.** Verificado contra el código: `src/app/page.tsx` usa Varela Round, Inter y el
bloque `LANDING` de `globals.css`; `/login` usa `GoalMark`, `Cancha.tsx` (`MarcasCancha`), `.cesped` y los primitivos de
`ui/UIComponents.tsx` (`Button`, `Input`); `/recuperar` y `/definir-clave` usan `AuthCard` y `ui/UIComponents.tsx`. `ui/Toast.tsx` y `ui/Tooltip.tsx`
los monta el layout raíz. Del resto de `src/components/ui/` solo se usan `overlay.ts` y `backdropClose.ts` (este último también lo importan los overlays del CRM);
`Select.tsx` quedó sin usos al borrarse `FiltroSelect` de `FiltrosUrl.tsx`.

**Archivos que estas secciones nombran y ya no existen** (se borraron en CRM 2.0, Lote F, o antes): `components/Drawer.tsx`,
`form.tsx`, `ConfirmModal.tsx`, `RowActions.tsx`, `AppShell.tsx`, `PaletaBusqueda.tsx`, `ThemeToggle.tsx`, `ui/EmptyState.tsx`,
`ui/MoneyInput.tsx`, `ui/Loader.tsx`, `ui/PantallaCarga.tsx`, `ui/OverlayCarga.tsx` y `components/oportunidades.tsx`. Sus equivalentes
viven en `src/components/crm/`: `Drawer.tsx`, `Dialog.tsx` (incluye `ConfirmDialog`), `Field.tsx`, `Menu.tsx`, `MoneyInput.tsx`,
`Feedback.tsx` (`Skeleton`, `LoadingStatus`, `EmptyState`), `Status.tsx` y `shell/` (`AppFrame`, `Topbar`, `CommandPalette`).

**`docs/DESIGN.md` y los archivos que ya no existen.** El kit (que es una copia de solo lectura y no se edita) describe su propio código
de ejemplo: `components/ui/MoneyInput.tsx` (§3.10, ~línea 741), `components/ui/Loader.tsx` (§3.12, ~838), `components/ConfirmModal.tsx`
(§4.2, ~1359) y `components/HomeDetailDrawer.tsx` con su `Loader` (§4.3, ~1397). Son recetas para pegar en un repo nuevo, no archivos de
este repo: acá esos componentes **no se copiaron** y su lugar lo ocupan `crm/MoneyInput.tsx`, `crm/Feedback.tsx`
(`LoadingStatus`, `Skeleton`), `crm/Dialog.tsx` (`ConfirmDialog`) y `crm/Drawer.tsx`.

---

## 1. Color de marca — verde cancha, no wine

> **Vigente para la landing y el acceso.** En el CRM el acento es `--crm-accent` (`crm.css`); ver "CRM 2.0 (Ledger)" arriba.

- **Kit**: brand token = wine `#800020`; es el único parámetro por cliente
  (`docs/DESIGN.md` §1.4, §1.5).
- **Tuco & Nito**: verde cancha profundo `#0d6d4d` (`--brand: 160 78% 24%`). Es el ÚNICO color
  de marca. En oscuro se aclara a `160 58% 46%` y su `--brand-foreground` se invierte a
  oscuro — el verde profundo desaparece sobre fondo oscuro, y texto blanco sobre el verde
  claro no daría contraste.
- **Dónde vive el override**: `src/app/globals.css` (tokens `--brand` / `--brand-foreground`)
  y el hex horneado en `src/app/icon.svg` (el favicon es un archivo estático, no puede leer
  un token CSS).
- **Por qué**: el dominio es equipamiento para canchas de fútbol. El kit prevé el color de
  marca como el único parámetro por cliente.

## 2. `primary` ES la marca — el verde es el color principal, no el negro

> **SUPERSEDED para el CRM.** Sigue describiendo `globals.css` y los primitivos de `ui/UIComponents.tsx` que usan la landing y las pantallas de acceso. El CRM usa los tokens `--crm-*` (MASTER crm-2 §3).

- **Kit**: `primary` = `#1a1a1a`, un negro **fijo** que no cambia entre clientes; el color de
  marca se reserva para logo, acentos, KPI destacado y charts. Es la regla de oro #3:
  *"`primary` (negro) y neutros no se tocan entre clientes"* (`docs/DESIGN.md` §1.4, §15).
- **Tuco & Nito**: `primary` **aliasea** `brand`, así el verde es el color principal de la
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
- **Tuco & Nito**: Tailwind v4, que no usa archivo de config. Los tokens se declaran en
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
- **Tuco & Nito**: Next 16 App Router.
  - **Inter** se carga con `next/font/google` (`src/app/layout.tsx`) en vez del `@import` de
    Google Fonts: queda self-hosted, sin flash de la tipografía de fallback.
  - **Providers**: `ToastProvider` + `TooltipHost` se montan una sola vez en el layout raíz.
  - **Anti-flash de dark mode**: script inline en el `<head>` que aplica la clase `dark`
    antes del primer paint (el kit §1.4 pide el toggle, no define el anti-flash).
  - **Favicon**: `src/app/icon.svg` (convención de Next, que lo sirve como ruta y emite el
    `<link>`), en vez de un `<link rel="icon">` a mano.
- **Dónde vive**: `src/app/layout.tsx`, `src/app/icon.svg`.

## 5. Sin `recharts` — los charts de los tableros son CSS

- **Kit**: los charts van con **Recharts**, única librería, envueltos en `Card` +
  `SectionTitle` (`docs/DESIGN.md` §4.6, §10).
- **Tuco & Nito** (desde CRM 2.0, Lote E): Inicio, Tablero comercial y Conversión del embudo no usan
  ninguna librería de charts ni cards. Cada dato es una **tabla** (la alternativa accesible) y la forma
  visual es una barra fina dentro de la fila: `CellBar` (`src/components/crm/DataTable.tsx`), con el
  ancho de `anchoBarra` (`src/components/crm/barra.ts`, probado en `barra.check.ts`).
  - **Magnitud** (empresas con más valor, pipeline por responsable, motivos de pérdida, el embudo
    por etapa) → barra horizontal, **un solo tono** (`--crm-accent`), proporcional a la mayor y con
    el número escrito en su columna. Nada de multi-tint por categoría nominal.
  - **Part-to-whole** (la distribución por etapa) → ya no es una barra apilada: es la columna
    "Del total" de la tabla "Oportunidades por etapa" (`porcentajeDe`, mismo redondeo que la leyenda
    de antes); el color de cada etapa queda en el cuadradito junto a su nombre.
  - Los **promedios y montos no son part-to-whole** → nunca torta.
- **Dónde vive**: `src/components/crm/DataTable.tsx` (`CellBar`) y `src/components/crm/barra.ts`,
  usados por `src/app/(app)/(crm2)/{dashboard,tablero-comercial,embudo}/page.tsx`. Las reglas están en
  `design-system/crm-2/MASTER.md` §10.21–§10.23. (`dashboard/charts.tsx` con `MagnitudeBars` y
  `ShareBar` se borró en el Lote E.)
- **Por qué**: formas triviales en CSS. Recharts pinta `fill`/`stroke` como atributos SVG donde
  `var(--token)` NO resuelve, así que habría que duplicar toda la paleta en JS y sincronizarla a mano
  con el tema. En CSS las barras heredan los tokens y andan en claro y oscuro sin una línea extra. Si
  aparecen series temporales o charts densos, traer Recharts y seguir §4.6 + el método `dataviz`.

## 6. Primitivos y hooks en módulos separados, no un único `UIComponents.tsx`

> **Vigente para `src/components/ui/`** (congelado: lo importan las pantallas de acceso y el layout raíz). El CRM aplica la misma idea en `src/components/crm/` (`overlay.ts` con los hooks, primitivos puros sin `"use client"`; `design-system/crm-2/README.md`).

- **Kit**: todos los primitivos viven en **un solo** `components/ui/UIComponents.tsx`, junto
  con `cn` y `useModalAnimation` (`docs/DESIGN.md` §2, §3).
- **Tuco & Nito**: los primitivos puros quedan en `src/components/ui/UIComponents.tsx`
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

> **SUPERSEDED por CRM 2.0** (Lote C): la etapa se dibuja con `StatusDot` / `StatusBadge` (`crm/Status.tsx`), como dice el texto de abajo.

- **Kit**: `StatusBadge` mapea un estado canónico a un par `bg-{c}-100 text-{c}-700`
  (`docs/DESIGN.md` §3.11, regla de oro #7).
- **Tuco & Nito**: las etapas son **datos**, no un enum de código: nombre y color (hex) vienen
  de la tabla `etapas` y el usuario puede cambiarlos por seed/SQL. No hay mapa canónico
  estado→color que `StatusBadge` pueda usar. `EtapaBadge` (legacy, `src/components/oportunidades.tsx`, ya borrado)
  construía el pill desde el hex de la fila: superficie `color-mix(in srgb, {color} 14%, transparent)`, borde al 38%,
  texto en `foreground` y un dot saturado con el color puro. Desde CRM 2.0 (Lote C) la etapa se muestra con `StatusDot
  color` / `StatusBadge color` de `src/components/crm/Status.tsx` (cuadradito con el color de la organización + texto en
  el color de texto; design-system/crm-2/MASTER.md §3.2).
- **Por qué**: los colores sembrados son tonos 400 (`#4ade80`, `#fbbf24`, `#60a5fa`). La
  versión anterior les ponía `text-white` encima — eso daba ~1.8:1 de contraste, ilegible, y
  fallaba en ambos temas. La superficie tintada + dot conserva la identidad de color de la
  etapa, es legible en claro y oscuro, y reusa el mismo dot que ya muestran el `Select` y las
  columnas del embudo.

## 8. Formularios en Drawer, no en modal centrado

> **La decisión sigue** (toda alta/edición va en un drawer lateral) **pero la implementación cambió**: el `Drawer` y `form.tsx` de abajo se borraron. Hoy es `src/components/crm/Drawer.tsx` (MASTER crm-2 §10.8) con `crm/cuenta/FormDrawer.tsx` (Cancelar / Guardar) y los campos de `crm/Field.tsx`.

- **Kit**: todo formulario va en el **modal centrado** de §4.1; el drawer lateral (§4.3) es
  para drill-down read-only.
- **Tuco & Nito**: toda alta/edición (empresa, contacto, oportunidad) vive en el `Drawer`
  lateral derecho. El panel toma la estructura header / body scrolleable / footer del modal
  de §4.1 y la animación `drawer-enter-right` de §4.3; la barra de acción va pineada al pie
  del área de scroll con `FormActions` (§5.7), con negativos que cancelan el `p-5` del body.
- **Dónde vive** (histórico, archivos borrados): `src/components/Drawer.tsx` y `FormActions` en `src/components/form.tsx`. Hoy: `src/components/crm/Drawer.tsx` y `crm/cuenta/FormDrawer.tsx`.
- **Por qué**: decisión de producto previa al rediseño, documentada en `CLAUDE.md` — es la
  razón por la que el CRUD muta desde Client Components en vez de Server Actions. No se toca.

## 9. `useAnchoredPortal` extraído — el kit lo prescribe y no lo hace

> **Vigente solo para `ui/Select.tsx`** (`RowActions` se borró). **SUPERSEDED para el CRM** por `useAnchor` y `useLayer` de `src/components/crm/overlay.ts` (anclaje, flip, cierre por Escape y clic afuera).

- **Kit**: §8.4 describe el patrón de popover portaled y dice explícitamente
  *"extraé esto a un hook `useAnchoredPortal()` en vez de repetirlo"*, pero su propio código
  lo duplica en 5+ lugares.
- **Tuco & Nito**: el hook existe (hoy en `src/components/ui/overlay.ts`) y lo compartían `Select`
  y `RowActions` (este último se borró; hoy solo lo usa `ui/Select.tsx`): medición del trigger, flip vertical, clamp horizontal, y cierre por
  mousedown afuera / scroll / Escape.
- **Por qué**: es la prescripción del kit, cumplida.

## 10. Escala de z-index saneada (la de §8.2, no los `z-[9999]`)

> **SUPERSEDED para el CRM**, que usa `--crm-z-*` (MASTER crm-2 §7). La escala de abajo sigue en el toast (`z-130`) y el tooltip (`z-140`) de `ui/`, que monta el layout raíz.

- **Kit**: §8.2 define la escala saneada y aclara que el código real tiene `z-[9999]` y
  `zIndex: 999999` desprolijos.
- **Tuco & Nito**: se usa la escala de §8.2: nav `z-20`, header mobile `z-30`, drawer mobile
  `z-40`, drawer/overlay `z-50`, popovers portaled `z-90`, confirm `z-100`, toasts `z-130`,
  tooltip `z-140`. Ningún popover usa `zIndex: 999999`.

## 11. Accesibilidad — se cumple la regla #24 desde el arranque

> **La regla sigue; el archivo cambió.** `src/components/form.tsx` se borró: hoy los campos son `src/components/crm/Field.tsx` (`aria-invalid`, `aria-describedby`, error con `role="alert"`) y `crm/Select.tsx` (combobox + listbox). Todo botón-ícono del CRM es un `IconButton` con `label` obligatorio.

- **Kit**: regla de oro #24 pide `aria-invalid` / `role="alert"` en errores de campo y
  `aria-label` en botones-ícono, y avisa *"el código base no los tiene — no heredes esa deuda"*.
- **Tuco & Nito**: los campos de `src/components/form.tsx` (borrado; hoy `crm/Field.tsx`) emitían `aria-invalid` +
  `aria-describedby` y el error va con `role="alert"`; todo botón-ícono lleva `aria-label`.
  El trigger del `Select` usa `role="combobox"` con `aria-controls` / `aria-expanded` sobre un
  panel `role="listbox"` con hijos `role="option"` y `aria-selected` — un `<button>` pelado no
  soporta `aria-invalid`.

## 12. La landing pública tiene estética de marketing, no de aplicación

- **Kit**: define la estética de una *aplicación*: Inter, fondo según el tema del usuario, cursor
  del sistema, animaciones sobrias y funcionales.
- **Tuco & Nito**: la landing (`/`, `src/app/page.tsx`) es una página de *marketing* y se aparta
  a propósito, siguiendo la web del estudio (sumar.ai):
  - **Siempre oscura**, sin importar el tema elegido: la raíz lleva `dark landing-root`, y
    `.landing-root` en `globals.css` redefine los tokens (casi negro con tinte verde) y **sube la
    luz del verde de marca** (`--brand: 156 74% 50%`) para que brille sobre negro. `--primary` y
    `--ring` siguen solos, porque ya aliasean `--brand` (§2).
  - **Tipografía de display** Varela Round (`font-display`) para titulares. (El §14, que la llevaba
    también a los títulos del CRM, quedó superseded: el CRM usa IBM Plex.) El cuerpo de la landing sigue en Inter.
  - **Partículas en canvas** (`src/components/landing/ParticleField.tsx`): el isotipo armado con
    partículas en el hero, un halo detrás de la vitrina de producto y un cielo fijo. El verde lo
    lee del token `--glow`, no está duplicado en JS.
  - **Cursor pelota** (`BallCursor.tsx`): solo con mouse, gira según la distancia recorrida y
    "patea" las partículas al hacer clic. El cursor nativo se oculta recién cuando la pelota
    monta, así que si el JS falla el usuario conserva el suyo.
  - **Animaciones atadas al scroll** con `animation-timeline` en CSS puro. Sin soporte, o con
    `prefers-reduced-motion`, el contenido se ve quieto y completo: nada queda escondido
    esperando un JS.
- **Dónde**: `src/app/page.tsx`, `src/components/landing/*`, bloque LANDING de `globals.css`.
- **Por qué**: la landing tiene que *vender*, no ser eficiente de usar todos los días. Todo
  vive detrás de `.landing-root`, así que el CRM no hereda nada de esto.

## 13. Estados vacíos con escena de cancha, no ícono en un círculo

> **SUPERSEDED por CRM 2.0.** `src/components/ui/EmptyState.tsx` se borró. El `EmptyState` del CRM (`crm/Feedback.tsx`, MASTER crm-2 §10.9) es título + una línea + una acción, sin ilustraciones, y `/sin-permisos` tampoco lleva escena.

- **Kit**: §9.3 define el empty state como borde punteado + ícono genérico en un círculo gris.
- **Tuco & Nito**: el borde punteado se mantiene, pero en lugar del ícono va una **escena**
  dibujada en SVG inline con el mismo lenguaje de línea que el login y el GoalMark. Son tres, una
  por situación, para que no se vean iguales:
  - `cancha` (primera vez): el área marcada y vacía, con la pelota en el punto penal.
  - `afuera` (búsqueda o filtro sin coincidencias): la pelota se fue al lado del arco.
  - `al-dia` (Alertas sin recambios pendientes): el arco con la red entera, en verde. Es la
    única buena noticia del grupo y se ve como tal.
  Los vacíos `compact` que viven **adentro** de otro objeto (contactos de una empresa, bitácora,
  ranking del tablero) van **solo con texto**: una escena repetida en cada acordeón sería
  decoración. El copy sigue la voz de la landing: concreto, rioplatense, del oficio.
  El ícono sigue disponible para vacíos que no son del rubro (`/sin-permisos`).
- **Dónde** (histórico): `src/components/ui/EmptyState.tsx` (prop `escena`), ya borrado.
- **Por qué**: el vacío es donde un producto muestra personalidad, y donde una app generada es
  más genérica. Las escenas son `aria-hidden`, sin animación, y el texto carga todo el sentido.
  De paso, el hint dejó de usar `text-muted-foreground/70`, que quedaba por debajo de AA.

## 14. El CRM viste la cancha — sidebar, marcadores y títulos de la landing

> **SUPERSEDED por CRM 2.0.** El CRM ya no usa `.cesped`, `MarcasCancha`, los tokens `--pitch*`, Varela Round ni `AppShell`: tiene el marco `crm/shell/` y tipografía IBM Plex. Esos recursos siguen en `globals.css` y `Cancha.tsx` solo para `/login` (congelados). Se conserva como historia.

- **Kit**: sidebar `bg-card` neutro (§4.5), títulos de página en la sans del sistema, métricas en
  `KpiCard` iguales (§4.6).
- **Tuco & Nito**: el CRM toma el mundo visual de la landing para que se lea como el mismo
  producto y no como una plantilla:
  - **Superficie `.cesped`** (`globals.css`): el verde del login con franjas de corte de césped al
    3% de blanco. Tokens propios `--pitch-light / --pitch / --pitch-dark / --pitch-line`, **iguales
    en claro y oscuro** (como el tile del logo: es identidad, no UI). La usan el sidebar, el header
    y el drawer mobile, el panel del login y los dos marcadores.
  - **Marcas de cancha** (`src/components/Cancha.tsx`, `MarcasCancha`): la cancha completa en SVG,
    vertical u horizontal, a 5–7% de blanco y `aria-hidden`. Es la que antes vivía solo en el login.
  - **Sidebar sobre la cancha**: texto blanco, ítem activo con lavado blanco y la raya de cal en
    `--pitch-line`, wordmark en Varela con el "&" en verde como en la landing. El anillo de foco del
    kit (verde sobre fondo) desaparecía sobre verde: acá es `--pitch-line` con offset `--pitch`.
    "Cerrar sesión" pasa a `red-300`: `--destructive` daba ~3.4:1 sobre la cancha.
  - **Marcadores**: el encabezado del tablero y el resumen de Alertas se dibujan sobre la cancha
    horizontal. Alertas deja las tres `KpiCard` iguales por un tablero de estadio (el componente
    sigue existiendo, es del kit).
  - **Varela Round en los títulos del CRM** (`PageHeader`, wordmark, estados vacíos, login). Tiene
    un solo peso: los títulos pesan por tamaño, nunca con negrita sintética.
  - **Eyebrow con línea de cal** en cada `PageHeader`, con los tags de la landing ("A quién le
    vendés", "El embudo", "Arranca el reloj", "Llegá antes que nadie").
  - **Reloj del recambio** en cada alerta: barra de la entrega al vencimiento con la ventana de 60
    días en ámbar. Usa `dias_restantes` de la vista (no `new Date()`), así no desfasa la hidratación.
    (CRM 2.0, Lote B: la barra se reemplazó por texto —entrega, vida útil y vencimiento— en la tabla de `/alertas`;
    ver `design-system/crm-2/MASTER.md` §10.17.)
- **Dónde** (histórico): `globals.css`, `layout.tsx`, `components/Cancha.tsx`, `AppShell.tsx` (borrado),
  `UIComponents.tsx` (`PageHeader`), `dashboard/page.tsx`, `alertas/AlertasView.tsx`,
  `login/page.tsx`, y el `eyebrow` de cada pantalla. De todo eso, hoy solo siguen en uso `globals.css`, `Cancha.tsx` y `login/page.tsx`.
- **Por qué**: después de dos pases de tokens y estructura la app seguía pudiendo ser el CRM de
  cualquier rubro. Lo que ves siempre (el marco, los títulos, la primera cifra) es lo que tiene que
  decir de qué se trata. Contraste medido en el punto MÁS claro del césped: blanco 11.1:1,
  blanco/75 7.0:1, blanco/65 5.7:1, `--pitch-line` 6.3:1, `red-300` 5.8:1.

## 15. Iconografía del rubro en lugar de `Package`

- **Kit**: íconos de lucide para todo; un producto se representa con una caja genérica.
- **Tuco & Nito**: el equipo mismo es el ícono. `src/components/Equipamiento.tsx` dibuja arco,
  red, pelota, cono, pechera, banderín, escalera y valla con las métricas de lucide (grilla de 24,
  trazo 2, puntas redondeadas), así conviven sin parecer prestados. `IconoEquipo` elige el ícono con
  `tipoEquipo` (`src/lib/equipo.ts`, puro y con self-check `equipo.check.ts`): **el nombre primero**
  (la vista de alertas no trae categoría, y "Red para arco" es una red), después la categoría,
  después la caja. Aparece en Productos (con una barrita de vida útil relativa al catálogo), en cada
  ítem de Ventas y apilado en la fila cerrada, en Alertas y en la tarjeta de recambios del tablero.
- **Dónde**: `components/Equipamiento.tsx`, `lib/equipo.ts`, y las pantallas de `src/app/(app)/(crm2)/`:
  `productos/ProductosList.tsx`, `ventas/VentasList.tsx`, `alertas/AlertasView.tsx`, `dashboard/page.tsx`,
  `oportunidades/OportunidadesView.tsx` y la ficha de empresa (`empresas/[id]/`).
- **Por qué**: una caja dice "producto" en cualquier rubro; un arco dice este. Es siempre
  decorativo (`aria-hidden`): el nombre del producto va impreso al lado, así que un ícono mal
  adivinado no cuesta nada.

## 16. Embudo en barras centradas y búsqueda global como diálogo (F5)

> **SUPERSEDED por CRM 2.0.** El embudo es hoy una tabla con `CellBar` (override §5, MASTER crm-2 §10.23) y la búsqueda global es `CommandPalette` (`src/components/crm/shell/`, MASTER §10.11); `AppShell.tsx` y `PaletaBusqueda.tsx` se borraron. Siguen igual el atajo Ctrl/Cmd+K y el contrato ARIA (combobox + listbox).

- **Kit**: los charts van con Recharts (§4.6) y no define una paleta de comandos.
- **Tuco & Nito**: `/embudo` dibuja el embudo con `div`s de ancho proporcional, centrados y de **un solo tono de marca**
  (es una magnitud: cuántas oportunidades entraron a cada etapa), siempre con el número escrito al lado y el detalle en
  texto (avanzaron, mediana, siguen ahí). Sigue el override §5 (nada de librería de charts). La búsqueda global
  (`Ctrl/Cmd+K`) es un diálogo `role="dialog"` con el patrón combobox + listbox de ARIA (`aria-activedescendant`, foco
  atrapado y devuelto al cerrar); en pantallas chicas es una hoja a todo el ancho y alto. El botón que la abre va en el
  menú (la cancha) con su atajo escrito, y en la barra superior en mobile.
- **Dónde** (histórico): `src/app/(app)/embudo/page.tsx`, `src/components/PaletaBusqueda.tsx`, `src/components/AppShell.tsx`. Hoy: `src/app/(app)/(crm2)/embudo/page.tsx` y `src/components/crm/shell/CommandPalette.tsx`.
- **Por qué**: el embudo es una sola magnitud por etapa, no una proporción del total, y la búsqueda es el único atajo
  de teclado global del CRM: tiene que ser accesible sin ratón y usable con el pulgar.

## 17. DatePicker propio en CRM 2.0 (spec en `design-system/crm-2/MASTER.md` §10.15)

- **Kit**: nombra un `DatePicker` (§3.9 y el patrón de dropdown anclado de §8) pero no lo especifica.
- **Tuco & Nito**: en las pantallas CRM 2.0 las fechas usan `DatePicker` / `DateTimePicker` (campo con máscara
  dd/mm/aaaa + calendario no modal en `#crm-portal`, semana de lunes, es-AR), con el mismo valor que el input nativo
  ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" local). La spec completa (look Ledger, teclado APG, celular) está en MASTER crm-2 §10.15.
  Todas las pantallas del CRM ya lo usan: no queda ningún `type="date"` ni `datetime-local` (los filtros de fecha son `FechaFiltro`).
- **Dónde**: `src/components/crm/DatePicker.tsx`, `src/components/crm/fecha.ts` (+ `fecha.check.ts`).
- **Por qué**: el calendario nativo no sigue el tema claro/oscuro, ni la tipografía, ni el formato y la semana de es-AR.

---

> Si aparece una divergencia nueva respecto del kit, se agrega como un bloque más en este
> archivo (misma estructura: kit → Tuco & Nito → dónde → por qué), no editando `docs/DESIGN.md`.
