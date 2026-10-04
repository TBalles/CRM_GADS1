# CRM 2.0 — Sistema de diseño ("Ledger")

> **Cómo leer este archivo.** Es la fuente de verdad de la superficie CRM 2.0: todo lo que se construye con
> `src/components/crm/` y los tokens `--crm-*` de `src/app/(app)/crm.css`. Cada sección dice el valor exacto y por qué.
> Si un valor de acá no coincide con el código, **gana el código y este archivo se corrige** (el contraste lo verifica
> `npm test`; el resto, la revisión).
>
> **Precedencia.** Este archivo gobierna las pantallas migradas a CRM 2.0. Las pantallas legacy (todavía no migradas) siguen
> gobernadas por `design-system/tuco-y-nito/MASTER.md` y `docs/design-overrides.md` hasta su slice. El contrato de
> aislamiento (qué no se toca, cómo se carga el CSS, portales) está en `design-system/crm-2/README.md` y es obligatorio.
>
> **Origen.** Se partió de una corrida de UI/UX Pro Max (`--design-system --persist`). De esa salida genérica quedan solo el
> estilo *Minimalism & Swiss*, los diales y la checklist de entrega (§16); su paleta azul marino, Plus Jakarta, el patrón de
> landing, las sombras en cards y el scroll reveal **no aplican** a un CRM operativo y se descartaron.

**Diales:** Variance 3/10 (sobrio, alineado a grilla) · Motion 2/10 (sutil, funcional) · Density 8/10 (denso, operativo).

---

## 1. Principios

1. **El dato primero.** La primera fila de datos aparece en el primer pantallazo. Una sola barra de página + toolbar pegada a la
   grilla; nada de dos bandas de chrome antes del contenido.
2. **Elevación = borde + tono, no sombra.** Paneles con borde hairline; la sombra existe solo en lo que flota.
3. **Un solo acento.** El verde de marca marca *primario, activo, seleccionado y foco*. Nada más usa verde de marca.
4. **Estado = punto + palabra.** El color nunca es la única señal.
5. **Jerarquía de acciones.** Una acción primaria por pantalla; el resto, secundario o en `⋮`.
6. **Densidad con piso de legibilidad.** Filas de 36 px, controles de 32, texto mínimo 12 px, contraste AA medido.
7. **Carácter sin decoración.** La identidad sale de la tipografía técnica (Plex Sans + Mono), de cifras con unidades en gris,
   de la regla fuerte bajo la cabecera de las tablas (la línea de un libro mayor) y del acento usado con disciplina; no de
   adornos. Marca sutil: logo, verde de acento, indicador activo de 2 px e íconos de equipamiento **solo como contenido de
   dominio**. Sin `.cesped`, sin marcas de cancha, sin escenas deportivas, sin Varela Round dentro del CRM.
8. **Misma lógica, misma interfaz accesible.** Se conservan datos, acciones, permisos, textos de acciones y nombres accesibles
   (§13.2). Cambia la presentación, no el producto.

### 1.1 Anti-patrones del "look generado por IA" (prohibidos)

- Cards para todo; cards dentro de cards; una card para envolver una tabla que ya tiene borde.
- Hero o "masthead" con cifra gigante; títulos de página de más de 20 px; eyebrows decorativos sobre cada título.
- Micro-etiquetas en mayúscula con tracking o versalitas (en ningún lado del CRM, tampoco en cabeceras de tabla).
- Gradientes sin función, glow, glassmorphism, `backdrop-blur` en el fondo de modales.
- Sombras en paneles en reposo; sombras que crecen al hover; `translateY` al hover.
- Radios grandes (8–16 px) y botones "píldora"; avatares en círculos de colores; ícono dentro de un círculo de color para decorar.
- Chips de filtro "facetados" con borde punteado y relleno de color (el look shadcn): el FilterChip es sólido de hairline.
- Íconos decorativos al lado de cada título; emojis como íconos.
- Paleta SaaS genérica azul/violeta; más de un color de acento; badges llenos de color para estados.
- Stats inventadas, "insights" de relleno, empty states con ilustraciones o escenas.
- Espacios vacíos grandes "para que respire"; contenedor centrado angosto en pantallas de trabajo.
- Copy de marketing en la interfaz ("¡Potenciá tus ventas!"); signos de exclamación.
- Spinners donde va un esqueleto; animaciones de entrada al scrollear.

---

## 2. Cómo se usan los tokens (una sola forma)

- **Definición:** `src/app/(app)/crm.css`, bajo `[data-crm]` (claro) y `.dark [data-crm]` (oscuro). Solo `--crm-*` y
  `@keyframes crm-*`. Valores de color completos (`hsl(...)`, `color-mix(...)`), no tripletes. (El pipeline de CSS los
  minifica a hex: en el navegador `--crm-panel` se lee `#fff`.)
- **Consumo:** **solo** utilidades de Tailwind v4 que leen la variable, dentro de `src/components/crm/`:
  `bg-(--crm-panel)`, `text-(--crm-text)`, `border-(--crm-border)`, `rounded-(--crm-radius)`, `shadow-(--crm-shadow-float)`,
  `z-(--crm-z-popover)`, `duration-(--crm-dur-fast)`, `ease-(--crm-ease)`, `font-(family-name:--crm-font-sans)`,
  `outline-(--crm-focus)`, `animate-[crm-pop_var(--crm-dur-fast)_var(--crm-ease)]`.
- **Por qué esta y no clases `crm-*` en crm.css:** crm.css no puede usar `@layer` (regla de aislamiento), así que cualquier clase
  de componente ahí sería CSS sin capa y le ganaría a *toda* utilidad de Tailwind: un `className` de ajuste dejaría de funcionar.
  Con utilidades, `cn()` (tailwind-merge) resuelve conflictos como en el resto del repo, y el CSS de cada componente vive en su archivo.
- **Clases compartidas:** `src/components/crm/cx.ts` (`UI_ROOT`, `TYPE`, `FOCUS`, `FIELD`, `FLOATING`, `ITEM`, `DISABLED`).
- **Regla:** ningún color, radio, sombra o z-index literal en un primitivo. Si falta un valor, se agrega un `--crm-*` (en los dos
  temas) y, si es un par texto/fondo o de UI, se suma a `PARES` en `src/lib/contrasteCrm.ts` (si no, `npm test` falla).
- **El wrapper no lleva estilo.** `[data-crm]` envuelve a todo el CRM (también al legacy) y es `display: contents`: nunca se le pone
  `font-family` ni `color`. Cada raíz CRM 2.0 (la página migrada) y **cada capa portalizada** aplica `UI_ROOT` por su cuenta.

---

## 3. Color

