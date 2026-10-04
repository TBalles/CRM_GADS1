# CRM 2.0 — contrato de aislamiento

Rama `crm-2.0`. El CRM se rediseña **sin cambiar la landing (`/`) ni las pantallas previas al ingreso
(`/login`, `/recuperar`, `/definir-clave`)**, que están **fuera de alcance** y deben quedar exactamente como están.
Este documento es el contrato; las guardas (`npm run guard`) lo hacen cumplir dentro de los límites que se
detallan al final («Qué NO cubre»).

## Qué está congelado y por qué

La lista exacta, con sus hashes, está en `design-system/crm-2/guard/frozen-files.json` (39 archivos, más
cualquier archivo que aparezca en `src/components/landing/`). Es la **clausura transitiva de imports** de la landing,
del layout raíz, de las tres pantallas de acceso, del proxy y de las rutas `/auth/*` (calculada con un recorrido
de imports; si un archivo nuevo entra a esa clausura, hay que sumarlo a `ARCHIVOS` en `scripts/guard/frozen-files.mjs`).

| Grupo | Archivos | Por qué |
|---|---|---|
| Landing | `src/app/page.tsx`, `src/components/landing/*` (`ParticleField`, `BallCursor`, `ProductShowcase`) | Es la landing. |
| Capa compartida | `src/app/globals.css`, `src/app/layout.tsx` (raíz), `src/app/icon.svg` | La landing **no es independiente**: depende de `@theme inline` (colores, radios, sombras, transiciones, fuentes), de los valores de `:root` y `.dark`, de las reglas de `html`/`body`, del bloque `LANDING` y de Inter y las variables de fuente que carga el root. Cambiar `--radius`, `--default-transition-*`, `--font-display`, `--font-sans` o renombrar un token cambia la landing y el login. |
| Marca y utilidades | `src/components/Logo.tsx`, `src/lib/brand.ts`, `src/lib/contacto.ts`, `src/lib/utils.ts` | `GoalMark` lo usan la landing y el login (y `ParticleField` lleva una copia rasterizada). Si el CRM necesita otra marca, se crea `CrmMark` aparte. |
| Lo que el layout raíz monta en toda ruta | `src/components/ui/Toast.tsx`, `src/components/ui/Tooltip.tsx` | `ToastProvider` y `TooltipHost` están en el root: renderizan en la landing y en el login. |
| Pantallas previas al ingreso | `src/app/login/*`, `src/app/recuperar/*`, `src/app/definir-clave/*` (page, form, actions), `src/components/AuthCard.tsx`, `src/components/Cancha.tsx` (`MarcasCancha`), `src/components/ui/UIComponents.tsx` | Fuera de alcance: deben quedar exactamente como están. `UIComponents` (Button, Input, Avatar…) es lo que importan los formularios. |
| Auth, proxy y su lógica | `src/proxy.ts`, `src/app/auth/{confirm,signout}/route.ts`, `src/lib/sesion.ts`, `permisos.ts`, `cuentas.ts`, `supabase/{server,middleware,admin,types}.ts`, `src/lib/email/{enviar,layout,logo,plantillas}.ts` | Es lo que importan esas pantallas y la landing (que consulta la sesión). Cambiarlos cambia el acceso, no solo el aspecto. |

**Consecuencia importante:** `.cesped`, `MarcasCancha`, los tokens `--pitch*` y todo el bloque `LANDING` de
`globals.css` **no se borran ni se editan**, aunque CRM 2.0 deje de usarlos dentro del CRM (el login y la landing
los siguen usando). Dejar de usarlos en `AppShell` está bien; borrarlos de `globals.css` o `Cancha.tsx` rompe la guarda.

## Reglas para el trabajo de CRM 2.0

1. **No se edita ningún archivo congelado.** Si hace falta, se frena y se pide una decisión (procedimiento abajo).
2. **Tokens nuevos solo como `--crm-*`**, definidos en `src/app/(app)/crm.css`. Nunca se redefine una variable
   existente (`--background`, `--radius`, `--primary`…).