### 3.1 Tokens

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--crm-canvas` | `hsl(150 12% 97%)` | `hsl(165 12% 8%)` | Fondo del área de trabajo |
| `--crm-panel` | `hsl(0 0% 100%)` | `hsl(165 11% 11%)` | Paneles, tablas (también su cabecera), capas flotantes, inputs |
| `--crm-panel-2` | `hsl(150 10% 95%)` | `hsl(165 10% 14%)` | Track de switch, fondo del segmentado, avatar |
| `--crm-hover` | texto al 6 % | texto al 7 % | Hover tonal (filas, items, ghost, chips) |
| `--crm-pressed` | texto al 10 % | texto al 11 % | Item activo de teclado (con barra de acento), `⋮` abierto |
| `--crm-selected` | acento al 10 % | acento al 14 % | Fila seleccionada (con barra de acento), página actual |
| `--crm-skeleton` | `hsl(150 8% 91%)` | `hsl(165 8% 18%)` | Esqueletos |
| `--crm-scrim` | `hsl(165 25% 6% / .4)` | `hsl(165 30% 2% / .6)` | Fondo de drawer y diálogo (sin blur) |
| `--crm-border` | `hsl(150 10% 88%)` | `hsl(165 8% 20%)` | Hairline decorativo: paneles, divisores, filas, chips |
| `--crm-border-strong` | `hsl(160 6% 52%)` | `hsl(165 6% 44%)` | Borde de **controles** (input, select, checkbox): ≥ 3:1; regla bajo la cabecera de tabla |
| `--crm-text` | `hsl(160 20% 10%)` | `hsl(150 8% 94%)` | Texto principal |
| `--crm-text-2` | `hsl(160 8% 34%)` | `hsl(165 8% 68%)` | Secundario, placeholder, unidades, íconos secundarios (≥ 4.5:1) |
| `--crm-text-disabled` | `hsl(160 6% 62%)` | `hsl(165 5% 40%)` | Solo deshabilitado (exento de contraste por WCAG) |
| `--crm-accent` | `hsl(160 78% 24%)` | `hsl(160 58% 46%)` | Primario, check, switch, barras de activo/seleccionado |
| `--crm-accent-hover` | `hsl(160 80% 19%)` | `hsl(160 58% 54%)` | Hover del primario |
| `--crm-on-accent` | blanco | `hsl(165 40% 7%)` | Texto sobre acento (en oscuro el acento es claro: texto oscuro) |
| `--crm-accent-text` | `hsl(160 78% 23%)` | `hsl(158 55% 58%)` | Acento como texto: links, valor de un filtro, segmento y página elegidos |
| `--crm-focus` | `hsl(160 78% 28%)` | `hsl(158 60% 52%)` | Anillo de foco |
| `--crm-success` / `-tint` | `hsl(145 63% 25%)` / 8 % | `hsl(145 50% 60%)` / 8 % | Éxito |
| `--crm-warning` / `-tint` | `hsl(30 90% 29%)` / 8 % | `hsl(38 85% 62%)` / 8 % | Atención |
| `--crm-danger` / `-tint` | `hsl(0 70% 40%)` / 8 % | `hsl(0 80% 72%)` / 8 % | Error, destructivo |
| `--crm-danger-hover`, `--crm-on-danger` | `hsl(0 72% 34%)`, blanco | `hsl(0 80% 78%)`, `hsl(0 40% 8%)` | Botón destructivo |
| `--crm-info` / `-tint` | `hsl(210 75% 36%)` / 8 % | `hsl(210 80% 74%)` / 8 % | Información |
| `--crm-inverse`, `--crm-on-inverse` | `hsl(165 18% 14%)`, `hsl(150 8% 96%)` | `hsl(150 8% 92%)`, `hsl(165 18% 10%)` | Tooltip |

Neutros fríos con un matiz verde casi imperceptible (hue 150–165; superficies y bordes con saturación ≤ 12 %): el verde de
marca se siente en todo sin pintarse en nada. Los tintes son `color-mix(in srgb, <color> N%, transparent)`: funcionan sobre
cualquier superficie.

### 3.2 Reglas

- **Semánticos:** texto sólido del tono sobre su tinte al 8 % (badge, banner) o suelto sobre panel/canvas (error de campo,
  estado). Siempre con ícono o palabra. `success` tiene hue 145 (no 160) para no confundirse con el acento de marca.
- **Estados y etapas de la organización:** el color lo configura cada organización y no se puede garantizar AA. Se muestra como
  **cuadradito de 8 px + etiqueta** en color de texto; en badge, fondo `color-mix(in srgb, <color> 12%, transparent)` y texto en
  `--crm-text`. Nunca texto en el color de la organización.
- **Hover** = `--crm-hover` sobre lo que haya. **Seleccionado** = `--crm-selected` + barra de 2 px en `--crm-accent`.
  Los tintes se subieron (hover 6 %, activo 10 %, seleccionado 10 %) para que se lean en monitores reales; aun así **el
  tinte nunca es la única señal**: la barra de 2 px (o el borde de acento) es lo que cumple 3:1 y está medida en §3.3.
- **Foco** = anillo `--crm-focus` (§9).
- Nada de colores de paleta de Tailwind (`emerald-500`, `red-50`…) en CRM 2.0: los 131 usos legacy se reemplazan por tokens al migrar.

### 3.3 Contraste medido (no estimado)

Lo calcula `src/lib/contrasteCrm.ts` leyendo el `crm.css` real (compone los tintes y estados semitransparentes sobre su fondo) y lo
exige `src/lib/contrasteCrm.check.ts` en `npm test`: si un par baja del mínimo, el test falla con el nombre del par. Mínimos:
**texto 4.5:1**; **componentes de UI, bordes de control, indicadores de estado y foco 3:1** (WCAG 1.4.3 y 1.4.11).

Además `auditarTokens` falla si un color del claro **no se redefine en oscuro** (heredaría el valor claro en silencio; excepciones
explícitas en `IGUAL_EN_OSCURO`, hoy ninguna) o si un color **no está en ningún par** (excepciones con motivo en `SIN_PAR`:
`--crm-border` decorativo, `--crm-scrim`, `--crm-skeleton`, `--crm-text-disabled`). Así un color nuevo no entra sin medirse.

Tabla regenerable con:
`node -e "import('./src/lib/contrasteCrm.ts').then(async m => console.log(m.tablaMarkdown((await import('node:fs')).readFileSync('src/app/(app)/crm.css','utf8'))))"`

| Par | Mínimo | Claro | Oscuro |
|---|---|---|---|
| --crm-text / canvas | 4.5:1 | 15.94 | 15.95 |
| --crm-text / panel | 4.5:1 | 16.96 | 14.70 |
| --crm-text / panel-2 | 4.5:1 | 15.27 | 13.36 |
| --crm-text / hover sobre panel | 4.5:1 | 15.07 | 12.20 |
| --crm-text / pressed sobre panel | 4.5:1 | 13.88 | 10.80 |
| --crm-text / fila seleccionada | 4.5:1 | 14.64 | 11.60 |
| --crm-text / seleccionada + hover | 4.5:1 | 13.04 | 9.51 |
| --crm-text-2 / canvas | 4.5:1 | 6.43 | 8.46 |
| --crm-text-2 / panel | 4.5:1 | 6.84 | 7.79 |
| --crm-text-2 / panel-2 | 4.5:1 | 6.16 | 7.08 |
| --crm-text-2 / hover sobre panel | 4.5:1 | 6.07 | 6.47 |
| --crm-text-2 / pressed sobre panel | 4.5:1 | 5.60 | 5.73 |
| --crm-text-2 / fila seleccionada | 4.5:1 | 5.90 | 6.15 |
| --crm-text-2 / seleccionada + hover | 4.5:1 | 5.26 | 5.04 |
| accent-text / panel | 4.5:1 | 6.75 | 8.64 |
| accent-text / canvas | 4.5:1 | 6.34 | 9.38 |
| accent-text / panel-2 | 4.5:1 | 6.08 | 7.86 |
| accent-text / seleccionada | 4.5:1 | 5.83 | 6.82 |
| on-accent / accent (botón primario) | 4.5:1 | 6.34 | 7.28 |
| on-accent / accent-hover | 4.5:1 | 8.57 | 9.08 |
| on-danger / danger (botón destructivo) | 4.5:1 | 7.01 | 7.24 |
| on-danger / danger-hover | 4.5:1 | 8.65 | 8.94 |
| success / success-tint sobre panel | 4.5:1 | 6.06 | 7.25 |
| success / success-tint sobre canvas | 4.5:1 | 5.72 | 7.98 |
| success / panel | 4.5:1 | 6.83 | 8.44 |
| success / canvas | 4.5:1 | 6.42 | 9.16 |
| warning / warning-tint sobre panel | 4.5:1 | 6.00 | 7.74 |
| warning / warning-tint sobre canvas | 4.5:1 | 5.66 | 8.51 |
| warning / panel | 4.5:1 | 6.76 | 9.04 |
| warning / canvas | 4.5:1 | 6.36 | 9.81 |
| danger / danger-tint sobre panel | 4.5:1 | 6.12 | 5.69 |
| danger / danger-tint sobre canvas | 4.5:1 | 5.77 | 6.23 |
| danger / panel | 4.5:1 | 7.01 | 6.40 |
| danger / canvas | 4.5:1 | 6.59 | 6.94 |
| info / info-tint sobre panel | 4.5:1 | 6.06 | 7.22 |
| info / info-tint sobre canvas | 4.5:1 | 5.71 | 7.94 |
| info / panel | 4.5:1 | 6.83 | 8.41 |
| info / canvas | 4.5:1 | 6.43 | 9.13 |
| text / success-tint (texto del banner) | 4.5:1 | 15.05 | 12.64 |
| text / danger-tint (texto del banner) | 4.5:1 | 14.82 | 13.07 |
| text / warning-tint (texto del banner) | 4.5:1 | 15.05 | 12.59 |
| text / info-tint (texto del banner) | 4.5:1 | 15.04 | 12.62 |
| on-inverse / inverse (tooltip) | 4.5:1 | 13.64 | 14.32 |
| border-strong / panel (borde de input, checkbox) | 3:1 | 3.52 | 3.57 |
| border-strong / canvas | 3:1 | 3.30 | 3.88 |
| border-strong / panel-2 | 3:1 | 3.17 | 3.25 |
| focus / panel (anillo de foco) | 3:1 | 4.99 | 8.33 |
| focus / canvas | 3:1 | 4.69 | 9.04 |
| focus / panel-2 | 3:1 | 4.49 | 7.57 |
| focus / fila seleccionada | 3:1 | 4.31 | 6.58 |
| accent / panel (check, switch, barra de selección) | 3:1 | 6.34 | 6.74 |
| accent / canvas | 3:1 | 5.96 | 7.32 |
| accent / fila seleccionada (barra de 2 px) | 3:1 | 5.48 | 5.32 |
| accent / seleccionada + hover (barra) | 3:1 | 4.88 | 4.36 |
| accent / item activo de menú o lista (barra) | 3:1 | 5.19 | 4.96 |
| accent / panel-2 (borde del segmento elegido) | 3:1 | 5.71 | 6.13 |
| accent-text / pressed (página o segmento activo) | 4.5:1 | 5.52 | 6.35 |
| on-accent / accent (tilde del checkbox) | 3:1 | 6.34 | 7.28 |
| danger / panel (borde de campo con error) | 3:1 | 7.01 | 6.40 |
| text-2 / panel (ícono secundario) | 3:1 | 6.84 | 7.79 |

Ajustes respecto de los valores de partida de la Fase 6: el borde de controles (`--crm-border-strong`) bajó de L 78 % a 52 %
(oscuro: 30 % → 44 %) porque el de partida daba **1.65:1** sobre blanco y no identifica un input (WCAG 1.4.11 pide 3:1). El
secundario (`--crm-text-2`) de partida ya pasaba; se bajó a L 34 % para tener margen con los tintes de estado más fuertes. En la
revisión de la Etapa 1 se subieron hover (4 → 6 %), activo (8 → 10 %) y seleccionado (7 → 10 %; oscuro 10 → 14 %) y se sumaron
los pares de las barras y bordes indicadores; el par más justo es el foco sobre una fila seleccionada (4.3:1 contra 3:1).

---

## 4. Tipografía

- **Familias:** IBM Plex Sans 400/500/600 (interfaz) + IBM Plex Mono 400/500/600 (cifras, identificadores, códigos). Cargadas con
  `next/font` en `CrmRoot` como `--font-crm-sans` / `--font-crm-mono`; expuestas como `--crm-font-sans` / `--crm-font-mono`.
  La landing y el login no las descargan. **Varela Round no aparece en el CRM** (queda solo en el lockup del logo).
- **Escala** (`TYPE` en `cx.ts`):

| Rol | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `meta` | 12 / 16 | 400 | Ayuda, metadatos, fechas relativas. **Mínimo absoluto.** |
| `th` | 12 / 16, sentence case | 500 | Cabeceras de tabla, en `--crm-text-2`, sobre una regla de 1 px fuerte |
| `table` | 13 / 18 | 400 (500 en el nombre de la entidad) | Cuerpo de tabla, labels de formulario |
| `ui` | 14 / 20 | 400 / 500 | Interfaz base, botones, inputs (desktop) |
| `section` | 16 / 24 | 600 | Título de sección, de drawer y de diálogo |
| `title` | 20 / 28, tracking −.01em | 600 | Título de página (h1). Nada más grande salvo cifras |
| `kpi` | 28 / 36, mono | 500 | Solo cifras de KPI (StatStrip) |

- **Números:** `tabular-nums` en toda cifra; en columnas, mono y alineadas a la derecha. Identificadores (CUIT, teléfono, número de
  presupuesto, códigos) en mono. Las **unidades** (pesos, `u.`, `%`, `d`) van en `--crm-text-2` al lado de la cifra
  (`TYPE.unit`, `CellNumber unit`): se lee el número y las columnas alinean por los dígitos.
- **Mayúsculas:** sentence case en todo (títulos, botones, tabs, cabeceras de tabla). Sin mayúsculas sostenidas ni versalitas.
- **Prosa** (notas, descripciones largas): interlínea 1.55 y `max-w-prose`.
- **Mobile:** inputs a **16 px** (evita el zoom de iOS al enfocar); 14 px desde `sm`.
- Excepción documentada: iniciales del `Avatar` a 10–11 px (decorativo, `aria-hidden`, el nombre va escrito al lado).

---

## 5. Espaciado y densidad

- **Base 4 px.** Escala usada: 4 · 8 · 12 · 16 · 24 · 32 · 48 (Tailwind `1 2 3 4 6 8 12`). Nada de 10, 14, 20, 40 sueltos como
  espaciado (28 y 36 son alturas de control, no espacios).
- **Medios pasos permitidos (los únicos):** **2 px** (`0.5`: ajuste óptico de un ícono contra la primera línea, inset del thumb
  del switch, gap entre botones de ícono pegados) y **6 px** (`1.5`: gap ícono–texto en controles de 28, padding horizontal de
  badges, tags, chips y del número de página, padding vertical del textarea para que una línea mida 32 como un input).
- **Alturas fijas:**

| Elemento | Alto |
|---|---|
| Fila de tabla | **36** (única; sin toggle de densidad) |
| Cabecera de tabla | 32 |
| Control (input, select, botón) | **32**; compacto 28 (toolbars, filas, paginación, chips); grande 36 (footers en mobile) |
| Item de menú / opción de lista | 32 |
| Tab | 40 (subrayado de 2 px) |
| Header de panel | 40 |
| Header de drawer | 56 |
| Topbar (Etapa 2) | 48 |
| Barra de página (PageBar) | 48 |
| Rail (Etapa 2) | 216 expandido / 52 colapsado |

- **Padding:** celda 12 horizontal; input y botón `md` 12; botón `sm` 8; chip 8 / 6; panel 12; drawer 16; diálogo 20; banner y
  toast 12 × 8. Gap entre controles de toolbar 8; entre campos 16.

---

## 6. Layout y grillas

- **Shell (Etapa 2):** rail a la izquierda + topbar de 48 + área de trabajo a ancho completo (sin `max-w-7xl` centrado).
- **Área de trabajo de una lista:** PageBar (48) → Toolbar pegada (40) → DataTable que ocupa el alto restante con scroll propio
  (header fijo) → paginación. Padding del área: 16 (24 desde `xl`).
- **Master-detail (≥ 1280 px):** grilla + `PreviewPanel` a la derecha (≈ 400 px, borde izquierdo, sin sombra). La selección vive en
  la URL (`?sel=`). Debajo de 1280 no hay panel: la fila navega a la ficha.
- **Ficha (detalle):** `DetailHeader` + `Tabs` por URL + contenido. Cuerpo en 1 o 2 columnas (`DefinitionList` de 2 columnas
  desde 640 px de contenedor); paneles solo donde agrupan.
- **Formularios:** en Drawer; contenido hasta 640 px; una columna (dos solo para pares cortos como CUIT/Teléfono).
- **Ancho máximo:** contenido fluido hasta 1600 px; prosa `max-w-prose`; dashboards en 12 columnas con gutter 16.
- **Container queries** antes que media queries para lo que vive en paneles de ancho variable (grilla, `DefinitionList`).

---

## 7. Superficies, elevación y capas

| Nivel | Superficie | Borde | Sombra | Radio |
|---|---|---|---|---|
| Canvas | `--crm-canvas` | — | no | — |
| Panel / tabla | `--crm-panel` | `--crm-border` 1 px | **no** | 6 |
| Cabecera de tabla | `--crm-panel` | regla inferior `--crm-border-strong` | no | — |
| Control | `--crm-panel` | `--crm-border-strong` | no | 4 |
| Flotante (menú, popover, select, toast) | `--crm-panel` | `--crm-border` | `--crm-shadow-float` | 6 |
| Drawer / diálogo | `--crm-panel` sobre `--crm-scrim` | `--crm-border` | `--crm-shadow-float` | 0 / 6 |
| Tooltip | `--crm-inverse` | — | no | 4 |

- Radios: **4** controles, badges, chips y avatares (cuadrados con tinte neutro), **6** paneles y capas; círculo solo en puntos de
  estado y radios.
- Una sola sombra (`--crm-shadow-float`), suave, solo en capas flotantes. Nunca en reposo, nunca al hover.
- **Capas (`--crm-z-*`):** sticky 10 · rail 30 · drawer 50 · diálogo 60 · popover/menú/select 70 · toast 80 · tooltip 90.
  Obligatorias porque `[data-crm]` y `#crm-portal` son `display: contents` (no crean contexto de apilamiento). Un select dentro de
  un drawer queda encima (70 > 50); una confirmación sobre un drawer también (60 > 50).
- **Portales:** todo lo flotante va a `#crm-portal` con `CrmPortal` (`src/components/crm/portal.tsx`) y `position: fixed`. Si el
  portal no está montado, se dibuja en el lugar (nunca a `body`, donde no hay tokens) y en desarrollo avisa por consola: es un
  error de montaje (falta `CrmRoot`), no un modo de uso.

---

## 8. Iconografía

- **lucide-react**, 16 px (`size-4`), `strokeWidth={1.75}`; 14 px solo dentro de texto de 12–13 (chevron del chip, error de campo).
- Siempre `aria-hidden="true"`; el significado lo da el texto o el `aria-label` del botón.
- Botón de solo ícono: `IconButton` con `label` obligatorio (nunca `title=`: lo captura el TooltipHost legacy y además rompe la
  hidratación de la página). Para mostrar el nombre al hover, `<Tooltip>`.
- **Íconos de equipamiento** (`components/Equipamiento.tsx`): solo como contenido de dominio (tipo de producto en una fila), nunca
  como decoración de títulos ni de empty states.
- Un ícono por acción como máximo; los títulos no llevan ícono.

---

## 9. Estados y movimiento

### 9.1 Estados

| Estado | Tratamiento |
|---|---|
| Hover | Fondo `--crm-hover` (6 %); en controles, borde a `--crm-text-2`. Sin sombra, sin desplazamiento. |
| Activo de teclado (menú/listbox) | `--crm-pressed` (10 %) + barra izquierda de 2 px `--crm-accent` vía `data-active` (la barra cumple 3:1) |
| Foco | `:focus-visible` → `outline 2px --crm-focus`, offset 1 (`FOCUS`). Igual en **todos** los controles. Tabs: offset −2. |
| Seleccionado (fila) | `--crm-selected` + barra izquierda de 2 px `--crm-accent` + `aria-current="true"` |
| Seleccionado (tab / ítem de nav) | Texto `--crm-text` + subrayado/barra de 2 px de acento |
| Seleccionado (segmentado, página actual) | Texto `--crm-accent-text` + borde de 1 px `--crm-accent` (no solo un relleno: 1.1:1 no se ve) |
| Filtro aplicado (FilterChip) | Valor en `--crm-accent-text` 500; el chip sigue sólido de hairline |
| Deshabilitado | Opacidad 45 % + `cursor: not-allowed` (`DISABLED`); en menús `aria-disabled` (sigue enfocable) |
| Cargando | Esqueletos `aria-hidden` + `aria-busy="true"` en la región + `LoadingStatus` ("Cargando…", §13.2); en botones `loading` (ícono girando, texto "Guardando…", deshabilitado) |
| Error de campo | Borde `--crm-danger` (`aria-invalid`), mensaje de 12 px con ícono debajo, `role="alert"` |
| Error de región | `InlineBanner tone="danger"` (`role="alert"`) con una acción ("Reintentar") |
| Vacío | `EmptyState`: título + una línea + una acción; distinto para "primera vez" y "sin resultados" (con eco de la búsqueda) |