3. **`crm.css` solo puede contener selectores que cuelguen de `[data-crm]`** (`[data-crm] …` o `.dark [data-crm] …`),
   y **ningún at-rule global**: nada de `@theme`, `@layer`, `@property`, `@import`, `@font-face` ni `@keyframes`
   sueltos. Si hace falta una animación: `@keyframes crm-<nombre>`, referenciada solo desde descendientes de
   `[data-crm]`. (`@media` y `@supports` con selectores bajo `[data-crm]` adentro, sí.) `npm run guard:frozen` lo
   verifica y falla si no se cumple.
4. **`crm.css` lo importan solo** `src/app/(app)/layout.tsx` y `src/app/admin/layout.tsx`; nunca el layout raíz.
   Next entrega el CSS por ruta: `/` y `/login` no lo descargan. En una navegación del lado del cliente CRM → landing
   la hoja ya cargada **sigue en el documento**: es inerte por diseño, porque todo cuelga de `[data-crm]` y la landing
   no tiene ese elemento (por eso la regla 3 es obligatoria).
5. **Primitivos nuevos solo en `src/components/crm/`.** Los `ui/*` actuales no se tocan.
6. **Portales solo a `#crm-portal`**: contenedor vacío dentro de `[data-crm]`, así los overlays nuevos heredan los
   `--crm-*`. Los overlays legacy siguen yendo a `body`. Lo portalizado debe ir con `position: fixed`.
7. **Fuentes IBM Plex** solo en `CrmRoot` (usado por los layouts de `(app)` y `admin`): `--font-crm-sans` y
   `--font-crm-mono` en el wrapper. La landing no las descarga. Hoy `preload: false`; pasar a `true` al aplicarlas.
8. Los route groups `(legacy)` / `(crm2)` llegan en la Etapa 2.

## Sistema de diseño y primitivos (Etapa 1)

La fuente de verdad visual es **[`MASTER.md`](./MASTER.md)** (tokens, tipografía, densidad, estados, specs de componentes,
contratos de accesibilidad y la definición de terminado de una pantalla migrada).

- **Tokens:** `--crm-*` en `src/app/(app)/crm.css` (claro y `.dark`). Se consumen **solo** con utilidades de Tailwind v4 que leen
  la variable (`bg-(--crm-panel)`, `z-(--crm-z-popover)`…); crm.css no tiene clases de componentes (MASTER §2 explica por qué).
- **Primitivos:** `src/components/crm/`, un archivo por familia (`Button`, `Field`, `Select`, `Menu`, `Popover`, `Tooltip`, `Tabs`,
  `Status`, `Panel`, `Feedback`, `Drawer`, `Dialog`, `Toast`, `Pagination`, `DataTable`), más `cx.ts` (clases compartidas),
  `portal.tsx` (`CrmPortal` → `#crm-portal`), `overlay.ts` (pila de capas, foco modal, anclaje) y `teclado.ts` (lógica pura de
  teclado). Se importan por archivo (`@/components/crm/Button`), sin barril.
- **Server-safe:** `Button`, `Field`, `Status`, `Panel`, `Feedback`, `DataTable` y `cx.ts` no tienen `"use client"` ni hooks: se
  pueden usar desde server components. Los hooks viven en `overlay.ts` (cliente), como `ui/overlay.ts` frente a `UIComponents.tsx`.
- **Sumar un primitivo:** archivo nuevo en `components/crm/`; solo tokens (ningún color, radio, sombra ni z-index literal);
  todo lo flotante por `CrmPortal` con `UI_ROOT`, `position: fixed` y su `--crm-z-*`; Escape/clic afuera con `useLayer`; nunca
  `title=` (el TooltipHost legacy lo reescribe y rompe la hidratación); spec en MASTER §10; si suma un par de color, agregarlo a
  `PARES` en `src/lib/contrasteCrm.ts` (`npm test` lo mide); una muestra en el laboratorio.