### 9.2 Movimiento

- Duraciones: **120 ms** hover/foco (`--crm-dur-fast`), **160 ms** popovers y diálogos (`--crm-dur`), **200 ms** drawer
  (`--crm-dur-slow`). Easing `cubic-bezier(.2, 0, 0, 1)` (ease-out). Las animaciones usan los tokens; el desmontaje del drawer y
  del diálogo espera el mismo valor en JS (`usePresence(open, 200|160)`, comentado junto al token).
- Entradas: `crm-fade` (opacidad), `crm-pop` (opacidad + 2 px), `crm-slide-in-right` (drawer, 16 px). Salidas: la misma en reverso.
- Sin movimiento decorativo: nada de scroll reveal, parallax, partículas ni loops (salvo el pulso del esqueleto).
- `prefers-reduced-motion: reduce` → `motion-reduce:animate-none` / `transition-none` en todo primitivo.

---

## 10. Componentes

Los de §10.1–§10.10 están construidos en `src/components/crm/` y se ven en `/crm-lab` (solo desarrollo). Los marcados **(server-safe)**
no tienen `"use client"` ni hooks y se pueden usar desde server components (el laboratorio dibuja una DataTable con links y
tooltips de recorte desde su página servidor); los demás son de cliente. §10.11 es el shell (Etapa 2, construido); §10.12 en adelante es **especificación** para
las Etapas 2 y 3.

### 10.1 Button, IconButton, FilterChip — `Button.tsx` (server-safe)
- Variantes: `primary` (acento sólido; **una por pantalla**), `secondary` (panel + hairline; la normal), `ghost` (sin caja; acciones
  terciarias), `danger` (solo destruir/dar de baja). Tamaños `sm` 28 · `md` 32 · `lg` 36. Ícono 16 a la izquierda (`icon`).
- `loading`: deshabilita, `aria-busy`, cambia el ícono por el indicador; el texto lo cambia quien llama ("Guardando…").
- `IconButton`: cuadrado 28/32, `label` obligatorio → `aria-label`. `buttonClass()` para `<Link>` con forma de botón.
- `FilterChip`: disparador de un `Popover` en la toolbar (spec en §10.12).

### 10.2 Campos — `Field.tsx` (server-safe), `Select.tsx`
- `Field` cablea label (arriba, 13/500), ayuda (12, secundaria) y error (12, danger, `role="alert"`) con `aria-describedby`,
  `aria-invalid` y `required`; el control se dibuja con las props que recibe, así los ids (`#nombre`, `#empresa_id`…) quedan intactos.
- `Input` 32 (28 `dense`), `Textarea` (resize vertical), `Checkbox`, `Radio` + `RadioGroup` (fieldset/legend), `Switch`
  (`role="switch"`): **nativos** con apariencia propia — teclado, formularios y lectores de pantalla sin código extra.
- Borde `--crm-border-strong`, radio 4, el mismo anillo de foco; obligatorio = asterisco visual + `required`.
- `Select`: combobox de solo selección (APG), lista en portal, mismo contrato que `ui/Select` (`value/onChange/options/searchable/
  id/aria-*`) + `color` y `disabled` por opción, `required` (→ `aria-required`), `aria-invalid` y `aria-describedby` (los pasa
  `Field`). Buscador automático con más de 8 opciones. Clic en su `<label>`: enfoca sin abrir la lista.
- Montos: `MoneyInput` de siempre (nunca `type="number"`).

### 10.3 Menu, Popover — `Menu.tsx`, `Popover.tsx`
- `Menu`: `⋮` (nombre = `label`, p. ej. "Acciones de Complejo La Tablada") o botón con texto ("Más acciones"). `role="menu"` +
  `menuitem`; destructivo en danger y último; deshabilitado con `aria-disabled`. Panel ≥ 176 px, items de 32; item activo con
  tinte y barra de acento. Con texto: `triggerLabel` (nombre si el contenido no lo da), `variant`, `triggerClassName`; `header` =
  bloque de solo lectura arriba de los items (UserMenu: nombre, rol · organización), que el teclado saltea.
- `Popover`: panel no modal `role="dialog"` con nombre; para FilterChip y ayudas con controles. Ancho 288.

### 10.4 Tooltip — `Tooltip.tsx`
- Texto corto, `--crm-inverse`, 12 px, máx. 288 px. Hover 250 ms o foco; Escape lo cierra **solo a él** (`preventDefault`: el
  drawer o diálogo de abajo sigue abierto hasta el siguiente Escape); se puede pasar el mouse encima (WCAG 1.4.13).
  `onlyWhenTruncated` para celdas recortadas; `disabled` (no aparece, mismo markup) y `side="right"` (rail colapsado). Nunca
  información que no esté en otro lado.

### 10.5 StatusDot, StatusBadge, Tag, Avatar — `Status.tsx` (server-safe)
- `StatusDot`: punto 8 + palabra (tono semántico) o cuadradito + palabra (`color` de la organización). El uso por defecto.
- `StatusBadge`: alto 20, radio 4, tinte 8 % + texto del tono; para lo que tiene que saltar en una fila densa (vencida).
- `Tag`: neutra, solo borde, 12 px. `Avatar`: iniciales en un cuadrado de radio 4 (20/24/32) con tinte neutro y hairline
  interior; decorativo. Nada de círculos de colores.

### 10.6 Panel, DefinitionList — `Panel.tsx` (server-safe)
- `Panel`: borde + header de 40 con título (14/600) y acciones `sm`; `flush` para tablas. **Nunca un panel dentro de otro.**
- `DefinitionList`: `dl` con término 12 secundario arriba y valor 14; 1 o 2 columnas por ancho de contenedor; vacío = "—";
  `mono` para identificadores.

### 10.7 Tabs, SegmentedControl — `Tabs.tsx`
- `Tabs`: subrayado de 2 px, 40 de alto, contador opcional en mono. **Por URL** (`?tab=`, un `<Link>` por tab, activación manual
  con Enter **o Espacio**) o controladas (activación automática). `TabPanel` con `role="tabpanel"`, lo puede dibujar el servidor.
  Una sola implementación.
- `SegmentedControl`: 2–4 vistas (Tablero/Lista); `radiogroup`, 28/32 de alto; el elegido en panel con texto y borde de acento.

### 10.8 Drawer, Dialog, ConfirmDialog, Toast — `Drawer.tsx`, `Dialog.tsx`, `Toast.tsx`
- `Drawer`: derecha, **480** (`md`) / **640** (`lg`, empresa), ancho completo en mobile. Header fijo de 56 (título 16/600,
  descripción 12, "Cerrar panel"), cuerpo con scroll, footer fijo (secundario + primario a la derecha; en mobile apilados, el
  primario arriba). `onSubmit` envuelve cuerpo y footer en `<form>`. `busy` impide cerrar a mitad de una mutación.
  Secciones con `FormSection` (título 13/600 + divisor), **sin cajas**.