- **Laboratorio:** `/crm-lab` (solo `next dev`; en producción da 404; no enlazado). Muestra cada primitivo en sus estados, en claro
  y oscuro. Es el **único** consumidor de `components/crm` en esta etapa y se borra antes de lanzar la 2.0.
- **Fuentes:** `CrmRoot` sigue con `preload: false` a propósito: en esta etapa Plex solo se aplica en el laboratorio y con
  `preload: true` cada pantalla legacy del CRM precarga 4 archivos que no usa (Chrome avisa "preloaded but not used"). Pasa a
  `true` cuando el shell de la Etapa 2 aplique Plex en todo el CRM.

### Cómo es el wrapper

```tsx
<div data-crm className={`${plexSans.variable} ${plexMono.variable}`}>
  {/* árbol existente */}
  <div id="crm-portal" />
</div>
```

`[data-crm] { display: contents }`: el wrapper no genera caja, así que layout, scroll, `sticky`, `h-dvh` y las
reglas `@media print` (`[data-app-shell]`, `[data-app-main]`…) no cambian. Sí hereda variables. La rama «Sin acceso» del
layout de `(app)` (usuario sin permiso para operar, que renderiza `AuthCard` sin shell) **no** se envuelve: queda como estaba.

## Cómo correr las guardas

```bash
npm run guard            # guard:frozen + guard:landing
npm run guard:frozen     # hashes + git diff contra la base + árbol de trabajo + reglas de crm.css
npm run guard:landing    # pixel diff de /, /login y /recuperar contra la baseline commiteada
npm run guard:baseline-crm   # fotos del CRM actual (fuera del repo)
```

**`guard:landing`** (Playwright, `playwright.guard.config.ts`):

- Pantallas: `/` a 1440, 768 y 390; `/login` y `/recuperar` a 1440 y 390. Página completa, tolerancia **cero**
  (`maxDiffPixels: 0` y `threshold: 0`). Baselines en `design-system/crm-2/guard/landing/` (7 PNG, 2,7 MB).
- Necesita el `.env` del proyecto: la landing consulta a Supabase si hay sesión (`NEXT_PUBLIC_SUPABASE_URL` y la
  clave pública). Sin sesión muestra «Ingresar» (lo que se fotografía).
- Por defecto hace `npm run build` + `npm run start -p <GUARD_PORT>` (3199). Variables:
  - `GUARD_BASE_URL`: usa una app ya levantada (build de producción); no arranca nada. **No puede verificar qué
    build es**: es responsabilidad de quien la levantó.
  - `GUARD_SKIP_BUILD=1`: solo `next start` con el `.next` existente. **Falla si ese build es más viejo que el último
    cambio en `src/`** (`GUARD_ALLOW_STALE=1` para permitirlo a propósito).
  - Si ya hay algo escuchando en `GUARD_PORT`, **falla** (no se fotografía un servidor que podría ser de otra versión);
    `GUARD_REUSE_SERVER=1` lo permite explícitamente.

**`guard:frozen`** (`scripts/guard/frozen-files.mjs`) falla (exit 1, listando el motivo) si: cambia un hash; aparece o
desaparece un archivo de una carpeta congelada; `git diff <base>...HEAD` o el árbol de trabajo (incluidos archivos nuevos)
tocan una ruta congelada; o `crm.css` rompe la regla 3. `<base>` es `GUARD_BASE` > `base` del manifiesto > `main`.
**Si no se puede resolver la base (checkout superficial, sin `main`) falla** (a prueba de fallos); `GUARD_ALLOW_NO_BASE=1`
omite solo el diff de git (los hashes siguen valiendo). Los hashes normalizan CRLF→LF.