- `Dialog`: solo confirmaciones y cierre de oportunidad, ≤ 440, título 16, acciones abajo a la derecha. `role="dialog"`.
- `ConfirmDialog`: `role="alertdialog"`, foco inicial en "Cancelar", espera `onConfirm` sin poder cerrarse. **Ojo:** "Marcar como
  perdida" y "Cambiar de etapa" hoy son `role="dialog"` para E2E: se migran con `Dialog`, no con `ConfirmDialog`.
- `Drawer` y `Dialog` bloquean el scroll del documento mientras están abiertos (con contador: anidados no lo liberan antes).
  `[data-app-main]` no se toca: el scrim tapa la rueda, el foco está atrapado y esconder su barra correría el layout.
- `Toast` (`CrmToastProvider` + `useCrmToast`, misma firma que `useToast`): abajo a la derecha, 360 px, panel con borde y sombra,
  padding 12 × 8; tono por ícono. **Dos regiones vivas siempre montadas** (vacías desde la hidratación): `role="status"`
  `aria-live="polite"` (éxito/info/atención) y `role="alert"` `aria-live="assertive"` (error); el aviso se inserta adentro y no
  lleva rol propio. 4 s, pausa con hover/foco; link opcional; "Cerrar notificación". Lo monta el shell (`AppFrame`) para todo el CRM.

### 10.9 Skeleton, LoadingStatus, InlineBanner, EmptyState — `Feedback.tsx` (server-safe)
- `Skeleton`: barra `--crm-skeleton` con pulso lento, `aria-hidden`; la región lleva `aria-busy` y un `LoadingStatus`
  (`role="status"` invisible "Cargando…", contrato de §13.2). `TableSkeleton` ya lo trae (`label="Cargando empresas…"`).
- `InlineBanner`: tinte 8 % + borde del tono al 25 %, ícono y título en el tono, texto en `--crm-text`, una acción a la derecha.
- `EmptyState`: título + una línea + **una** acción. Sin ilustraciones. `compact` dentro de tablas y paneles.

### 10.10 DataTable, Pagination — `DataTable.tsx` (server-safe), `Pagination.tsx`
- `DataTable` (`label` = nombre accesible): `table-fixed`, filas 36, sin cebra, hover tonal, hairlines; header fijo en la
  superficie de las filas, 12/500 secundario en sentence case, con una regla de 1 px `--crm-border-strong` debajo (la línea de un
  libro mayor; el contenedor scrollea: darle alto). Columnas: `Th width` fijo para estado/cifras/acciones; `hideBelow` esconde por
  ancho del **contenedor**. Celdas: `CellText` (una línea, tooltip si se recorta, `href` para el nombre), `CellNumber` (mono, a la
  derecha, `unit` en gris antes o después), `CellStatus`, `CellPerson`, `CellDate` (`<time>`), `CellActions` (rápidas al
  hover/foco de la fila, `⋮` siempre visible; todo visible en táctil). Estados: `TableSkeleton`, `TableMessage` +
  `EmptyState`/`InlineBanner`, `busy` → `aria-busy`. Seleccionada: `Tr selected`. **Sin** orden por columna, selector de
  columnas ni densidad.
- `Pagination`: contrato idéntico a `Paginacion` (ver §13.2), con `ir` para transiciones y `pageSizeControl` para "Filas por
  página"; la página actual con texto y borde de acento.

### 10.11 Shell (Etapa 2, construido) — `src/components/crm/shell/`
`AppFrame` (lo monta `(app)/layout.tsx` para TODO el CRM) = `Rail` + `Topbar` (con `UserMenu`) + `Crumbs` + `CommandPalette`; la
lógica pura (cookie del rail, ruta → migas) está en `logica.ts` (probada en `logica.check.ts`).
- **Raíz:** grilla `[rail | topbar / main]` de alto `100dvh`; `data-app-shell` en la grilla, `data-app-chrome` en rail, topbar, cajón,
  paleta, avisos y el link de salto, `data-app-main` en el `<main id="contenido">` que scrollea. Sin envoltorios entre la grilla y el
  main: las reglas `@media print` de `globals.css` siguen alcanzando. Plex se aplica solo al chrome (`UI_ROOT` en rail, topbar y capas);
  el contenido legacy conserva la fuente global. Primer enfocable: "Saltar al contenido" (aparece con el foco).
- **Rail** (216 / 52): fondo `--crm-panel`, borde derecho; marca arriba en 48 (GoalMark en acento + "Tuco & Nito" 15/600 y, debajo, el nombre de la organización en 12 secundario —el que ya trae la
  sesión—; link a `/`).
  Secciones Comercial · Operación · Análisis · Administración desde `lib/navegacion.ts` (`seccionesVisibles`, mismos permisos; una
  sección vacía no aparece), rótulo 12/500 secundario (colapsado: un divisor), `role="group"` con `aria-label`. `nav
  aria-label="Secciones"`; cada link lleva `aria-label` con su nombre (así el nombre accesible no cambia al colapsar) y
  `aria-current="page"`. Ítem de 32: ícono 16 en una columna de 36 + texto 14; activo = fondo `--crm-selected` + texto
  `--crm-accent-text` 500 + barra izquierda de 2 px en acento; hover tonal. Sin contadores. Colapsar/expandir ARRIBA: un `IconButton` "Colapsar menú" /
  "Expandir menú" (`aria-expanded`, `aria-controls` = el `aside`) en la franja de la marca (expandido) o en su fila debajo
  (colapsado); es el mismo elemento, así que el foco del teclado no se pierde al alternar. Colapsado: solo íconos con
  `Tooltip side="right"`.
- **Persistencia del rail:** cookie `crm-rail=collapsed|expanded` (1 año, `SameSite=Lax`), escrita al alternar y **leída en el
  servidor** por `(app)/layout.tsx`: el primer pintado ya sale bien, sin parpadeo ni diferencia de hidratación (con `localStorage` el
  servidor no la sabría). Cualquier otro valor = expandido.
- **Estados de `(crm2)`:** `(crm2)/loading.tsx` (esqueleto de barra + grilla, `aria-busy`, `LoadingStatus` "Cargando…") y
  `(crm2)/error.tsx` (`InlineBanner` danger con "Reintentar" → `retry`), dentro del área de trabajo: el shell sigue usable.
  Un error en el propio layout de `(app)` (sesión, shell) no tiene boundary propio: cae en el de Next (igual que antes).
- **Responsive:** ≥ 1280 la preferencia; 768–1279 siempre 52 (sin botón de colapso); < 768 el rail no está y se abre como cajón
  izquierdo desde la hamburguesa ("Abrir menú"; `dialog` "Menú", foco atrapado, Escape y fondo cierran, el foco vuelve; cualquier
  cambio de ruta lo cierra —link, atrás del navegador, gesto de Android—; si la ventana crece a ≥ 768 se cierra solo). Todo el ancho lo resuelve CSS (el HTML del servidor es igual en cualquier ancho).
- **Topbar** (48, `--crm-panel`, borde inferior): migas (o el nombre de la pantalla) a la izquierda; a la derecha, juntas, las
  herramientas globales: búsqueda (botón con forma de campo de 224/288, "Buscar…" + `Ctrl K`/`⌘ K`, nombre "Buscar",
  `aria-keyshortcuts`), tema ("Modo claro. Cambiar a modo oscuro", mismo mecanismo:
  clase `dark` + `localStorage.theme`) + UserMenu a la derecha. Mobile: hamburguesa, nombre de la sección, búsqueda (ícono) y UserMenu.
- **UserMenu:** `Menu` con disparador Avatar (+ nombre desde `lg`), nombre "Menú de usuario (<nombre>)" y descripción
  accesible "rol · organización"; arriba del menú, FUERA del `role="menu"` y referenciado por `aria-describedby`, nombre y
  "rol · organización"; ítems "Cambiar a modo oscuro/claro" y "Cerrar sesión" (danger) → `ConfirmDialog` "Cerrar sesión" (mismo texto de
  siempre) → POST a `/auth/signout`. Igual en mobile (que antes no tenía tema ni salir).
- **Breadcrumb:** `nav aria-label="Ruta de navegación"` + `ol`; 13 px, separador `›` decorativo, la última miga `aria-current="page"`
  sin link; recorte con tooltip. En una pantalla de primer nivel (una sola miga) no hay trail: solo su nombre como título
  discreto (14/500, `aria-current="page"`, sin `nav`). Las migas salen de la ruta (`migas()`); la
  página aporta solo el nombre de su ficha con `<CrumbLabel>{nombre}</CrumbLabel>` (server-safe de usar: no dibuja nada); sin él la
  ficha dice "Ficha". El nombre llega con la hidratación y queda recordado por href.
- **Búsqueda global (`CommandPalette`):** mismo comportamiento y contrato ARIA que la paleta anterior (ver §13.2), lógica de
  `lib/paleta.ts` y Server Action `buscarGlobal`; en `#crm-portal`. Ctrl/Cmd+K se ignora con otro `aria-modal` abierto y con `repeat`.
- `CrmToastProvider` montado en el shell; `CrmRoot` precarga Plex Sans (README).

### 10.12 Especificaciones para la Etapa 3 (composiciones)
- **PageBar** (48): breadcrumb opcional · h1 20/600 · contador en mono secundario · acción primaria a la derecha. Sin descripción.
- **Toolbar** (40, pegada a la grilla): búsqueda (textbox "Buscar empresa o contacto", 28 de alto, 256 de ancho) + FilterChips +
  "Limpiar" (ghost, solo si hay filtros) + acciones secundarias a la derecha. Los chips se reacomodan (wrap), nunca se recortan.
- **FilterChip** (construido: `FilterChip` en `Button.tsx`): botón de 28, sólido, hairline `--crm-border`, fondo panel. Sin valor:
  "Estado ▾"; con valor: "Estado:" en secundario y el valor en `--crm-accent-text` 500 ("Estado: **Activo** ▾"). Sin bordes
  punteados ni rellenos de color. Abre un `Popover` con el control; aplica al elegir (o "Aplicar" si hay varios).
- **DetailHeader**: breadcrumb · h1 con el nombre de la entidad · StatusDot · responsable (Avatar + nombre) · identificadores en mono
  · **una** primaria (Registrar actividad) + `Menu` "Más acciones" con el resto. Debajo, `Tabs` por URL. Reemplaza los 4 headers copiados.
- **PreviewPanel** (≥ 1280, ≈ 400 px): header con nombre + "Cerrar vista previa" (Esc), StatusDot, acciones (Registrar actividad,
  Editar, Dar de baja), `DefinitionList` de 1 columna, resumen, últimos movimientos, "Abrir ficha completa →". ↑/↓ mueve la selección.
- **StatStrip**: franja de 3–5 KPIs en una fila con divisores verticales (no cards): etiqueta 12 secundaria + cifra `kpi` mono con
  unidad en gris + delta opcional con palabra. Solo cifras que ya existen.
- **Stepper de etapas** (oportunidad): segmentos con el color de la etapa como cuadradito, actual con barra de acento; clic = el
  mismo "Cambiar etapa".

---

## 11. Interacción y teclado

- **Foco visible siempre** con teclado; nunca `outline: none` sin reemplazo. Orden de Tab = orden visual.
- **Capas modales** (drawer, diálogo): foco al primer campo del cuerpo (o `data-autofocus`), Tab atrapado, Escape cierra, el foco
  vuelve al disparador. Clic en el fondo cierra (si se apretó y soltó en el fondo).
- **Cerca de foco:** si desde una capa portalizada que abrió el drawer (menú, select, popover) un Tab saca el foco a la página,
  vuelve al drawer. Ningún Tab se escapa de una capa modal.
- **Grupos de radios** son una sola parada de Tab (el marcado, o el primero): la trampa de foco de drawers y popovers los cuenta así.
- **Pila de capas** (`useLayer`): Escape y clic afuera los atiende solo la capa de arriba (un select abierto en un drawer se cierra
  sin cerrar el drawer). Escape queda con `preventDefault` para que ninguna otra capa (tampoco las legacy) lo atienda dos veces.
  El tooltip también: su Escape no cierra la capa de abajo.
- **Menú:** Enter/Espacio/↓ abren en el primero, ↑ en el último; ↑/↓/Home/End; tipear salta (buffer de 500 ms: "re" va a
  "Registrar"); Escape y Tab cierran y devuelven el foco; al elegir, el foco vuelve al disparador antes de ejecutar.
- **Select:** ↑/↓/Enter/Espacio abren en la opción elegida; ↑/↓/Home/End mueven (`aria-activedescendant`); tipear salta (mismo
  buffer); Enter elige; Escape cierra sin cambiar; las deshabilitadas se saltan. Clic en su label: enfoca sin abrir.
- **Tabs:** ←/→/Home/End; por URL activación manual (Enter o Espacio), controladas automática. **Segmentado:** flechas mueven y eligen.
- **Popover:** foco al primer control; Escape o salir con Tab cierran y vuelven al disparador.
- **Grilla (Etapa 3):** ↑/↓ mueve la selección, Enter abre la ficha, Esc cierra la vista previa.
- Ctrl/Cmd+clic y botón del medio en links de lista y paginación abren donde la persona quiere (son links reales).
- La lógica pura de teclado está en `src/components/crm/teclado.ts` (probada en `teclado.check.ts`).

---

## 12. Contenido y microcopy