**`guard:baseline-crm`**: `GUARD_BASE_URL` (app en producción), `MANUAL_EMAIL`/`MANUAL_PASSWORD` (Administrador de la
demo), opcional `MANUAL_EMAIL_VENDEDOR`/`MANUAL_PASSWORD_VENDEDOR`, `GUARD_BASELINE_OUT` (por defecto
`../baseline-crm-actual/`, fuera del repo). Las credenciales se toman **del entorno**, se pasan por la línea de comandos y
**nunca** se escriben en el repo; las cuentas de la demo se describen en `supabase/seeds/demo_catedra.sql`. Solo navega:
no escribe nada. Para comparar generaciones se corre dos veces con `GUARD_BASELINE_OUT` distintos y se compara con
`node scripts/guard/compare-png.mjs <carpetaA> <carpetaB> [--solo=…]` (píxeles distintos por par; exit 1 si hay alguno).
Opciones de `baseline-crm`: `--solo=id1,id2` y `--continuar` (retoma una corrida cortada). El contenido atado al día
de la demo («Hace 72 d», «Vencido hace…») cambia con los días: comparar el mismo día o ignorar esas zonas.

Baseline actual del CRM (Etapa 0): 110 imágenes = 25 pantallas del Administrador × claro/oscuro × 1440/390 (el menú
móvil solo a 390) + 3 del Vendedor × 4. Saltadas: el panel de plataforma (`/admin`, requiere superadmin) y «sin permisos»
como rol sin acceso (la demo no tiene uno: `/sin-permisos` se fotografía entrando directo).

### Procedimiento para un cambio aprobado de un archivo congelado

1. Obtener la aprobación explícita (qué archivo y por qué).
2. Hacer el cambio y **commitearlo** (commit `C`).
3. Si cambia lo visual: `npx playwright test -c playwright.guard.config.ts --update-snapshots` (regenera las baselines
   afectadas) y revisar las imágenes a ojo.
4. `GUARD_BASE=C node scripts/guard/frozen-files.mjs --update`: regenera los hashes y fija `C` como `base` del manifiesto.
   Desde ahí el chequeo de git compara `C...HEAD` (si no, `main...HEAD` fallaría para siempre por el cambio aprobado).
5. Commitear manifiesto y baselines **en el mismo PR**, y que quien revisa mire el diff del manifiesto y de los PNG.
   Sin `GUARD_BASE`, `--update` conserva la `base` que ya tuviera el manifiesto.

## Lo no determinista de la landing y cómo se neutraliza

Se investigaron `page.tsx`, `components/landing/*`, `/login` y `/recuperar`. Cada fuente, y qué hace la guarda:

| Fuente | Dónde | Cómo se neutraliza |
|---|---|---|
| Partículas (cielo y figuras): ~300 + ~2.800 puntos con `Math.random`, rAF, mouse | `ParticleField` (2 `<canvas>` `fixed inset-0`) | `canvas { visibility: hidden }` inyectado con `stylePath` (`scripts/guard/landing.css`). **No** una máscara: la máscara de Playwright pinta un rectángulo sobre toda la zona del canvas y, al ser `fixed inset-0`, taparía el hero entero. |
| Cinta de equipamiento (`.marquee-track`, 48 s) | CSS | `reducedMotion: 'reduce'` → `animation: none` (regla `prefers-reduced-motion` de `globals.css`); además `animations: 'disabled'`. Queda en la posición 0. |
| Chispas ✦ (`.twinkle`), indicador de scroll, ventanas flotantes (`.float-*`), puntos «en vivo», puntos de «escribiendo» | CSS, infinitas | Igual: las apaga `reducedMotion: 'reduce'` y las cancela `animations: 'disabled'`. |
| Aparición al scrollear (`.reveal`, `.bar-grow`, `.line-draw`, `.ring-draw`, `animation-timeline: view()`) | CSS, atadas al scroll | Esas reglas solo existen con `prefers-reduced-motion: no-preference`: con `reduce` el contenido es estático y completo. Igual se recorre la página de punta a punta y se vuelve arriba antes de fotografiar. |
| Barra de progreso del carrusel (`.steps-progress`, `scroll-timeline`) | CSS, atada al scroll horizontal | El carrusel queda en 0; estado idéntico en cada corrida. |
| Cursor pelota | `BallCursor` | Solo aparece tras el primer movimiento del mouse (la guarda nunca lo mueve: `opacity: 0`); además `.ball-cursor-el { display: none }`. Sin mouse tampoco hay hover ni spotlight. |
| `© {año actual}` | Pie de la landing y panel de marca del login (`new Date().getFullYear()` en el servidor) | Es lo único atado al reloj (cambia el 1 de enero): esos `<p>` se enmascaran. |
| Entrada del login (`animate-in fade-in duration-500`) | `LoginPage` | `reducedMotion` + `animations: 'disabled'`. |
| Sesión de Supabase | `getUser()` | La guarda corre sin cookies: siempre «Ingresar». |
| Fuentes (`next/font`, `display: swap`) | Varela, Inter, Jakarta | Se espera `document.fonts.ready` antes de fotografiar (dos veces). |
| Hidratación | React | Landing: se espera la clase `ball-cursor` en `<html>`. Login/recuperar: el campo/botón visible. Además `networkidle`. |