- **Voz:** español rioplatense con voseo, concreto y sin exclamaciones ("Registrá la actividad", "Revisá la conexión").
- **Botones:** verbo + objeto ("Nueva empresa", "Dar de baja", "Guardar"). En curso: gerundio + "…" ("Guardando…").
- **Errores:** qué pasó + qué hacer ("No se pudo cargar la lista. Revisá la conexión y volvé a intentar."). Nunca el error técnico.
- **Vacíos:** "Todavía no cargaste empresas." (primera vez) vs "No hay empresas que coincidan con «la tablada»." (búsqueda).
- **Formatos es-AR:** miles con punto, decimales con coma; moneda con el signo pesos en gris y la cifra mono (`CellNumber unit`);
  fecha `04/10/2026` (`formatFecha` / `formatFechaAlta`, zona Buenos Aires); hora 24 h; rangos con raya en ("Mostrando 21–40 de
  134"). Los formateadores son los de `lib/` (no se duplican).
- **Truncado:** una línea con "…" y tooltip con el texto completo; nunca se trunca una cifra ni un estado.
- Ausencia de dato: "—" (no "N/A", no vacío).

---

## 13. Accesibilidad

### 13.1 Reglas
- Contraste: texto ≥ **4.5:1**; componentes de UI, bordes de control, indicadores de estado y foco ≥ **3:1** — medido en §3.3 y
  verificado por `npm test`.
- Estado nunca solo por color ni solo por un tinte; íconos `aria-hidden`; botones de ícono con nombre; un `h1` por pantalla.
- Regiones que cargan con `aria-busy` + `LoadingStatus`; errores de región `role="alert"`; avisos `role="status"`.
- Objetivos táctiles: 28 px mínimo en desktop denso; en mobile los controles crecen a 36 y los inputs a 16 px de texto.
- `prefers-reduced-motion` respetado; nada parpadea.

### 13.2 Contratos de accesibilidad preservados

Los usan los E2E (`e2e/`), las guardas (`scripts/guard/`) y el manual (`scripts/manual/`). Ningún cambio visual puede romperlos:

- `nav` **"Secciones"** con los links de cada pantalla por su nombre ("Configuración", "Usuarios"…).
- `h1` con el nombre de la entidad o de la pantalla ("Empresas").
- Texto **`Mostrando N–M de T`** (con raya en); `nav` **"Paginación"**, links **"Página N"** con `aria-current="page"`,
  **"Página anterior" / "Página siguiente"**, select **"Filas por página"**.
- Textbox **"Buscar empresa o contacto"**; diálogo **"Buscar en el CRM"** con combobox **"Buscar"**.
- Diálogos nombrados: **"Nueva empresa"**, **"Nuevo contacto"**, **"Nueva oportunidad"**, **"Marcar como perdida"**,
  **"Cambiar de etapa"** (estos dos, `role="dialog"`).
- Ids de campo: `#nombre`, `#apellido`, `#titulo`, `#empresa_id`, `#cambio_etapa`, `#cambio_observacion`, `#motivo_perdida`…
- Botones **"Nueva empresa"**, **"Nueva oportunidad"**, **"Guardar"**, **"Marcar perdida"**, **"Mover"**, **"Agregar"**,
  **"Agregar línea libre"**, **"Imprimir / Guardar PDF"**; **"Cerrar panel"** (drawer), **"Cerrar notificación"** (toast).
- Menú **`Acciones de <nombre>`** con `menuitem` ("Ver detalle", "Cambiar etapa"…); opciones de lista `role="option"` con el nombre.
- Links a la ficha con el nombre exacto de la entidad; tarjetas del tablero como `article`.
- **Avisos:** dos regiones vivas siempre montadas en `#crm-portal`: `role="status"` (`aria-live="polite"`) con éxito/info/atención y
  `role="alert"` (`aria-live="assertive"`) con errores; E2E encuentra el aviso con `getByRole("status").filter({ hasText })`.
  Errores de campo y de formulario `role="alert"`.
- **Carga:** mientras algo carga existe un `role="status"` cuyo texto **empieza con "Cargando"** ("Cargando…", "Cargando
  empresas…") y se quita del DOM al terminar (`LoadingStatus`, incluido en `TableSkeleton`). Lo esperan
  `scripts/guard/baseline-crm.mjs` y `scripts/manual/capturas.mjs` (`[role="status"]` /^Cargando/ hasta que desaparezca).
- `data-app-main`, `data-app-shell` y `data-app-chrome` (impresión y capturas). Donde hoy E2E o el manual dependen de clases CSS,
  se agrega `data-testid` al migrar.

---

## 14. Desktop y mobile

- **Desktop primero.** Breakpoints: ≥ 1280 principal (master-detail); 1024 rail colapsado; 768–1023 una columna de contenido con
  rail colapsado; < 768 mobile.
- **Mobile (< 768):** una columna; sin master-detail (la fila navega a la ficha); filtros en una hoja inferior; la grilla muestra
  2–3 columnas clave con el **mismo markup** (container queries, nunca tabla + cards duplicadas); drawers a ancho completo con
  acciones apiladas (primaria arriba); inputs a 16 px; toasts a lo ancho, abajo.
- Sin scroll horizontal de página a 390 px; si una tabla no entra, scrollea dentro de su contenedor.

---

## 15. Definición de terminado para una pantalla migrada

- [ ] Vive en `(crm2)`, usa solo primitivos de `components/crm` (ningún `ui/*`, `Card`, `Drawer`/`ConfirmModal` legacy).
- [ ] Mismos datos, columnas, filtros, acciones, permisos y mensajes de dominio que la versión legacy (cero capacidades nuevas).
- [ ] Contratos de §13.2 intactos: la suite E2E pasa **sin cambiar aserciones**; la carga expone "Cargando…".
- [ ] Una sola primaria; resto secundario o en `⋮`. Sin cards apiladas ni paneles dentro de paneles.
- [ ] Estados cubiertos: cargando (esqueleto + `aria-busy` + `LoadingStatus`), vacío (primera vez y sin resultados), error (banner + Reintentar).
- [ ] Teclado completo (Tab, flechas, Escape, foco que vuelve); foco visible en todo.
- [ ] Contraste: solo tokens (si sumó un color, está en `PARES` o en `SIN_PAR` con motivo y `npm test` pasa).
- [ ] Capturas claro/oscuro a 1440 · 1280 · 1024 · 390; sin scroll horizontal; comparación lado a lado con la baseline legacy.
- [ ] Sin colores de paleta, radios, sombras ni z-index literales; sin `title=`; espaciado en 4/8 (medios pasos solo los de §5).
- [ ] `typecheck`, `lint`, `npm test`, `build` y `npm run guard` (frozen OK + landing/login/recuperar a 0 px) en verde.
- [ ] Revisión de contexto limpio antes del commit.

---

## 16. Checklist de entrega (de UI/UX Pro Max, adaptada)

- [ ] Sin emojis como íconos; todos de lucide, 16 px, stroke 1.75.
- [ ] `cursor: pointer` en todo lo clickeable (los primitivos ya lo traen).
- [ ] Hover con transición de 120 ms; sin cambios de layout al hover.
- [ ] Contraste AA medido en claro y oscuro.
- [ ] Foco visible para teclado.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Responsive: 390, 768, 1024, 1280, 1440.
- [ ] Nada tapado por barras fijas; sin scroll horizontal en mobile.