## Qué NO cubre (límites honestos)

- **Pantallas con guarda visual:** `/`, `/login`, `/recuperar` y nada más. **`/definir-clave` necesita sesión y solo
  está cubierto por los hashes** (igual que la rama «Sin acceso» del layout de `(app)`, que usa `AuthCard`: el hash de
  `AuthCard` la protege, ninguna imagen).
- **Render solo con movimiento reducido.** Todas las capturas se toman con `prefers-reduced-motion: reduce`. Los estilos
  de `reveal` / `view()` / `scroll-timeline` (que solo existen con `no-preference`) **no se ejercitan**: los cubre
  únicamente el hash de `globals.css`.
- **El dibujo de las partículas** (canvas) no está bajo guarda visual: es aleatorio por diseño. Lo cubre solo el hash de
  `ParticleField.tsx`.
- **Las baselines y el manifiesto no se protegen a sí mismos.** Alguien puede regenerar con `--update-snapshots` o
  `--update` un cambio que provenga de una fuente *no* congelada (una regresión visual causada por, p. ej., una dependencia
  nueva no listada) y la guarda pasaría. La protección es la **revisión del PR**: todo diff en `design-system/crm-2/guard/`
  hay que mirarlo.
- **Baselines de Chromium/Windows**: los píxeles del texto cambian entre sistemas operativos. En un CI Linux hay que
  regenerarlas en ese entorno; `guard:frozen` no depende del SO.
- La guarda de git compara contra una base **configurable**; con `GUARD_ALLOW_NO_BASE=1` solo quedan los hashes.

### De qué build salieron las baselines

- `landing-{1440,768,390}.png`: build de producción del árbol de `main` en `c21caf9` sin modificaciones, 2026-10-04.
- `login-*.png` y `recuperar-*.png`: build de producción del árbol de la Etapa 0 (`c21caf9` + aislamiento de CRM 2.0,
  aún sin commitear), 2026-10-04. Esas pantallas son byte a byte las de `main` (`guard:frozen` verifica que sus
  fuentes no cambiaron) y las 7 imágenes dieron 0 px en 3 corridas consecutivas.

## Cómo sumar las guardas al CI más adelante

Hoy no están en el CI por defecto: necesitan una app construida y el `.env` de la landing (Supabase). Para sumarlas: un
job que defina `NEXT_PUBLIC_SUPABASE_URL` y la clave pública (pueden ser de la demo; la guarda no inicia sesión),
instale Chromium (`npx playwright install --with-deps chromium`), traiga `main` completo (`fetch-depth: 0`, si no
`guard:frozen` falla por falta de base) y corra `npm run guard`. Las baselines son de Chromium/Windows: si el CI es Linux,
generarlas en ese entorno o correr solo `guard:frozen`.
