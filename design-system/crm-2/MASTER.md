# CRM 2.0 — Sistema de diseño ("Ledger")

> **Cómo leer este archivo.** Es la fuente de verdad de la superficie CRM 2.0: todo lo que se construye con
> `src/components/crm/` y los tokens `--crm-*` de `src/app/(app)/crm.css`. Cada sección dice el valor exacto y por qué.
> Si un valor de acá no coincide con el código, **gana el código y este archivo se corrige** (el contraste lo verifica
> `npm test`; el resto, la revisión).
>
> **Precedencia.** Este archivo gobierna TODO el CRM y el panel de plataforma: desde el Lote F no queda ninguna pantalla legacy
> (`(app)/(legacy)` se retiró). `design-system/tuco-y-nito/MASTER.md` y `docs/design-overrides.md` quedan para la landing y las
> pantallas de acceso (`/login`, `/recuperar`, `/definir-clave`), que están fuera de alcance y congeladas. El contrato de
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
tooltips de recorte desde su página servidor); los demás son de cliente. §10.11 es el shell (Etapa 2, construido); §10.12 es la
especificación de las composiciones, §10.13 cómo quedaron construidas en Empresas (Etapa 3) y §10.14 Contactos y Productos
(Lote A), con lo que se generalizó para todas las listas. §10.15 es el selector de fecha (`DatePicker` / `DateTimePicker`).
§10.16–§10.18 son Ventas, Alertas y Usuarios (Lote B); §10.19, Oportunidades (Lote C); §10.20, el editor de presupuesto (Lote D);
§10.21–§10.23, las pantallas de análisis: Inicio, Tablero comercial y Conversión del embudo (Lote E); §10.24 Configuración y §10.25 el
panel de plataforma, «Sin permisos» y el retiro de `(legacy)` (Lote F).

### 10.1 Button, IconButton, FilterChip — `Button.tsx` (server-safe)
- Variantes: `primary` (acento sólido; **una por pantalla**), `secondary` (panel + hairline; la normal), `ghost` (sin caja; acciones
  terciarias), `danger` (solo destruir/dar de baja). Tamaños `sm` 28 · `md` 32 · `lg` 36. Ícono 16 a la izquierda (`icon`).
- `loading`: `aria-busy`, cambia el ícono por el indicador; el texto lo cambia quien llama ("Guardando…"). Bloquea con `aria-disabled` + un
  guardia en el clic, **no** con `disabled` (Lote F): deshabilitar el botón con el foco adentro tiraba el foco al `body` a mitad del
  guardado; el guardia también cancela el clic del envío implícito (Enter en un campo), así un segundo Enter no envía dos veces.
- `IconButton`: cuadrado 28/32, `label` obligatorio → `aria-label`. `buttonClass()` para `<Link>` con forma de botón.
- `FilterChip`: disparador de un `Popover` en la toolbar (spec en §10.12).

### 10.2 Campos — `Field.tsx` (server-safe), `Select.tsx`
- `Field` cablea label (arriba, 13/500), ayuda (12, secundaria) y error (12, danger, `role="alert"`) con `aria-describedby`,
  `aria-invalid` y `required`; el control se dibuja con las props que recibe, así los ids (`#nombre`, `#empresa_id`…) quedan intactos.
  La ayuda **sigue a la vista con un error** (explica justo lo que hay que corregir) y los dos ids van en `aria-describedby`;
  antes se escondía y el id quedaba apuntando a nada.
- `Input` 32 (28 `dense`), `Textarea` (resize vertical), `Checkbox`, `Radio` + `RadioGroup` (fieldset/legend), `Switch`
  (`role="switch"`): **nativos** con apariencia propia — teclado, formularios y lectores de pantalla sin código extra.
- Borde `--crm-border-strong`, radio 4, el mismo anillo de foco; obligatorio = asterisco visual + `required`.
- `Select`: combobox de solo selección (APG), lista en portal, mismo contrato que `ui/Select` (`value/onChange/options/searchable/
  id/aria-*`) + `color` y `disabled` por opción, `required` (→ `aria-required`), `aria-invalid` y `aria-describedby` (los pasa
  `Field`). Buscador automático con más de 8 opciones. Clic en su `<label>`: enfoca sin abrir la lista.
- Montos: `MoneyInput` de siempre (nunca `type="number"`).
- Fechas: `DatePicker` / `DateTimePicker` (§10.15), nunca `type="date"` ni `datetime-local` nativos.

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
  Una sola implementación. `vertical` (Lote F, Configuración): desde 1024 la lista es una columna de ítems de 32 con el aspecto del
  rail (tinte `--crm-selected` + texto `--crm-accent-text` + barra de 2 px); debajo, la fila de siempre. Mismo markup;
  `aria-orientation` sigue al ancho (64rem, el mismo corte que `lg:`) y las flechas de los dos ejes mueven en cualquier ancho. `prefetch`
  (se pasa a cada `<Link>`; `false` si `navigate` no va al servidor) y `dot` + `dotLabel` (un punto de acento junto al nombre, con su
  texto para lectores de pantalla).
- `SegmentedControl`: 2–4 vistas (Tablero/Lista); `radiogroup`, 28/32 de alto; el elegido en panel con texto y borde de acento.

### 10.8 Drawer, Dialog, ConfirmDialog, Toast — `Drawer.tsx`, `Dialog.tsx`, `Toast.tsx`
- `Drawer`: derecha, **480** (`md`) / **640** (`lg`: empresa y venta, que lleva la grilla de productos), ancho completo en mobile. Header fijo de 56 (título 16/600,
  descripción 12, "Cerrar panel"), cuerpo con scroll, footer fijo (secundario + primario a la derecha; en mobile apilados, el
  primario arriba). `onSubmit` envuelve cuerpo y footer en `<form>`. `busy` impide cerrar a mitad de una mutación.
  Secciones con `FormSection` (título 13/600 + divisor), **sin cajas**.
- `Dialog`: solo confirmaciones y cierre de oportunidad, ≤ 440, título 16, acciones abajo a la derecha. `role="dialog"`.
  Desde el Lote C: `onSubmit` (como el Drawer: cuerpo y acciones en un `<form noValidate>`, Enter envía) y nunca más alto que la
  ventana (`max-h` de `100dvh − 32`; el cuerpo scrollea, las acciones quedan a la vista).
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
  hover/foco de la fila, `⋮` siempre visible; todo visible en táctil). Estados: `TableSkeleton`, `TableMessage` (una
  `FilaCompleta`, ver §10.16) +
  `EmptyState`/`InlineBanner`, `busy` → `aria-busy`. Seleccionada: `Tr selected`. **Sin** orden por columna, selector de
  columnas ni densidad.
- `Pagination`: contrato idéntico a `Paginacion` (ver §13.2), con `ir` para transiciones y `pageSizeControl` para "Filas por
  página"; la página actual con texto y borde de acento.

### 10.11 Shell (Etapa 2, construido) — `src/components/crm/shell/`
`AppFrame` (lo monta `(app)/layout.tsx` para TODO el CRM y `admin/layout.tsx` con `plataforma`, §10.25) = `Rail` + `Topbar` (con `UserMenu`) + `Crumbs` + `CommandPalette`; la
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

### 10.13 Empresas slice: compositions (Etapa 3, construido)
Primera pantalla migrada (`src/app/(app)/(crm2)/empresas/`). Lo que MASTER no decía y se decidió acá; vale para los
próximos slices (Contactos, Oportunidades…).

- **PageBar** (`PageBar.tsx`, server-safe): 48 de alto; h1 20/600 + contador 14 secundario en **sans** con numerales tabulares
  ("8 empresas · 10 contactos": es una frase; el mono queda para cifras sueltas, montos e identificadores) + acciones a la
  derecha. Sin migas (las pone la topbar), sin bajada ni eyebrow. En mobile la primaria queda como botón de ícono (nombre accesible
  igual: "Nueva empresa").
- **Toolbar** (`Toolbar.tsx`, cliente): `role="group"` "Filtros", alto mínimo 40, `flex-wrap` (los chips bajan de línea, no se
  recortan). `SearchField` = campo de 28 (36 en mobile), 256 de ancho, `type="text"` (rol `textbox`, contrato E2E), misma lógica de
  300 ms / Enter que `CajaBusqueda` (`useBusquedaUrl`). Cada filtro de opción única es un **`Menu` con `chip`**: disparador
  `FilterChip` y items `menuitemradio` con `aria-checked` y tilde (mismo teclado del menú, typeahead, lista con scroll a 320). Los
  filtros on/off ("Ver dadas de baja") son `ToggleChip` (`aria-pressed`, tilde + acento). "Limpiar filtros" ghost `sm`, solo con
  filtros; no borra `sel`.
  **Una sola fila con poco ancho:** la toolbar es `@container`. Desde 52rem (832 px: la lista sin vista previa a 1280 y 1440,
  y a 1024) cada filtro es su chip; debajo (vista previa abierta a 1280 y 1440, 768, celular) los secundarios se juntan en UN
  chip **"Más filtros"** que abre un `Popover` (`role="dialog"` "Más filtros") con cada uno como campo (label + `Select`; el
  on/off como checkbox "Ver dadas de baja (N)"); el chip muestra cuántos están aplicados ("Más filtros: 2", nombre accesible
  "Más filtros, 2 aplicados") y el buscador se angosta a 192. Los parámetros de URL son los mismos y cada cambio se aplica al
  instante; el modo que no corresponde está en `display: none` (fuera del árbol de accesibilidad). Primarios (siempre chip):
  búsqueda, Estado y "Limpiar filtros". Secundarios: Empresas → Tipo, Responsable, Origen, Ver dadas de baja; Contactos →
  Vínculo, Responsable, Origen, Ver bajas (`ANCHO_FILTROS`, `MasFiltros`, `FiltroOpciones`, `FiltroSiNo` en `Toolbar.tsx`).
- **DataTable en una lista**: la lista es una columna flex de alto completo; la tabla queda a su **alto natural** (sin caja vacía si
  hay pocas filas), se achica y scrollea con el header fijo si no entra, y debajo hay una **banda de pie** (40, `--crm-panel`,
  hairline arriba) pegada al borde inferior del área de trabajo con "Mostrando N–M de T" (sans, numerales tabulares), la
  paginación y "Filas por página".
- **Columnas que colapsan (sin perder datos)**: se esconden por ancho del **contenedor** y lo escondido pasa a una línea de apoyo
  (12, secundaria, una sola línea con "…") debajo del nombre. El nombre es SIEMPRE un link a la ficha (contrato E2E).

  | Contenedor | Columnas | Línea de apoyo bajo el nombre |
  |---|---|---|
  | ≥ 60rem (lista sin vista previa) | Empresa (+ mail o teléfono en gris al lado) · Tipo · Estado · Responsable · Origen · Contactos | — (fila de 36) |
  | 45–60rem (vista previa abierta, 1440) | Empresa · Estado · Responsable · Contactos | tipo · origen · mail o teléfono |
  | 30–45rem (vista previa abierta, 1280) | Empresa · Estado · Responsable | tipo · origen · mail o teléfono · N contactos |
  | < 30rem (celular) | Empresa · `⋮` | estado · tipo · responsable · N contactos |

  Mismo markup en todos los anchos (container queries), sin cards. En celular el origen y el mail quedan en la ficha.
- **Master-detail (selección)**: `?sel=<id>` en la URL, junto a q/page/filtros: es la única fuente de verdad. El server lee `sel`
  (uuid o nada) y la página le pasa a la lista, como `panel`, `VistaPrevia` (server component, cliente con RLS, `leerCuenta360`)
  dentro de `<Suspense key={sel}>` con un esqueleto del mismo panel. `sel` inválido, inexistente o de otra cartera: nada.
  - **Elegir:** clic en la fila (fuera de sus links y botones) o en el link "Vista previa de <nombre>" (link real `?sel=`, abre en
    otra pestaña con Ctrl/botón del medio; visible al hover, fuera del orden de Tab: con teclado se elige con flechas).
  - **Selección optimista:** la fila marcada cambia al instante; la lista guarda lo último pedido y, cuando el servidor contesta
    con ese `sel` (o la URL cambia por otro camino: atrás/adelante), sigue a la URL. Mientras la vista previa nueva está en camino,
    la vieja se atenúa (60 %) con `aria-busy` y "Cargando vista previa…".
  - **Teclado:** ↑/↓ (foco en la grilla) cuentan desde la fila CON FOCO: si no es la elegida, la eligen; si lo es, pasan a la
    vecina, sin vuelta en los bordes. El foco va al nombre de la fila nueva (Enter ahí abre la ficha). Con la tecla apretada se
    navega UNA vez, a la última fila, 200 ms después de la última flecha (`vecinoSel` en `components/crm/seleccion.ts`, probado).
  - **Esc** quita `sel` y devuelve el foco a la fila. Su listener está en `document` y se registró ANTES que el de un menú, select o
    drawer que se abra después, así que corre primero: por eso no alcanza con `defaultPrevented` y se fija si hay una capa abierta
    (`hayCapaAbierta()` de `overlay.ts`, o un `aria-modal`, o el foco en un menú/listbox/diálogo). Con una capa abierta, el Esc es
    de la capa.
  - **Debajo de 1280** no hay panel: la fila abre la ficha y, si la URL trae `sel` (link directo, ventana que se achica), la lista
    lo quita con `router.replace` (conserva lo demás). Límite: ese primer pedido del link directo ya dibujó el panel en el servidor
    (el servidor no conoce el ancho); desde ahí ya no se pide.
- **PreviewPanel** (`VistaPrevia.tsx`): `aside` de 400 (440 desde 2xl), borde izquierdo, sin sombra; entra sin scroll en 1440 × 900.
  Header fijo: nombre (16/600, h2) + "Fuera de la lista actual" si la empresa no está en la página que se ve, "Cerrar vista previa"
  (link que quita `sel`), estado · tipo · responsable, UNA acción ("Registrar actividad"; sin permiso, "Editar") + `⋮` "Más
  acciones" (Editar, Dar de baja / Reactivar; mismos permisos y drawers que la ficha; después de mutar, `router.refresh()`). Cuerpo:
  teléfono, email, CUIT y último contacto (`DefinitionList inline`), hasta 3 contactos (nombre, cargo, teléfono, mail), hasta 3
  oportunidades abiertas (etapa, monto) y los 3 últimos movimientos. Alta, origen, sitio web y dirección quedan en la ficha (el
  origen también en la fila). Pie fijo: "Abrir ficha completa →".
- **DetailHeader** (`PageBar.tsx`): franja en `--crm-panel` con borde inferior; h1 = nombre exacto (`break-words`, sin truncar);
  meta 13 secundaria: estado (punto + palabra), tipo, Avatar + responsable, "CUIT" + número mono. Una primaria ("Registrar
  actividad"; si el rol no puede, "Editar") + `⋮` "Más acciones" con el resto. Las `Tabs` van pegadas abajo, dentro de la franja.
  Sin "volver", sin eyebrow, sin avatar grande.
- **Tabs de ficha**: `?tab=` (Resumen sin parámetro); una tab existe solo si el rol/los datos la habilitan (mismas condiciones que
  la ficha legacy); una pedida que no existe cae en Resumen (`tabValida`). Contador mono en Oportunidades, Ventas (con "+" si la
  lectura llegó al tope: "100+"), Contactos y Canchas. Cambiar de tab navega dentro de una transición (`Tabs navigate`): el `TabPanel`
  queda `busy` (`aria-busy`, "Cargando…", contenido viejo al 60 %) hasta que llega. Si las tabs no entran (celular) se scrollean,
  la activa queda a la vista y el borde con más tabs se desvanece (máscara de 24–32 px).
- **Resumen = superficie de trabajo, no una card**: sin caja exterior. Columna principal: franja de cifras (`StatStrip`, sin
  título visible; "Calculado con lo que está cargado en el CRM, sin estimaciones." va como descripción accesible), la señal de
  recambio ("N unidades para recambiar ya · M por vencer · Ver parque", solo con `ventas.ver`, el mismo dato del Parque
  instalado), "Oportunidades abiertas" (tabla: oportunidad, etapa, monto; "Ver todas"), "Contactos" (tabla: nombre + cargo,
  teléfono, mail; "Agregar", que E2E usa sin cambiar de tab) y "Actividad reciente" (5, filas con hairline sobre el canvas,
  sin caja). A la derecha, desde 1280, un **riel de propiedades** de 340 con hairline a la izquierda: "Datos" en
  `DefinitionList inline` de una columna (término a la izquierda, hairline entre filas) + Observaciones. **El riel no repite la
  franja de identidad:** empresa → Teléfono, Email, Sitio web, Dirección, Origen, Alta (estado, tipo, responsable y CUIT están
  en el `DetailHeader`); contacto → Documento, Email, Teléfono, Origen, Alta (estado, empresa o "Cliente individual", cargo y
  responsable están en el header).
- **StatStrip**: una fila fina de N columnas iguales desde `sm` (`--n`), divisores verticales; de a 2 en mobile. Cifras en mono de
  20 (16 en el panel) con la unidad en gris al 70 %; fechas y frases ("Hace 17 días") en 14/500 sans con numerales tabulares. La
  cifra de 28 (`TYPE.kpi`) queda para tableros. `warning` = ícono + color de aviso. Si la primera y la última compra son la
  misma fecha, van como UNA cifra "Compró el" (`statsCuenta`); si no, "Primera compra" y "Última compra" como siempre.
- **Historia de la cuenta**: filas de libro mayor desde 48rem de contenedor (fecha mono 176 | ícono 16 | hecho + cuerpo | quién
  208); angosta, apilada. Filtro por tipo = grupo de botones `aria-pressed` con forma de segmentado. Mes como cabecera 12/500
  secundaria sobre regla fuerte (como `th`). Íconos de equipamiento sin caja, en gris. "Mostrando N de M" en sans. Sobre el
  canvas, **sin caja**: una regla arriba y hairline entre filas (como "Últimos movimientos" de la vista previa). No se agrupan
  eventos parecidos (p. ej. varios "Cambio de etapa" seguidos): cada uno tiene su fecha y juntarlos la escondería.
- **Tablas de ficha** (Oportunidades, Ventas, Contactos, Canchas, Parque): `DataTable` con `SectionBar` (14/600 + contador mono +
  acción `sm`) arriba; vacíos `EmptyState compact` dentro de la tabla. Parque instalado agrupa con filas `th colgroup` en
  `--crm-panel-2`; lo vencido como `StatusBadge` danger, el resto `StatusDot`.
- **Drawers de dominio** (`components/crm/cuenta/`): `FormDrawer` (Drawer + footer "Cancelar"/"Guardar"→"Guardando…" + banner de
  error) y campos `CampoTexto`/`CampoArea`/`CampoOpciones` atados por id. Empresa 640, el resto 480. `useApertura` lleva el valor y
  un contador `n` que va como `key`: cada apertura arranca el formulario limpio y el título no cambia durante la salida. La lógica
  vive fuera del UI: `lib/formularios/{contacto,actividad}.ts` (compartida con los formularios legacy), `BajaCliente`
  (`reactivarCliente`, `darDeBajaCliente`, `textoBaja`) y `ResumenIA` (`useResumenIA`). El Drawer valida a mano (`noValidate`).
  Foco después de mutar: si la fila desaparece de la lista, el foco va a la fila siguiente (o al buscador si la lista queda
  vacía; detalle en §10.14); en el panel y la ficha vuelve al `⋮`, que sigue existiendo.
- **Foco (corrección)**: `FOCUS` lleva `focus-visible:outline-solid`. Sin él, en Tailwind v4 `outline-none` deja
  `--tw-outline-style: none` y el anillo de 2 px no se dibujaba en ningún primitivo (Etapas 1–2).

### 10.14 Contactos y Productos slice (Lote A, construido)
Segundo y tercer slice (`src/app/(app)/(crm2)/contactos/`, `src/app/(app)/(crm2)/productos/`), movidos con `git mv` desde
`(legacy)`. Reusan §10.13 sin copiarlo: lo que era de Empresas y servía a cualquier lista se movió a `components/crm/`.

- **Generalizado (lo usan Empresas, Contactos y Productos):**
  - `Lista.tsx` (cliente): `useSeleccionUrl` (selección optimista por `?sel=`, ↑/↓ desde la fila con foco con UNA navegación a
    los 200 ms, Esc con `hayCapaAbierta()`, < 1280 quita `sel` con `router.replace`, clic en la fila), `useFocoFilas` (foco
    después de una acción, abajo), `PanelVistaPrevia` (`aria-busy` + "Cargando vista previa…" + 60 %), `LinkVistaPrevia`
    ("Vista previa de <nombre>", fuera del orden de Tab), `FILA_SELECCIONABLE` y `ListFooter` (banda de pie de §10.13). Los refs
    de la grilla (`tabla`, `buscador`) los crea la pantalla y se los pasa al hook: el compilador de React no deja leer refs que
    llegan dentro de lo que devuelve un hook.
  - `seleccion.ts` (+ `.check`): `vecinoSel`, `tabValida` y `filaTrasRefresco` (puro, probado).
  - `PreviewPanel.tsx` (server-safe): el `aside` de 400/440 con header fijo (h2 + "Fuera de la lista actual" + "Cerrar vista
    previa"), meta, acciones y pie "Abrir ficha completa →"; `PreviewPanelSkeleton`.
  - `Skeletons.tsx` (server-safe): `ListSkeleton` (barra con el h1 real y la primaria solo si el rol la tiene, toolbar, grilla
    con sus `Th` reales, banda de pie) y
    `DetailSkeleton` (la forma real: franja con h1, metadatos y primaria + `⋮`; tabs; cifras con divisores; una sección con su
    barra y tabla; filas con hairline; riel "Datos" término | valor). Las `loading.tsx` son una línea (la de Productos lee el
    permiso para dibujar o no la columna de acciones).
  - `cuenta/SeccionesCuenta.tsx` (server-safe): `ResumenStats`, `OportunidadesAbiertas`, `ActividadReciente`, `RielDatos`,
    `OportunidadesTab`, `VentasTab`, `Monto` y, para la vista previa, `OportunidadesPrevia` y `MovimientosPrevia` (`TOPE_PREVIA` 3):
    las fichas de empresa y de contacto dibujan las mismas tablas, vacíos y topes.
  - `cuenta/BajaDialog.tsx`: `itemsEdicionCliente` (Editar + Dar de baja / Reactivar con las reglas de siempre: solo con
    `clientes.editar`; Reactivar solo `inactivo`; "No contactar" no se deshace con un clic). `cuenta/estados.tsx`: `UltimoContacto`.
  - `MoneyInput.tsx` (cliente): el monto con máscara es-AR en el `Input` de CRM 2.0; máscara y cursor de `lib/money`
    (`caretAfterMask`). Cifra en mono, "$" en gris adentro. **Corrección del cursor** (en `lib/money`, la comparten crm y
    `ui/MoneyInput`): pasado el último dígito el cursor va al final, así "1500" + "," + "50" da "1.500,50" (antes el cursor
    quedaba antes de la coma y salía "150.050,"). En crm, además, después de una coma tipeada al medio sigue después de ella y
    un carácter rechazado (una letra) no mueve el cursor. Probado tecla por tecla en `money.check.ts`.
- **Foco después de mutar (corrección para las tres listas):** `useFocoFilas().conFoco(items, id)` anota, al elegir "Dar de baja"
  / "Reactivar" en el `⋮`, la fila y los ids de la página; `trasCambio()` (en `alCambiar`, antes del refresco) lo deja pendiente
  recién cuando la mutación terminó (cancelar la confirmación no deja nada). Cuando la lista vuelve, `filaTrasRefresco` MIRA el
  resultado: la misma fila si sigue; si salió, la siguiente de las de antes que siga (o la anterior); si no queda ninguna, el
  buscador. No se predice desde los filtros: con `?estado=cliente&bajas=1` la baja la saca, con `?estado=inactivo` la
  reactivación la saca, y al reactivar es la base la que decide si vuelve como Cliente o Potencial. "Nueva…" llama
  `olvidar()`. Sin link de nombre en la fila (Productos), el foco va a su `⋮`.

#### Contactos
- **PageBar:** "Contactos" + "N contactos · M individuales" (con filtro "N de T contactos") + primaria "Nuevo contacto"
  (`clientes.editar`; en celular, botón de ícono con el mismo nombre). **Toolbar:** textbox **"Buscar contacto"** (el de la lista
  legacy), chips `Menu` "Filtrar por estado" (`?estado=`), "Filtrar por empresa o individual" (chip "Vínculo", `?vinculo=
  empresa|individual`), "Filtrar por responsable" (solo con `clientes.ver_todos`, `?responsable=`), "Filtrar por origen"
  (`?origen=`), `ToggleChip` "Ver bajas" + cantidad (`?bajas=1`) y "Limpiar filtros" (conserva `sel`). Con poco ancho, Vínculo,
  Responsable, Origen y Ver bajas van en "Más filtros" (§10.13, Toolbar). Contador en singular cuando corresponde ("1 individual").
- **Columnas que colapsan** (mismo markup en todo ancho, `@container`):

  | Contenedor | Columnas | Línea de apoyo bajo el nombre |
  |---|---|---|
  | ≥ 60rem (sin vista previa) | Contacto (+ cargo · mail · teléfono en gris al lado; "Sin datos de contacto" si no hay) · Empresa · Estado · Responsable · `⋮` | — (fila de 36) |
  | 30–60rem sin vista previa (1024, 768) | Contacto · Empresa · Estado · `⋮` | cargo · mail · teléfono · responsable |
  | 30–60rem con vista previa (1280, 1440) | Contacto · Empresa · Estado · `⋮` | cargo · teléfono · responsable (el mail está en el panel de al lado y en la ficha) |
  | < 30rem (celular) | Contacto · `⋮` | estado · empresa (o "Individual") · cargo · responsable |

  Empresa = link a su ficha, `Tag` "Individual" (sin empresa) o "Empresa de otra cartera" (la RLS no la muestra), como la
  legacy. En celular el mail y el teléfono quedan en la ficha (la tarjeta legacy de celular tampoco los mostraba).
- **Master-detail ≥ 1280:** idéntico a Empresas (`?sel=`, `<Suspense key={sel}>`, `uuidParam`, cliente con RLS). `VistaPrevia`
  (server): h2 = nombre completo, meta estado · cargo · responsable (igual que Empresas, sin prefijo oculto); UNA acción ("Registrar actividad", `bitacora.escribir` +
  `bitacora.ver`; sin permiso, "Editar") + `⋮` "Más acciones" (Editar, Dar de baja / Reactivar); cuerpo `DefinitionList`
  Empresa · Teléfono · Email · Documento · Último contacto; Oportunidades abiertas (3) y Últimos movimientos (3) con la lectura de
  la ficha (`leerCuenta360` por `contacto_id`). Origen, alta y observaciones quedan en la ficha. Entra sin scroll en 1440 × 900.
  La empresa sale de las que ya trae la página para el formulario (las que la RLS deja ver): sin consulta extra.
- **Ficha** (`[id]`): `DetailHeader` (h1 = `nombreCompleto` exacto, `CrumbLabel` igual que antes; meta estado · empresa como link
  o `Tag` "Cliente individual" o "Empresa de otra cartera" · cargo · responsable), UNA primaria + "Más acciones". Tabs por URL:
  **Resumen · Actividad · Oportunidades · Ventas** (Actividad con cualquiera de los cuatro permisos de la historia, las otras con
  el suyo: las secciones y condiciones de la ficha legacy; no hay Contactos ni Canchas). Resumen = superficie de trabajo de
  §10.13: cifras, oportunidades abiertas, actividad reciente + riel "Datos" (Documento, Email, Teléfono, Origen, Alta; lo demás
  está en el header) + Observaciones. Actividad = `HistoriaCuenta` con "Resumir con IA" (`tipo="contacto"`) y
  "Registrar". La actividad se cuelga también de la empresa del contacto si la persona la ve, y ofrece solo las oportunidades
  abiertas que no son de otra empresa (misma regla que la legacy). Cada mutación hace `router.refresh()` (la legacy copiaba la
  fila a un estado local).
- **Drawers:** `ContactoDrawer` (el de la ficha de empresa: `useContactoForm`, mismos ids `#nombre`, `#apellido`, `#empresa_id`…)
  con la descripción = nombre al editar; `ActividadDrawer`; `BajaDialog` "Dar de baja el contacto". Una sola implementación de
  acciones: `contactos/acciones.tsx` (`useAccionesContacto`, `itemsFila`, `oportunidadesParaActividad`). El `ContactoForm` legacy
  se borró (no quedaba nadie que lo usara).

#### Productos
- Sin ficha ni vista previa (el plan limita el master-detail a Empresas y Contactos): la fila no navega ni se elige.
- **PageBar:** "Productos" + "N productos · M con vida útil" + "Nuevo producto" (`productos.editar`). **Toolbar** (si el catálogo
  no está vacío): textbox **"Buscar producto"**, chips "Filtrar por categoría" (`?categoria=`, solo valores que existen) y
  "Filtrar por estado" ("Activos y de baja" / "Activos" / "De baja", `?estado=activo|baja`), "Limpiar filtros".
- **Columnas:** Producto (ícono de equipamiento SIN caja, 16, gris + nombre 500 + marca en gris al lado) · Categoría (texto, ya no
  pastilla de color) · Precio (`$` gris + cifra mono a la derecha; sin precio "—") · Vida útil (texto plano "5 años" /
  "18 meses"; sin seguimiento "—" con "Sin seguimiento" para lectores de pantalla; sin barra) · Estado (punto + "Activo" /
  "De baja") · `⋮` (solo con `productos.editar`).

  | Contenedor | Columnas | Línea de apoyo |
  |---|---|---|
  | ≥ 45rem | todas | — (fila de 36) |
  | 30–45rem (768) | Producto · Precio · Estado · `⋮` | categoría · vida útil · marca |
  | < 30rem | Producto · `⋮` | "De baja" (solo si lo está) · precio · categoría · vida útil (si tiene) · marca |

  Las filas de baja ya no van al 55 % de opacidad (bajaba el contraste debajo de AA): se distinguen por el punto + "De baja" y
  el nombre en `--crm-text-2` (6.8:1). En celular "Activo" no se repite en cada fila: solo se marca "De baja". La carga dibuja
  la columna de acciones y "Nuevo producto" solo con `productos.editar` (lee la sesión ya cacheada del pedido).
- **`⋮` "Acciones de <nombre>":** "Editar" + "Dar de baja" (danger, `ConfirmDialog` "Dar de baja el producto" con el texto de
  siempre) o "Reactivar" (directo). Misma mutación (`activo`), mismos avisos ("Producto dado de baja." / "Producto
  reactivado." / error). **Drawer** "Nuevo producto" / "Editar producto" (480): mismos campos e ids (`#nombre`, `#marca`,
  `#categoria`, `#precio`, `#vida_util_meses`, `#descripcion`), validaciones (nombre obligatorio, vida útil entera > 0, nombre
  repetido por la restricción única), payload (precio vacío = `null`, no $ 0) y textos; "Seguimiento de recambio" como
  `FormSection` y la explicación como ayuda del campo (`aria-describedby`).

### 10.15 DatePicker, DateTimePicker — `DatePicker.tsx` (+ lógica en `fecha.ts`)
Reemplaza a `<input type="date">` y `datetime-local` en CRM 2.0 (el calendario nativo no sigue el tema, ni la tipografía, ni
la semana de lunes). Un solo componente; `DateTimePicker` = `DatePicker time`. Cliente (hooks); la lógica pura vive en
`fecha.ts` y la prueba `fecha.check.ts` (`npm test`).

- **Contrato de valor (el del nativo, así validadores y payloads no cambian):** fecha `"YYYY-MM-DD"`; fecha y hora
  `"YYYY-MM-DDTHH:mm"` en hora **local** (igual que `datetime-local`); vacío `""`. `onChange` recibe SIEMPRE un valor válido
  dentro de `[min, max]` o `""`: un texto que no es una fecha deja el valor vacío y muestra su mensaje. **Borrado ≠
  inválido** (`confirmarTexto` en `fecha.ts`, probado): borrar el campo emite `""` siempre; un texto inválido o fuera de
  rango, en un formulario, vacía el valor (lo valida como faltante: nunca se guarda una fecha que no se ve); con
  `keepOnInvalid` (filtros de lista, `FechaFiltro`) NO emite nada: queda el último válido y el campo muestra el mensaje (antes
  un "01/01/2027" en "Desde" borraba en silencio el `?desde=` aplicado).
- **Props:** `id` (va en el campo visible: `<label htmlFor>`, `aria-describedby` y los selectores de E2E —`#ocurrido_en`— siguen
  andando), `value`, `onChange(string)`, `time`, `min`/`max` (por **día**; si traen hora se ignora: la hora contra el tope la
  valida quien llama, p. ej. "no puede ser futura"), `required`, `disabled`, `name` (un `input hidden` con el ISO),
  `placeholder` (por defecto `dd/mm/aaaa` / `dd/mm/aaaa hh:mm`), `clearable` (por defecto `!required`), `error`, `dense` (28),
  `aria-*`. Con `Field`: `{(p) => <DatePicker {...p} … error={error} />}` y el error **al picker, no a `Field`**: muestra uno
  solo (primero el de formato, si no el de quien llama) con `FieldError` y lo ata por `aria-describedby` + `aria-invalid`.
  En formularios de drawer: `CampoFecha` (`cuenta/FormDrawer.tsx`).
- **Campo:** el `Input` de siempre (32, radio 4, borde `--crm-border-strong`, el mismo foco), numerales tabulares, máscara
  mientras se tipea (solo cifras; `/`, espacio y `:` se ponen solos; "6/" → "06/"; pegar "6/10/2026" se respeta; al borrar no se
  reacomoda nada, así Backspace borra la barra). Se confirma al salir del campo o con **Enter** (con texto sin confirmar, Enter
  confirma y NO envía el formulario; el siguiente sí). Mensajes: "Escribí la fecha como dd/mm/aaaa.", "El 31/02/2026 no
  existe.", "Elegí una fecha hasta el 04/10/2026." (desde / entre), "La hora va de 00:00 a 23:59.". A la derecha, `IconButton`
  de calendario (`CalendarDays`, 28; 24 en `dense`) "Abrir calendario" con `aria-haspopup="dialog"` y `aria-expanded`. Abierto,
  el borde del campo pasa a `--crm-accent` (como el Select).
- **Panel:** capa flotante en `#crm-portal` (`useAnchor` + `useLayer` + `FLOATING`: `--crm-panel`, hairline, radio 6, la única
  sombra), 280 de ancho, padding 12, `role="dialog"` "Elegir fecha" ("Elegir fecha y hora" con `time`), no modal. Se arma
  con las piezas del `Popover` (no con el `Popover` mismo: el ancla es el campo entero y el foco inicial va al día, no al
  primer botón).
  - **Cabecera:** "Mes anterior" / "Mes siguiente" (`IconButton sm`) y en el medio el mes en 14/600, "Octubre 2026"
    (mayúscula inicial, nombres escritos a mano: no depende de `Intl`). Clic en el mes → **vista de meses**: grilla 3 × 4
    (Ene…Dic, 36 de alto), las flechas pasan a "Año anterior" / "Año siguiente"; elegir un mes vuelve a los días. Una región
    `aria-live="polite"` (oculta) anuncia el mes o el año al cambiar.
  - **Grilla:** `role="grid"` + `row` + `columnheader` (Lu Ma Mi Ju Vi Sa Do, 12/500 secundario, semana de lunes) + 6 × 7
    `gridcell` (botones de 32, radio 4, 13 px). Días de otro mes en `--crm-text-2`; **hoy** con anillo interior de 1 px
    `--crm-border-strong` + 600 (nunca relleno) y `aria-current="date"`; **elegido** relleno `--crm-accent` + `--crm-on-accent`
    600 y `aria-selected`; hover tonal; fuera de `[min, max]` al 45 % con `aria-disabled` (sigue enfocable, el clic no hace
    nada). Nombre de cada día: "martes 6 de octubre de 2026".
  - **Hora** (`time`): fila bajo la grilla con "Hora", dos `spinbutton` de 28 × 44 (HH y mm, 24 h): se tipea (con tope 23 /
    59), ↑/↓ dan la vuelta, Enter confirma y cierra; "Ahora" (ghost `sm`) pone hoy y la hora actual.
  - **Pie:** "Hoy" (ghost `sm`, deshabilitado si hoy está fuera de rango) a la izquierda; "Limpiar" (si `clearable`) y, con
    `time`, "Listo" a la derecha. Hairline arriba de la hora y del pie.
  - Elegir un día cierra y devuelve el foco al campo; con `time` el panel queda abierto para ajustar la hora ("Listo",
    Escape o clic afuera cierran; el valor ya quedó guardado).
- **Hidratación:** "hoy" se calcula al abrir, en el navegador (el panel nunca lo dibuja el servidor); el campo muestra solo el
  valor, igual en servidor y cliente. Aritmética de días con `Date.UTC`; nunca `new Date("YYYY-MM-DD")`.
- **Celular (< 640):** el panel deja de anclarse y queda como hoja fija abajo, de lado a lado con 8 px de margen (pisa la
  posición de `useAnchor` con `!`). Con puntero grueso (`pointer-coarse:`, variante de Tailwind; no hace falta regla en
  crm.css) los días pasan a 36, los botones del panel y los campos de hora a 36 y los meses a 44.
- **Movimiento y color:** solo `crm-pop` del flotante (apagado con `prefers-reduced-motion`) y transiciones de color de 120 ms.
  Sin tokens nuevos: todos los pares que usa ya están medidos en §3.3 (on-accent/accent, text-2/panel, border-strong/panel,
  foco). Sin gradientes, sin sombras extra, sin `title=`.
- **Dónde se usa:** `ActividadDrawer` ("Cuándo", `#ocurrido_en`, `time`, `max` = ahora; misma validación y payload); desde el
  Lote B, "Nueva venta" (`#fecha` y la entrega de cada línea, `#item-<key>-entrega`) y los filtros "Desde" / "Hasta" de Ventas
  (`FechaFiltro`, §10.16); desde el Lote C, Oportunidades: `#fecha_estimada_cierre` y `#licitacion_apertura` (drawer) y
  `#fecha_cierre` (diálogo de cierre, `max` = hoy); desde el Lote E, "Alta desde" / "hasta" de la Conversión del embudo
  (`FechaFiltro`, §10.23). Ya no queda ningún `type="date"` en el CRM (el `FiltroFecha` legacy se borró). El presupuesto (§10.20) no tiene fechas que se elijan: "Validez (días)" es un número. Muestras en `/crm-lab` (sección "Fechas").

### 10.16 Ventas (Lote B, construido)
`src/app/(app)/(crm2)/ventas/`, movida con `git mv` desde `(legacy)`. Mismos datos, filtros, parámetros, permisos, validaciones y
mutaciones; la lógica pura en `ventas/logica.ts` (+ `.check`: agrupar ítems, total, "N ítems", la entrega que sigue a la fecha,
la validación de líneas y la fecha local).

- **PageBar:** "Ventas" + el contador de siempre ("6 ventas registradas" / "N de T ventas" / "N ventas" si el conteo falló) +
  "Nueva venta" (`ventas.editar`; en celular, ícono con el mismo nombre).
- **Toolbar:** textbox **"Buscar venta"** (`?q=`, 288 de ancho desde 52rem: el placeholder "Cliente, comprobante o producto…" entra
  entero), `Select` denso **"Filtrar por cliente"** (`?empresa=`; con buscador si hay más de 8 clientes, como el legacy; es un
  campo y no un chip-menú porque el menú no busca por texto) y **"Desde" / "Hasta"** (`?desde=` / `?hasta=`, `FechaFiltro`:
  `DatePicker` denso con label a la izquierda; encadenados con `min`/`max`; solo escriben una fecha confirmada) + "Limpiar
  filtros". Con menos de 52rem los tres van en **"Más filtros"** (cliente como `FiltroOpciones`, las fechas como `FechaFiltro`
  apilado). Sin ventas (y el conteo bien), la toolbar no está: queda el vacío "Todavía no hay entregas asentadas" + "Nueva venta".
- **Fila desplegable** (el acordeón de antes): una por venta, una abierta a la vez. El disparador es un `<button>` en la celda del
  cliente (chevron + nombre; `aria-expanded`, `aria-controls` → la fila del detalle mientras existe; nombre accesible
  "<cliente>, <fecha>" para distinguir dos ventas al mismo club); Enter y Espacio son los nativos del botón y el clic en el resto
  de la fila también alterna (salvo que se esté seleccionando texto, p. ej. para copiar un comprobante). El detalle es una fila `FilaCompleta` en `--crm-canvas`, alineada bajo el nombre del cliente (148 px
  desde 30rem): una línea por producto (ícono de equipamiento gris, nombre, "Entrega dd/mm/aaaa", "Vida útil N meses", "×N" mono,
  subtotal `$` gris + mono) y las notas. Con menos de 45rem de contenedor la entrega, la vida útil y la cantidad pasan a un
  segundo renglón (sin recortar).
- **Columnas que colapsan** (sin perder datos):

  | Contenedor | Columnas | Línea de apoyo bajo el cliente |
  |---|---|---|
  | ≥ 60rem | Fecha · Cliente · Comprobante · Productos (hasta 3 íconos + "N ítems") · Total | — (fila de 36) |
  | 45–60rem (1024) | Fecha · Cliente · Productos · Total | comprobante |
  | 30–45rem (768) | Fecha · Cliente · Total | comprobante · N ítems |
  | < 30rem (celular) | Cliente · Total (+ "N ítems" debajo del total, como el legacy) | fecha · comprobante (cada dato entero; puede bajar de renglón) |

  Sin comprobante, entre 45 y 60rem la línea de apoyo no existe. El total por venta es el de siempre (precio × cantidad); no hay
  totales de página (el legacy no los tenía). Paginación por la banda de pie de §10.13 ("Mostrando N–M de T").
- **`FilaCompleta`** (`components/crm/FilaCompleta.tsx`, cliente; la usan el detalle de Ventas y `TableMessage` en TODAS las
  listas): una fila que ocupa todas las columnas **visibles**. Las columnas escondidas (`hideBelow` → `display: none`) no cuentan
  en la grilla de la tabla, así que un `colSpan` fijo creaba columnas fantasma: en el celular, con el vacío "sin resultados" o
  una venta abierta, la primera columna quedaba de ~50 px y la regla de la cabecera, cortada (pasaba también en Empresas,
  Contactos y Productos desde el Lote A). El servidor dibuja el total; en el navegador se ajusta a las cabeceras visibles antes
  de pintar y con cada cambio de ancho (`ResizeObserver`). `DataTable.tsx` sigue sin `"use client"`: importa esa pieza.
- **"Nueva venta"** (`VentaForm`, `FormDrawer` de **640**): los campos, ids, validaciones, payload, textos y avisos de siempre
  (`#empresa_id` con buscador, `#contacto_id` filtrado por el cliente, `#fecha` con `CampoFecha`, `#comprobante`, `#notas`,
  "Registrar venta"; "Venta registrada. Arrancó el reloj del recambio." solo si algún producto sigue vida útil; el rollback de la
  cabecera si fallan los ítems). "Productos entregados" es una sección sin caja (título 13/600 + el total corriendo a la derecha en
  mono) con una **grilla compacta**: desde 34rem de ancho (el drawer de 640), una fila por producto — Producto (`Select` con
  buscador) · Cantidad · Precio unit. (`MoneyInput`) · Entrega (`DatePicker`) · quitar — con las cabeceras una sola vez
  (decorativas) y el label de cada campo solo para lectores de pantalla ("Producto N", "Cantidad"…); más angosto (celular), cada
  línea apilada con sus labels a la vista. Ids `item-<key>-producto|cantidad|precio|entrega`, "Quitar producto N", "Agregar
  producto" y la explicación de la entrega ("…arranca el reloj de la vida útil…") como siempre. Elegir un producto sugiere su
  precio de lista (`maskFromNumber`) si el precio está vacío; cambiar `#fecha` mueve las entregas que todavía la seguían.
- **Estados:** carga con `ListSkeleton` (sus `Th` reales; "Nueva venta" solo con el permiso), "sin resultados" con eco
  ("Ninguna venta con «…»" + "Limpiar filtros"), error por `(crm2)/error.tsx`. Sin `⋮`: una venta nunca se editó ni se borró
  desde la lista.

### 10.17 Alertas de recambio (Lote B, construido)
`src/app/(app)/(crm2)/alertas/` (`git mv`). La vista `alertas_vida_util` sigue trayendo todas, sin paginar ni filtrar en el servidor;
filtro y búsqueda siguen en el cliente y en el estado de la pantalla (como el legacy: no hay parámetros de URL nuevos). Lógica pura
en `alertas/logica.ts` (+ `.check`: contadores, filtro + búsqueda, texto del vencimiento). `plantillas.ts` (+ `.check`) y
`actions.ts` no cambiaron.

- **PageBar:** h1 **"Alertas de recambio"** (el de siempre) + "3 vencidas · 2 por vencer (60 días) · 2 sin avisar": los tres
  números del marcador (y su "60 días") van en el contador; el marcador (`.cesped` + cifras de 48 px) se fue. Sin primaria.
- **Toolbar:** el filtro de siempre como `SegmentedControl` "Filtrar alertas" (Todas / Vencidas / Por vencer / Sin avisar;
  `radiogroup`, flechas mueven y eligen) + textbox **"Buscar alerta"** ("Buscar cliente o producto…", `SearchInput`, el campo
  del `SearchField` sin URL) a la derecha. Con IA disponible, debajo, la línea "Si querés, «Redactar con IA»…" + "Cómo usamos la
  IA". Los avisos de la página (migración 0011 sin aplicar —el texto de `AvisoMigracion`, ahora como `InlineBanner` info—, error
  al leer las oportunidades) van bajo la barra.
- **Tabla** (dos renglones por fila; sin cards): Equipo (ícono de equipamiento gris + nombre 500 + "×N" mono si es más de 1;
  debajo "Entregado el … · vida útil N meses") · Cliente (empresa; contacto debajo) · Vencimiento ("Vencido hace N d" como
  `StatusBadge` danger —es lo que tiene que saltar—, "Vence en N d" / "Vence hoy" como punto de atención; debajo "vence
  dd/mm/aaaa") · Aviso ("Por mail" / "Por WhatsApp" con punto de éxito + "el dd/mm/aaaa", o "Sin avisar") · acciones.
  **El reloj del recambio va en texto** (entrega, vida útil y vencimiento), sin la barra: la barra decorativa no entraba en una
  fila densa sin romper la alineación y su información ya estaba escrita (`RelojRecambio.tsx` se borró: no quedaba quién lo usara).
- **Columnas que colapsan:** < 60rem el aviso, < 45rem el cliente y < 30rem el vencimiento (con su fecha) pasan a la línea de
  apoyo del equipo, **un dato por renglón** (no se recortan). En el celular la columna de acciones se esconde y las acciones van
  debajo del equipo, a todo el ancho.
- **Acciones a la vista** (como antes; no en un `⋮`, el legacy no tenía menú): "Crear oportunidad de recambio" (botón `sm` con
  texto visible "Crear oportunidad" y el nombre accesible completo; con menos de **70rem** de tabla —1280 y menos— solo ícono,
  así el equipo tiene ancho y la fila queda en dos renglones; el tooltip aparece SOLO cuando el texto está escondido,
  `Tooltip onlyWhenLabelHidden`) o el link "Oportunidad abierta →"; "Redactar con IA" (solo con clave de IA y `alertas.enviar`),
  "Mail" y "WhatsApp" como `IconButton` con tooltip. Mismos handlers, permisos, avisos y la regla de UNA llamada a la IA a la
  vez; mientras una fila manda un aviso o crea una oportunidad, "Redactar con IA" no abre otro borrador. El overlay de
  "Enviando…" / "Creando la oportunidad…" se cambió por: la fila ocupada con `aria-disabled` (NO `disabled`, que tiraba el foco
  al `<body>`), la tabla `aria-busy` y una región `role="status"` con el mismo texto. **Foco:** al terminar, vuelve a la misma
  acción de la fila (`data-accion`); al crear la oportunidad, al link "Oportunidad abierta →" que reemplaza al botón; si la fila
  salió de la lista ("Sin avisar"), a la siguiente que siga (`filaTrasRefresco`). Si una consulta del recambio tira (red), la fila
  se libera con el aviso de error (`sinTrabarse`).
- **"Aviso de recambio con IA"** (`BorradorIA`, `Drawer` de 480): misma lógica (`useBorradorIA` sin cambios), descripción
  "<equipo> · <cliente>", la etiqueta "Borrador generado con IA — revisalo antes de enviar" en `--crm-accent-text` (como la de la
  historia de la cuenta), el aviso de falla como `InlineBanner` de atención con `role="alert"` (como antes; `InlineBanner` acepta
  `role`), `#borrador-ia` con el contador como ayuda, "Volver a la plantilla" / "Regenerar con IA" / "Copiar" y, en el pie, "Abrir
  en mail" + "Abrir en WhatsApp" (primaria). Cargando: esqueleto del texto, sin spinner. La confirmación de "Regenerar" sobre un
  borrador editado es un `ConfirmDialog` ("Regenerar el borrador", mismo texto que el `confirm()` del navegador de antes).
- **Vacíos:** sin alertas, "Todo el equipamiento está al día" (sin toolbar); con filtro, "Ningún recambio con ese filtro" dentro de
  la tabla. Carga: `ListSkeleton` con el segmentado a la izquierda y la búsqueda a la derecha (`toolbar`), sin banda de pie.

### 10.18 Usuarios y roles (Lote B, construido)
`src/app/(app)/(crm2)/usuarios/` (`git mv`). `actions.ts` sin cambios; lógica pura en `usuarios/logica.ts` (+ `.check`: estado de un
usuario, grupos de permisos, el tildado con dependencias y la validación del rol; `lib/permisos.ts` está congelado, por eso no va ahí).

- **PageBar:** "Usuarios" + "4 usuarios con acceso" / "N de T usuarios" (con filtros en la tab Usuarios) + la primaria de la tab:
  "Invitar usuario" o "Nuevo rol". **Tabs por URL** (`Tabs` compartidas; `?tab=roles`, Usuarios sin parámetro, como antes; un
  valor inválido cae en Usuarios porque el servidor ya lo validaba): tablist "Secciones" (el nombre de siempre), Enter/Espacio
  navegan con historial y el panel queda `busy` hasta que llega el otro.
- **Tab Usuarios:** textbox **"Buscar usuario"** (`?q=`), chips `Menu` **"Filtrar por rol"** (`?rol=`) y **"Filtrar por estado"**
  (`?estado=activo|pendiente|baja`), "Limpiar filtros"; con menos de 52rem los dos van en "Más filtros". DataTable: Usuario
  (Avatar + nombre 500 + "(vos)") · Email · Rol (escudo si es Administrador; "Sin rol") · Estado (punto + "Activo" /
  "Invitación pendiente" / "De baja") · `⋮` **"Acciones de <nombre o email>"**: "Cambiar rol", "Reenviar invitación" (solo
  pendiente), "Dar de baja" (danger, `ConfirmDialog` "Dar de baja al usuario", mismo texto) / "Reactivar". El propio usuario no
  tiene `⋮`. Un usuario de baja lleva el nombre en `--crm-text-2` (la opacidad de antes bajaba el contraste).

  | Contenedor | Columnas | Línea de apoyo bajo el nombre |
  |---|---|---|
  | ≥ 60rem | Usuario · Email · Rol · Estado · `⋮` | — |
  | 45–60rem | Usuario · Rol · Estado · `⋮` | email |
  | 30–45rem | Usuario · Rol · `⋮` | estado (solo si no es "Activo") · email |
  | < 30rem | Usuario · `⋮` | estado (si no es "Activo") · rol · email (sin recortar) |

  Después de "Dar de baja" / "Reactivar" el foco sigue la regla de §10.14 (`useFocoFilas`; sin link de nombre, va al `⋮`).
- **Tab Roles:** sin cards. (1) Tabla **"Roles"**: Rol · Descripción (entera, en varios renglones si hace falta; debajo del
  nombre con poco ancho: en el celular no hay tooltip, así que no se recorta) · Usuarios (mono, a la
  derecha) · `⋮` **"Acciones del rol <nombre>"** (Editar, Borrar → `ConfirmDialog` "Borrar rol") o, en el Administrador, la
  etiqueta "Fijo" con candado (y "el rol Administrador no se puede modificar" para lectores de pantalla y en tooltip). (2) Matriz
  **"Permisos por rol"**: un permiso por fila (`th scope="row"`), un `<tbody>` por grupo con su título (`th scope="rowgroup"`,
  sin `colSpan`: celdas vacías por columna, así no aparecen columnas fantasma), un rol por columna, "✓" (con "Sí" para lectores
  de pantalla) o "—" ("No"). Los mismos datos que las pastillas de color de antes, leíbles de un vistazo y comparables entre
  roles. La matriz es **su propio scroller** (`flex-1 min-h-0`; la tab entera no scrollea salvo que no entre ni el mínimo de 240
  de la matriz), así la cabecera queda fija al bajar. Ancho tope 240 + 128 por rol (en 1800+ las columnas no se estiran). **En el
  celular** (< 30rem de tabla) se ve UN rol por vez, elegido con el `Select` "Ver el rol" en la barra de la sección (la misma
  matriz, columna por columna: sin scroll de costado ni datos nuevos); entre 30 y 45rem, si no entra, scrollea de costado
  con la columna del permiso fija (`sticky`).
- **Drawers** (`FormDrawer`, 480): "Invitar usuario" (`#inv-nombre`, `#inv-email`, `#inv-rol` con Vendedor por defecto, la ayuda
  de siempre, "Enviar invitación"), "Cambiar rol" (descripción = el usuario; `#cambiar-rol`; debajo, la descripción del rol y sus
  permisos como `Tag`) y `RolForm` "Nuevo rol" / "Editar rol" (`#rol-nombre`, `#rol-descripcion` de 200, fieldset "Qué puede
  hacer" con los grupos como títulos 12/500 y cada permiso como `Checkbox` con su descripción; "Crear rol" / "Guardar rol"; las
  tres validaciones de siempre). El link de activación sin SMTP es un `InlineBanner` info con el link (mono, de solo lectura),
  "Copiar" y "Cerrar".
- **Carga:** `ListSkeleton` con las tabs (`tabs`) y la grilla de usuarios.

**Generalizado en el Lote B** (lo usan o pueden usar todas las pantallas): `Toolbar.tsx` → `SearchInput` (el campo sin URL;
`SearchField` ahora lo usa) y `FechaFiltro` (filtro de fecha por URL); `FilaCompleta` (arriba); `PageBar`: si el contador no entra
al lado del h1, baja a un segundo renglón (`min-h-12` + wrap) en vez de recortar el título (pasaba con Alertas en el celular);
`ListSkeleton`: `toolbar` (fila propia), `tabs` y `footer`; `InlineBanner`: `role`; `Tooltip`: `onlyWhenLabelHidden`; `DatePicker`:
`keepOnInvalid` (§10.15).

**Guardar sin trabarse** (`src/lib/guardar.ts`, + `.check`): todo drawer o diálogo con `busy` (Cancelar, Escape y la X
deshabilitados mientras guarda) corre su guardado con `sinTrabarse(guardar, liberar)`: si la llamada TIRA (red caída, Server
Action abortada, despliegue en curso) apaga el `saving` y muestra "No se pudo completar la acción. Intentá de nuevo." en el
banner del formulario, en vez de quedar en "Guardando…" para siempre. Los errores esperados (`{ error }`, `{ ok: false }`) siguen
con sus mensajes. Lo usan Venta, Producto, Empresa, Cancha, Contacto y Actividad (`lib/formularios/*`, también en los
formularios legacy), Invitar usuario, Cambiar rol, Rol, Oportunidad, Cierre, Reasignar y el recambio en 1 clic de Alertas; el
`ConfirmDialog` ya se liberaba solo (`finally`) y `ejecutar` de Usuarios atrapa.

### 10.19 Oportunidades (Lote C, construido)
`src/app/(app)/(crm2)/oportunidades/` (`git mv` de `page.tsx`, `datos.ts`, `OportunidadesView.tsx`, `OportunidadForm.tsx`, `loading.tsx` y
`[id]/*`; `components/CierreModal.tsx` → `CierreDialog.tsx`). El editor de presupuesto quedó legacy en este lote
(`(legacy)/oportunidades/[id]/presupuesto/`, conviviendo bajo `/oportunidades/[id]`) y se migró en el Lote D (§10.20). Mismos datos, filtros,
parámetros, permisos, validaciones, mutaciones, avisos y nombres. Lógica pura nueva en `lib/oportunidades.ts` (+ `.check`):
`ETIQUETA_CAMBIO`, `COPY_CAMBIO`, `etapaSugerida`, `textoCambioHecho` y `pasosEmbudo`.

- **PageBar:** "Oportunidades" + el contador de siempre ("10 abiertas · 5 cerradas" / "N de T oportunidades" / "N oportunidades" si
  un conteo falló) + el **segmentado "Vista"** (`radiogroup`: Tablero | Lista, `?vista=lista`; navega con historial y, al volver al
  tablero, saca `estado` y una etapa de cierre, como antes; en el celular solo los íconos con `labelClassName`, el nombre accesible no
  cambia) + "Nueva oportunidad" (`oportunidades.editar`; ícono en el celular). Sin la 0011 y con `configuracion.gestionar`, el aviso
  de la migración (`InlineBanner`).
- **Toolbar:** textbox **"Buscar oportunidad"** (`?q=`, 320 desde 52rem: el placeholder entra entero), chips `Menu` "Filtrar por
  estado" (solo en la lista; "Abiertas" es el valor sin parámetro y el chip lo muestra), "Filtrar por etapa" (tablero: las abiertas;
  lista: todas), "Filtrar por responsable" (solo con `clientes.ver_todos`; "Sin asignar" = `?responsable=sin`), "Filtrar por tipo"
  y "Filtrar por origen"; "Limpiar filtros" conserva `vista` y `pageSize`. Con menos de 52rem, Responsable, Tipo y Origen van en
  "Más filtros". En el tablero, a la derecha, lo que antes decía el encabezado "Embudo comercial": "En el tablero: N · $4,9 M".
- **Tablero:** las columnas van **directo sobre el canvas, a todo el alto del área de trabajo** (sin card alrededor): UNA barra
  horizontal (la región "Columnas del embudo", enfocable) y cada columna scrollea solo de alto. Columna: cabecera de 40 sobre la
  regla fuerte (cuadradito de la etapa + nombre 600 + cantidad mono + valor de la etapa compacto a la derecha) y la zona de
  tarjetas, que es también la de soltar (al pasar: `--crm-selected` + borde de acento de 2 px; vacía: "Nada en esta etapa" / "Nada
  con ese filtro" / "Soltá acá"). Ancho 256–384 que reparte; en el celular 85 % con imán (`scroll-px`). Se fue el "01, 02…" de cada
  etapa (decorativo: "una jugada que avanza").
- **Tarjeta** (`article`, `data-id`): título = link a la ficha (13/500, hasta 2 renglones; `Tooltip onlyWhenTruncated` ahora mira
  también el alto), `⋮` **"Acciones de <título>"**, cliente (12 secundario, "Sin empresa / contacto"), valor compacto (cifra mono,
  "$" y "k/M" en gris), "Licitación" (`Tag`) y el responsable (Avatar; el nombre para lectores y en tooltip). Los mismos datos que la
  tarjeta legacy. Se arrastra entera (HTML5 nativo, optimista, vuelve atrás y avisa si falla, como antes); mientras se guarda, el
  `⋮` es un indicador "Guardando el cambio…". **Alternativa de teclado y táctil:** `⋮` → "Cambiar etapa" (el diálogo de la ficha).
- **`⋮` de tarjeta y de fila:** Ver detalle, **Presupuesto** (un acceso más al mismo link, sin permiso extra, igual que el botón de
  la ficha), Editar (`oportunidades.editar`) y las acciones de etapa de `accionesDisponibles` (Cambiar etapa, Marcar ganada, Marcar
  perdida / Reabrir, Cambiar resultado). Foco después (`useFocoFilas` con `acciones = ACCIONES_QUE_MUEVEN`): en el tablero la
  tarjeta se mueve al instante y el foco va a su título en la columna nueva (o, si se cerró, a la tarjeta siguiente); en la lista,
  cuando vuelve el servidor, a la misma fila o a la siguiente.
- **Lista:** `DataTable` (filas de 36; dos renglones cuando hay línea de apoyo) + banda de pie con "Mostrando N–M de T", paginación y
  "Filas por página". Pie de la tabla (`tfoot` fijo abajo, regla fuerte arriba): "Valor de la página" con la suma bajo la columna
  Valor y "N con valor · M sin responsable" (la fila de totales legacy; "En esta página" ya lo dice "Mostrando…").

  Anchos (revisión del Lote C, medidos para que no se recorte nada a 1903/1440/1280): Etapa 200 (entra "Relevamiento de
  cancha"), Responsable 200 (Avatar + "Demo · Administrador"), Estado 96, Valor 120, `⋮` 40; Empresa / Contacto 184 (280 desde
  90rem) y Producto 272 (solo desde 90rem). Lo que igual pueda recortarse (un nombre de empresa o de producto muy largo) muestra
  el texto entero en un tooltip (`Tooltip onlyWhenTruncated`, que ahora mira también el `.truncate` de adentro de `StatusDot` y
  `CellPerson`).

  | Contenedor | Columnas | Línea 1 bajo el título | Línea 2 |
  |---|---|---|---|
  | ≥ 90rem (1903) | Oportunidad (+ "Licitación") · Empresa / Contacto · Producto (ícono + nombre) · Etapa · Estado · Responsable · Valor · `⋮` | — | "Cerrada el dd/mm/aaaa · motivo" (solo cerradas) |
  | 72–90rem (1440) | todas menos Producto | — | producto · cierre |
  | 45–72rem (1280, 1024) | Oportunidad · Empresa / Contacto · Etapa · Estado · Valor · `⋮` | — | producto · responsable · cierre |
  | 30–45rem (768) | Oportunidad · Etapa · Valor · `⋮` | estado · cliente | producto · responsable · cierre |
  | < 30rem (celular) | Oportunidad · `⋮` | valor · estado (solo cerradas: una abierta lo dice su etapa) · etapa · cliente | producto · cierre |

  **Estado y etapa no se repiten:** si la etapa es de cierre y se llama como el estado ("Perdida" / perdida;
  `etapaRepiteEstado`, sin distinguir mayúsculas ni acentos), la columna Etapa muestra "—" (el nombre queda para lectores de
  pantalla) y la línea del celular muestra solo el estado; una etapa de cierre con otro nombre ("Entregado") se muestra igual.
  **En el celular el responsable queda en la ficha** (la fila apunta a dos renglones: valor · etapa · cliente / producto · cierre).

  Vacíos: sin ninguna oportunidad, "El embudo está vacío" + "Nueva oportunidad" (sin toolbar); con filtros, "Ninguna oportunidad con
  «…»" / "…con esos filtros" + "Limpiar filtros" dentro de la tabla; sin etapas abiertas, el aviso de Configuración.
- **Ficha** (`[id]`, `CrumbLabel` = título): `DetailHeader` con h1 = título exacto y meta estado (punto + palabra) · etapa
  (cuadradito) · "Licitación" · valor mono ("Sin valor estimado") · responsable · empresa (link, "De otra cartera" o "Sin acceso").
  La etapa no se muestra si repite el estado (`etapaRepiteEstado`). Acciones: **una primaria** "Registrar actividad" (`bitacora.escribir` + `bitacora.ver`; sin ellos, "Editar") + **"Presupuesto"**
  (link secundario con ícono, a la vista: responde a "no encuentro dónde crear presupuestos") + `⋮` "Más acciones" (Reasignar con
  `oportunidades.asignar`, Editar). Debajo, en la franja, el **recorrido por el embudo** (`ol` "Recorrido por el embudo", solo
  lectura, `pasosEmbudo`): una etapa abierta por segmento con barra de 2 px arriba (hecha: fuerte; actual: acento +
  `aria-current="step"`; pendiente: hairline) y al final "Cierre" (cerrada: la etapa de cierre con punto Y barra en
  `--crm-success` / `--crm-danger`, y las abiertas sin marcar: el recorrido real está en el historial). Los nombres bajan de
  renglón, no se recortan. Al lado, el grupo **"Acciones de etapa"** con jerarquía: "Cambiar etapa" (o "Reabrir") secundario con
  borde, un divisor hairline y "Marcar ganada" / "Marcar perdida" (o "Cambiar resultado") como botones ghost callados con el ícono en
  éxito / peligro (siguen siendo `<button>` con los nombres de siempre: E2E aprieta "Marcar perdida"). Con menos de 1280 el recorrido
  ocupa su renglón: scrollea de costado con imán (`snap-x`), la etapa actual a la vista y el borde que tiene más etapas desvanecido
  (máscara de 24–32 px, como las tabs); las acciones van debajo. El recorrido no es clickeable: abriría el diálogo con una etapa ya
  elegida, una conducta nueva.
- **Cuerpo** (sin cajas, como la ficha de empresa): a la izquierda, el aviso de cerrada — **neutro**: hairline sobre panel, punto de
  éxito o pérdida + "Perdida el dd/mm/aaaa." (`textoCerrada`; E2E lo busca como `status` con esa fecha) en `--crm-text` 500, y
  motivo + quién puede reabrir en secundario; perder una oportunidad no es un error, así que no va en una caja teñida (`role="status"`,
  `tabIndex=-1`: recibe el foco tras cerrarla si no queda ninguna acción de etapa) —, el de la apertura de una licitación, **Licitación**
  (`SectionBar` + "Editar datos"/"Cargar datos" + `DefinitionList`), **Historial** (`SectionBar` con contador y "Registrar"; filas de
  libro mayor `FilaActividad` y `FilaHistoria` de `HistoriaCuenta`: actividades y cambios de etapa con "De X → Y" y la observación) y
  **Cambios después del cierre** (una fila por corrección: "Campo: antes → después"). A la derecha desde 1280 (debajo con menos), el
  riel **"Datos"** (`RielDatos`): Contacto, Producto / servicio, Probabilidad, Fecha estimada de cierre, Fecha real de cierre, Origen,
  Motivo de pérdida (si está perdida), Alta + Observaciones; lo que está en el header no se repite. La ficha legacy no listaba
  presupuestos: no se agregó (la lista sigue en el editor).
- **Diálogos y drawers:** `CierreDialog` (`Dialog` con `onSubmit`): "Cambiar de etapa", "Marcar como ganada", "Marcar como perdida",
  "Reabrir oportunidad", "Cambiar resultado"; descripción = el título de la oportunidad; `#cambio_etapa` (o la etapa única de solo
  lectura), `#motivo_perdida`, `#fecha_cierre` (`CampoFecha`, `max` = hoy) y `#cambio_observacion` (500); "Mover", "Marcar ganada",
  "Marcar perdida", "Reabrir", "Cambiar resultado" → "Guardando…"; mismas validaciones (`validarCambio`), bloqueo de la licitación y
  avisos ("«…» pasó a «…».", "…quedó perdida…"). `OportunidadForm` (`FormDrawer` de 480): "Nueva oportunidad" / "Editar
  oportunidad", mismos ids y payload; el tipo es un segmentado "Tipo" (Directa / Licitación municipal) y la licitación una
  `FormSection`. "Reasignar oportunidad" (`#responsable_id`, "Reasignar") y "Registrar actividad" (`ActividadDrawer`). Cada mutación
  de la ficha hace `router.refresh()`; si el botón que abrió el diálogo desaparece (cerrar, reabrir), el foco va a la primera acción
  de etapa que quede o, sin ninguna (un rol sin `oportunidades.reabrir`), al aviso de cerrada.
- **Carga:** barra con el h1 real, el segmentado y la primaria solo con el permiso, toolbar y un bloque **neutro** de renglones (ni
  columnas ni tabla: `loading.tsx` no conoce `?vista=`, así un link a la lista no salta de columnas a tabla); la ficha con
  `DetailSkeleton pasos` (recorrido + acciones, historial y riel); el editor de presupuesto, ver §10.20 (el caso especial que
  `(legacy)/loading.tsx` tuvo en el Lote C para esa ruta se quitó al migrarla).
- **Tablero, revisión:** "En el tablero: N · $X" cuenta lo que SE VE (una tarjeta cerrada desde su `⋮` deja de contar al
  instante, sin esperar el refresco) y la región "Columnas del embudo" entra en el orden de Tab solo cuando scrollea de costado
  (se mide en el navegador con `ResizeObserver`).
- **Se borró** (sin usuarios): `components/CierreModal.tsx` (ahora `CierreDialog`), `ActividadForm.tsx`, `ClienteCampos.tsx`,
  `components/oportunidades.tsx` y la fila legacy de `ActividadesTimeline.tsx` (queda `ICONO_POR_CODIGO`).

**Generalizado en el Lote C:** `Dialog` → `onSubmit` y alto máximo; `SegmentedControl` → `labelClassName`; `Tooltip
onlyWhenTruncated` también con recorte de alto (`line-clamp`); `useFocoFilas` → `acciones` (qué items del `⋮` pueden sacar la fila)
y cualquier elemento con `data-id` (filas y tarjetas); `DetailSkeleton` → `pasos` (y `tabs` opcional); `HistoriaCuenta` exporta
`FilaHistoria`, `FilaActividad`, `CuandoHistoria` y `PROSA`.

### 10.20 Presupuesto (Lote D, construido)
`src/app/(app)/(crm2)/oportunidades/[id]/presupuesto/` (`git mv` de `page.tsx`, `PresupuestoView.tsx` y `loading.tsx` desde
`(legacy)`). Decisión de producto: **la hoja imprimible no cambia; cambia solo la experiencia del editor.** Mismos datos, campos,
validaciones y mensajes, numeración (`N° 000042` / «Borrador»), cuentas en centavos, regla de IVA, guardado (mismo insert con la foto
del emisor), impresión (renueva el logo, nombre del PDF, «Envío de propuesta» una sola vez), "Usar como base de uno nuevo", permisos y
avisos. No hay confirmaciones (el legacy no tenía: un emitido no se anula ni se borra).

- **La hoja es papel** (`Hoja.tsx`): el componente legacy movido sin tocar (markup, clases de paleta de Tailwind, `rounded-lg`,
  `.hoja-presupuesto`, `.sin-corte`, los `data-testid` `numero-presupuesto`, `subtotal`, `neto`, `iva` y `total`) y **fuera de
  `UI_ROOT`**: hereda la fuente global como antes (en papel, Arial por `globals.css`). Es la única excepción a "Plex solo por tokens".
  Prueba del Lote D: la misma oportunidad con 1, 6 y 26 líneas y un presupuesto guardado, antes (build de `013cde9`) y después, en la
  misma ventana: la captura del `article` sin la escala de pantalla y a la misma fracción de píxel es idéntica por dentro (solo los
  píxeles del borde, semitransparentes, mezclan con un fondo distinto) y `page.pdf()` da las mismas páginas (1, 1, 2) y el mismo texto.
- **Vista dividida (≥ 1280):** `DetailHeader` (h1 = título exacto de la oportunidad, `CrumbLabel` como siempre; meta: "Volver a la
  oportunidad"; la frase de estado de siempre —"Armá las líneas…" / "Estás viendo el presupuesto N° …, emitido el …"— en su propio
  renglón con el nuevo `note` de `DetailHeader`, así una frase larga ya no baja las acciones debajo del título a 1024–1280) y, debajo,
  dos columnas con scroll propio y el encabezado fijo: **editor | hoja** en `minmax(0,1fr) | round(down, 40%, 1px)` (el editor con
  más lugar; el 40 % de la hoja redondeado a píxel entero, porque en una x fraccionaria Chrome dibuja el texto con suavizado gris);
  con un **guardado en pantalla** no hay editor y queda `26rem | hoja` (la hoja a 0,84 a 1440 en vez de 0,49). A la izquierda los
  avisos, el editor y "Presupuestos de esta oportunidad"; a la derecha la hoja. Acciones: borrador → "Imprimir / Guardar PDF"
  (secundaria) + **"Guardar presupuesto"** (primaria; sin `oportunidades.editar` la primaria es imprimir); emitido → "Volver al
  borrador" (ghost), "Usar como base de uno nuevo" (secundaria) e **"Imprimir / Guardar PDF"** (primaria). Son tres como máximo: no
  hace falta `⋮`. `DetailHeader` deja que sus acciones bajen de renglón (`max-w-full flex-wrap`) en vez de empujar la página de costado.
- **Hoja a escala** (`HojaEscalada`): se dibuja a su ancho natural (56rem, el máximo de siempre) y un `transform: scale()` la
  achica para que entre entera en su columna (nunca la agranda; a escala 1, sin `transform`). Escalas medidas (borrador): 0,49 a
  1440, 0,42 a 1280, 0,70 a 1903, 1 a 1024, 0,76 a 768, 0,40 a 390; el texto chico de la hoja (12 px) se ve de unos 6 px a 1440, 5 px
  a 1280 y 4,8 px a 390: **es una vista de conjunto**. Para leerla, el interruptor **"Ver hoja a tamaño real"** (`ToggleChip`,
  `aria-pressed`, apagado = "Ajustar"; estado solo de la pantalla) arriba de la hoja: escala 1 y el contenedor de la hoja scrollea
  de costado (`role="region"` "Hoja a tamaño real", entra en el orden de Tab y se mueve con las flechas); el `<main>` no scrollea. En
  el celular reemplaza a la miniatura de 0,4 como opción. El marco toma el alto ya escalado (medido con `ResizeObserver`; hasta medir
  la hoja no se ve: sin salto). En `@media print` cada envoltorio vuelve a bloque sin escala, alto, padding, fondo ni scroll
  (`print:` en las clases) y el interruptor no sale: la hoja imprime como antes, con o sin "tamaño real". Cada contenedor con scroll
  tiene fondo opaco (`--crm-canvas`) y la columna de la hoja es `isolate`: sin eso Chrome dibujaba la hoja a escala 1 (1024) con otro
  suavizado de texto que el legacy, por las textareas del editor que se pintan antes.
- **Una columna (< 1280):** scrollea entera, **encabezado incluido** (en el celular el encabezado fijo ocupaba ~245 de 844 px):
  editor, **hoja** y guardados, en el orden de siempre (la columna izquierda es `display: contents` y cada bloque lleva `order`).
  La hoja también se escala a lo ancho, con el mismo interruptor.
- **Grilla de líneas** (ARIA `table` "Líneas" con `columnheader`, `row` y `cell`; cabecera y filas con el MISMO template por ancho
  de contenedor): **30–64rem** (la columna del editor desde 1280 —también a 1903, ~60rem—, 1024 y 768) dos renglones bajo una
  cabecera de dos renglones: **Descripción\* a todo el ancho** · acciones / Producto · Cantidad\* · Precio unitario · Dto. % ·
  Importe (la descripción es lo que se imprime: 425 px a 1280, 521 a 1440, 772 a 1024, 799 a 1903); **≥ 64rem** (solo pantallas
  muy anchas) una fila (Producto · Descripción · Cantidad · Precio · Dto. · Importe · acciones); **< 30rem** (celular) un formulario
  corto por línea con los labels a la vista (descripción, producto, cantidad y precio a todo el ancho, dto. | importe) y la cabecera
  solo para lectores. Precio de **10rem** en los dos templates ("$ 12.345.678,90" entero) e importe de 8rem ("$37.037.036,70"). En
  la grilla los controles son los compactos de 28; en el celular, de 32 con texto de 16. Ids y nombres de siempre:
  `#linea-<key>-producto|descripcion|cantidad|precio|descuento` (E2E busca `input[id$="-descripcion"]` y `-precio`), labels
  "Cantidad de la línea N"…, `importe-N`, "Subir / Bajar / Quitar la línea N" (`IconButton sm` con `Tooltip`; ya sin `title=`).
  Precio con `MoneyInput`; cantidad y descuento con la máscara de siempre; producto con el `Select` con buscador ("Texto libre"
  suelta el producto). **Errores:** en su propia fila (`role="row"` con UNA celda `aria-colspan={7}`) debajo de la línea, a todo el
  ancho; cada `FieldError` conserva su id (`aria-describedby` del campo, que queda en rojo). Adentro de la fila de la línea no eran
  celdas (axe `aria-required-children`) y en una columna de 64 px quedaban en cinco renglones.
- **Pie de la grilla:** "Agregar del catálogo" (`Select` con buscador, `#agregar-producto`) + "Agregar línea libre"
  (`#agregar-linea`) a la izquierda y los **totales del borrador** a la derecha (Subtotal y Descuentos si corresponden, Neto gravado
  e IVA 21 % si discrimina, Total: las mismas cuentas y condiciones que la hoja, sin `data-testid` para no duplicar los de la hoja).
  Debajo, "Validez (días)" (`#validez`), "Condiciones" (`#condiciones`) y "Observaciones" (`#notas`) con `Field`, y la ayuda de siempre.
- **Foco:** agregar (del catálogo o libre) → la descripción de la línea nueva (su primer campo); quitar → la descripción de la
  línea que ocupa su lugar (o de la anterior; sin líneas, "Agregar línea libre"); mover → el mismo botón de la línea movida (en el
  borde, el otro: "Subir" en la primera pasa a "Bajar"); guardar bien → "Imprimir / Guardar PDF"; imprimir → vuelve a "Imprimir /
  Guardar PDF" cuando se habilita (mientras imprime está deshabilitado y el foco caía en `<body>`; un destino deshabilitado queda
  pendiente); "Volver al borrador" / "Usar como base" → "Agregar del catálogo" (el botón apretado desaparece). Lógica pura en `logica.ts` (+ `.check`): `lineasIniciales`,
  `aLinea`/`deLinea`, `lineaLibre`, `lineaDeProducto`, `cambioDeProducto`, `moverLinea`, `botonTrasMover`, `focoTrasQuitar`.
- **Estado** en `usePresupuesto.ts` (el del legacy, misma conducta); el guardado corre con `sinTrabarse`: si la llamada TIRA,
  "Guardando…" se apaga y el error va al banner.
- **Guardados:** región (`section aria-label`, la usa la figura `presupuesto-guardado` del manual) con `SectionBar` "Presupuestos de
  esta oportunidad" + contador y `DataTable` del mismo nombre: Número (mono; "(en
  pantalla)" y la fila `selected`) · Fecha (< 30rem, debajo del número) · Total (`$` gris + mono) · Historial ("Registrado" / "Sin
  registrar"; < 60rem, debajo del número) · "Ver / reimprimir" (`sm`, con "el presupuesto N° …" para lectores). Vacío: "Todavía no
  guardaste ninguno." + "Al guardar, el presupuesto recibe su número.".
- **Avisos** (no se imprimen): "Tu encabezado está vacío." (con el link a Configuración), la migración 0012 sin aplicar (el texto de
  `AvisoMigracion`) y el error del guardado, como `InlineBanner` arriba del editor.
- **Carga:** `loading.tsx` con la forma de la pantalla (franja con h1 y dos acciones, grilla, campos y, desde 1280, la hoja); al
  entrar desde la ficha (mismo route group) Next muestra esta carga. `(legacy)/loading.tsx` volvió a ser el cargador de marca de
  siempre (sin el caso especial del Lote C).
- **Se borró** (sin usuarios): `components/cliente.tsx` (`Dato`, `Seccion`) y `components/AvisoMigracion.tsx`.
- **Revisión (Lote D2):** `MoneyInput` ya no pierde dígitos tipeando rápido: después de una tecla rechazada el cursor se repone un
  cuadro más tarde solo si el campo sigue con el foco y con el MISMO valor (`caretAfterRejected` / `shouldRestoreCaret` en
  `lib/money`, probados en `money.check.ts` con un modelo de tipeo rápido); antes "-200" daba "20" y "a1500,50" daba "150,5".
  **Contenedores con scroll propio = posicionados** (`relative`): un `sr-only` (absoluto) toma como bloque contenedor el ancestro
  posicionado más cercano; si el scroll no lo es, el `sr-only` se sale de él y estira el scroll del `<main>` (que es `relative`). Se
  vio en el tablero de Oportunidades a 390 (`main.scrollWidth` 1224 contra 390) y se corrigió en la raíz: la región "Columnas del
  embudo" y sus columnas, el recorrido de la ficha, el contenedor de `DataTable`, la fila de `Tabs`, `PreviewPanel`, la matriz de
  roles y las columnas del presupuesto. La sonda de regresión mide `main.scrollWidth <= main.clientWidth` (y, en las pantallas de
  alto completo, que el `<main>` tampoco scrollee de alto) en todas las pantallas a 1903/1440/1280/1024/768/390.

### 10.21 Inicio (Lote E, construido)
`src/app/(app)/(crm2)/dashboard/` (`git mv` de `page.tsx` y `loading.tsx` desde `(legacy)`; `charts.tsx` se borró: `MagnitudeBars` y
`ShareBar` ya no tenían usuarios). Mismas lecturas (`empresas` y `contactos` contados, `etapas`, `oportunidades` con su empresa,
`alertas_vida_util` solo con `alertas.ver`), mismas cuentas y el mismo permiso (`tablero.ver`). Decisión de producto: **se fueron el
marcador** (la cifra de 72 px sobre `.cesped` con las marcas de cancha) **y la tarjeta "De la venta al recambio"** (la "jugada" de pasos
numerados con línea de cal): el Inicio es una superficie de trabajo, no una portada.

- **PageBar:** h1 **"Inicio"** (el nombre del link del rail; el legacy no tenía h1). Sin contador ni primaria.
- **Franja de cifras** (`StatStrip size="lg"`, `aria-label` "Resumen comercial"): **En juego** (compacta, "$" en gris; debajo la cifra
  exacta, que antes decía "$X repartidos en N oportunidades abiertas") · **Empresas** · **Contactos** · **Oportunidades abiertas**. Las tres
  cuentas son links, como las métricas legacy, con el mismo nombre accesible ("11 Empresas") y el mismo destino. **Contactos sigue
  llevando a `/empresas`**: es un bug conocido que se corrige aparte (decisión del Lote E; comentario `ponytail:` en el código). El link
  "N oportunidades" de la frase de abajo del marcador se fue: es el mismo destino que la cifra "Oportunidades abiertas". Con
  `alertas.ver` (y la vista sin error) hay una quinta cifra, **Recambios vencidos**: la MISMA cuenta de la sección de recambios (ningún
  dato nuevo), link a `/alertas` ("3 Recambios vencidos") y en aviso (ícono + color) si es más de 0. Las cuatro de arriba no cambian.
- **"Oportunidades por etapa"** (tabla): reemplaza a los DOS gráficos que repetían el mismo dato ("Distribución del embudo", barra 100 %
  apilada con los colores de cada etapa, y "Oportunidades por etapa", barras por cantidad). Etapa (cuadradito de su color + nombre, que
  baja de renglón, `StatusDot wrap`; `th scope="row"`) · Cantidad · Del total (`porcentajeDe`: la misma cuenta y el mismo redondeo que la
  leyenda legacy) · Valor (EXACTO; el legacy mostraba "$1,5 M") y un pie **Total** (`TFoot`, "Total" como `th scope="row"`: solo N, el "N
  en total" del legacy; la celda "Del total" queda vacía porque cada fila redondea —13 + 20 + … da 99 o 102— y un "100 %" la
  contradiría). **Sin barra** (revisión del Lote E): con 6 filas de 2–3 las barras eran casi iguales y repetían la cantidad que está en
  la columna de al lado. Todas las oportunidades, también las cerradas, cada una en su etapa (como antes). Con menos de 30rem de tabla el
  porcentaje pasa a una línea bajo la etapa ("13% del total").
- **"Recambios que vienen"** (solo con `alertas.ver` y si la vista no falló; mismo criterio que el legacy): `SectionBar` con el total y
  "Ver alertas"; arriba de la tabla, **lo vencido manda**: "3 vencidos" con ícono de aviso en `--crm-danger` 600 (ícono + palabra +
  color; sin vencidos, en texto común y sin ícono) y "· 2 por vencer" en secundario; tabla de las 4 primeras (las más urgentes): ícono de equipamiento gris (`IconoEquipoSimple`) + producto 500 y el cliente
  debajo · Vencimiento con el texto de Alertas (`textoVencimiento`: "Vencido hace 73 d" como `StatusBadge` danger, "Vence en 19 d" como
  punto de atención; antes "Hace 73 d" / "En 19 d" con el color como única diferencia). Vacío: "Todo el
  equipamiento está al día" + "Nada vence en los próximos 60 días.".
- **"Empresas con más valor en juego"** (las 6 primeras de las abiertas, sin "sin empresa", mismo orden): Empresa (sin link, como antes) ·
  barra (valor sobre el mayor) · En juego (exacto) · Abiertas. Vacío con el texto de siempre.
- **Grilla:** **recambios va PRIMERO en el DOM** (revisión del Lote E: en el celular y debajo de 1280 lo vencido —lo que el proveedor
  atiende hoy— queda arriba, como lo ponía el legacy), luego por etapa y empresas. Desde 1280, 12 columnas con lugares fijos: recambios a la
  derecha (`col-start-8`, 5 columnas, alto de dos filas, `row-start-1`), por etapa (7, fila 1) y empresas (7, fila 2) a la izquierda. Sin
  recambios, por etapa (7) y empresas (5) lado a lado. Debajo de 1280, una columna: recambios → por etapa → empresas. Sin cajas alrededor de
  las secciones (barra de sección + tabla); los vacíos ocupan el lugar de la tabla con su borde.
- **Carga:** `TableroSkeleton` (h1 real, franja de 4 cifras —5 con recambios—, las secciones en el mismo orden y la misma grilla; la de
  recambios solo si el rol la ve) +
  "Cargando tablero…". Error: `(crm2)/error.tsx`.

**Barras de dato (vale para los tres tableros):** `CellBar` (`DataTable.tsx`) dibuja `anchoBarra(valor, max)` (`barra.ts`, probado):
proporcional a la mayor de la tabla, piso de 2 % para un valor positivo y **sin barra para el cero** (el legacy dibujaba 2 % también para el
cero). Un solo tono (`--crm-accent`), sin gradiente, 8 px de alto, radio 2, sobre un eje hairline `--crm-border-strong` a la izquierda (sin
eje y centrada en el embudo). Es la excepción documentada al principio 3: el acento como marca de dato, el único color de los gráficos; los
colores de etapa quedan en el cuadradito junto al nombre. La barra es `aria-hidden` y **repite un número escrito en la misma fila**: la
tabla es la alternativa accesible y el color nunca es la única señal. Sin animación de entrada (el legacy crecía en 500 ms).

### 10.22 Tablero comercial (Lote E, construido)
`src/app/(app)/(crm2)/tablero-comercial/` (`git mv` de `page.tsx` y `loading.tsx`). Mismas lecturas con tope (`TOPE` 1000) y avisos de
truncado, mismas cuentas (`lib/tablero.ts` sin cambios), mismos permisos (`clientes.ver_todos` + `oportunidades.ver`, si no
`rutaInicial`; sin `bitacora.ver` no hay "sin actividad") y mismos parámetros (`?dias=7|14|30`, `?mes=aaaa-mm`).

- **PageBar:** "Tablero comercial" (sin el eyebrow "El equipo en la cancha" ni la bajada). Se fue el segundo marcador sobre la cancha.
- **Franja** (`StatStrip lg`, `aria-label` "Resumen del equipo"): Valor en juego del equipo (compacta + exacta debajo) · Oportunidades
  abiertas (link a `/oportunidades`; debajo "de N responsables") · "Quietas hace 14 días o más" ("—" si el rol no ve la bitácora) ·
  **Ganadas** y **Perdidas** con el mes como detalle ("en octubre de 2026"; antes iba en la etiqueta y la hacía de dos renglones a 1024). Si la lectura de abiertas tocó el tope, un `InlineBanner` de atención con el aviso de siempre.
- **"Pipeline por responsable"** (6 de 12 desde 1280; revisión del Lote E: con 5 la tabla medía ~470 px, menos de 30rem, y la barra se
  escondía justo en los anchos de escritorio; con 6 entra a 1280, 1440 y 1903. "Por qué se pierde" también pasó a 6): Responsable (Avatar + nombre que baja de renglón; "Sin responsable" en gris) · barra
  (valor) · Valor · Abiertas + pie **Total** (el valor en juego y las abiertas: los "N abiertas" del legacy). Se fue "La barra mide el
  valor; el número chico, la cantidad.": las columnas lo dicen.
- **"Abiertas sin actividad"** (6 de 12; a 1280 y 1440 la última actividad ya iba bajo el título con 7, así que no pierde nada): `nav` "Días sin actividad" con los tres links "N días o más" (`aria-current` en el elegido,
  `scroll={false}`) con forma de segmentado; la explicación de siempre; tabla `TablaQuietas` (Oportunidad = link a la ficha + responsable ·
  cliente · Última actividad (fecha mono + "de la oportunidad / del cliente / desde el alta", "antes del …" si es un piso) · Valor ·
  Quieta ("38 días" / "Más de N días" con punto de atención; "Sin datos suficientes" neutro). Con menos de 45rem de tabla la última
  actividad baja a una línea bajo el título; con menos de 30rem también el valor. "No se pudo comprobar" es una sub-sección (`h3`) con su
  contador, la explicación y la misma tabla. Los topes y avisos ("Mostrando las 20 más quietas de N", lecturas truncadas) como notas.
- **"Cierres del mes"** (`h2`, a todo el ancho, regla hairline abajo): a la derecha "Mes anterior: …" / "Mes siguiente: …" como botones
  de ícono (links; en el mes actual el siguiente queda deshabilitado y `aria-hidden`, como antes) y el mes con `aria-live`. Debajo, lado a
  lado desde 1280: **"Ganadas y perdidas"** (tabla Resultado · Cantidad · Monto; punto + palabra; "Sin monto") + la nota "Por fecha real
  de cierre… Se ganó N% de lo que se cerró." y **"Por qué se pierde"** (Motivo · barra · Perdidas · Monto; "Ver las perdidas" en la barra
  de la sección; vacíos de siempre).
- **Carga:** `TableroSkeleton` con 5 cifras y las cuatro secciones + "Cargando el tablero del equipo…".

### 10.23 Conversión del embudo (Lote E, construido)
`src/app/(app)/(crm2)/embudo/` (`git mv` de `page.tsx`, `EmbudoFiltros.tsx` y `loading.tsx`). Misma consulta con tope y margen de un día,
misma cohorte (`filtrarCohorte`), mismas cuentas (`calcularEmbudo`), mismos permisos (`oportunidades.ver` + `clientes.ver_todos`) y los
mismos parámetros (`?desde=&hasta=&origen=`, `origen=sin` = sin origen).

- **PageBar:** "Conversión del embudo" + la frase de la cohorte como contador ("15 oportunidades en la cohorte: 10 abiertas, 2 ganadas y 3
  perdidas."). Sin eyebrow ni bajada.
- **Toolbar** "Filtros del embudo" (`EmbudoFiltros`, cliente): `FechaFiltro` inline **"Alta desde"** y **"hasta"** (los labels de
  siempre; encadenados con `min`/`max`), `Select` denso **"Filtrar por origen"** (Todos los orígenes / Sin origen cargado / cada origen;
  con buscador por tener más de 8) y "Limpiar filtros" (ghost, solo con filtros). Los controles bajan de renglón con poco ancho (no hay
  "Más filtros": son los únicos controles). Mientras el servidor recalcula, el resultado queda `aria-busy`, una línea de 2 px en acento
  pulsa entre la toolbar y el resultado (reserva su lugar; quieta con movimiento reducido) y una región viva dice "Actualizando…". **No
  se atenúa** (revisión del Lote E: el 60 % bajaba el contraste de lo que se está leyendo). Un `?origen=` con un uuid que no es un origen
  de la lista (el servidor SÍ filtra por él y da 0) se ve como **"Origen desconocido"**; uno que no es "sin" ni un uuid (el servidor lo
  ignora) se ve como "Todos los orígenes".
- **Franja** (`StatStrip lg`): Tasa de éxito ("40" + "%" en gris; debajo "2 ganadas de 5 cerradas") · Ciclo hasta ganar · Ciclo hasta perder
  ("21,5" + "días"; "menos de 1 día" o "—" como texto; debajo "del alta al cierre, en promedio"). Se fue la cifra de 48 px.
- **"Embudo por etapa"** (tabla, a todo el ancho): Etapa · la **barra del embudo** (centrada, entraron sobre el máximo — misma escala que el
  legacy, que incluía a las ganadas —, visible en todo ancho) · Entraron · Avanzaron ("12 de 14") · Conversión ("85,7 %") · Mediana en la
  etapa ("Ninguna terminó" / "—") · Siguen ahí ahora ("2 · mediana hasta hoy 6,7 días" o "—"). La última fila es **Ganadas** (punto de
  éxito, barra, cantidad) en un `tbody` aparte con la regla fuerte arriba (`TBody ruled`): es el último paso, no un total, así que no va
  en `tfoot`; el nombre de cada fila es `th scope="row"`; debajo "Las N perdidas y las M abiertas no suman a la fila de ganadas." y el aviso de oportunidades sin historial. Se
  fueron los "01, 02…" de cada etapa. Con menos de 45rem de tabla, avanzaron/conversión y la mediana pasan a renglones bajo la etapa; con
  menos de 60rem, "Siguen ahí ahora".
- **«Cómo se calcula»:** el `<details>` de siempre con el mismo texto (Cohorte, Entraron, Avanzaron, Mediana, Tasa de éxito, Ciclo,
  historial) + una línea que dice qué mide la barra; `summary` con chevron que gira (sin giro con movimiento reducido), sobre el canvas
  con una regla arriba, sin caja.
- **Vacíos:** "Ninguna oportunidad con esos filtros" (+ la explicación; "Limpiar filtros" ya está en la toolbar) o "Todavía no hay
  oportunidades para medir" + "Ir a Oportunidades". Si la lectura tocó el tope, el `InlineBanner` info con el aviso de siempre.
- **Carga:** `TableroSkeleton` con la toolbar, 3 cifras y la tabla + "Cargando la conversión…" (antes "Calculando la conversión…": el
  contrato de §13.2 pide que empiece con "Cargando").

**Generalizado en el Lote E:** `StatStrip` → `size="lg"` (cifra de 28, `TYPE.kpi`, con interletrado −0,04em —la mono reserva un
carácter entero para la coma y el espacio—; el detalle baja de renglón en vez de recortarse; desde `sm` etiqueta, cifra y detalle son
filas compartidas con `subgrid`, así las cifras quedan en la misma línea aunque una etiqueta baje de renglón) y `href` por cifra (link con
nombre "cifra + etiqueta"); `StatusDot` → `wrap` (el texto baja de renglón); `DataTable` → `CellBar`, `TFoot` (pie de totales con la regla
fuerte), `Td rowHeader` (`th scope="row"` con el aspecto de una celda) y `TBody ruled` (un grupo de filas tras la regla fuerte); `barra.ts` (+ `.check`: `anchoBarra`, `porcentajeDe`); `Skeletons` → `TableroSkeleton`. **Se borró**
(sin usuarios): `(legacy)/dashboard/charts.tsx`, y `FiltroFecha` y `BarraPendiente` de `components/FiltrosUrl.tsx`.

**Paridad (prueba del Lote E):** cada cifra de las tres pantallas legacy (build de `3ef72fa`) contra la nueva, con Administrador,
Vendedor, Responsable comercial y Solo lectura, y con `?dias=7|30`, `?mes=2026-09|2026-08`, `?desde=`, `?hasta=`, `?origen=sin`, un origen
real y un período vacío: 1080 de 1080 iguales (montos exactos comparados en su forma compacta), incluidas las redirecciones por permiso
(el Vendedor va a `/dashboard` desde Tablero y Embudo; Solo lectura, a `/empresas` desde las tres).

### 10.24 Configuración (Lote F, construido)
`src/app/(app)/(crm2)/configuracion/` (`git mv` desde `(legacy)`). Mismas lecturas (organización, etapas, tipos de actividad, orígenes,
motivos de pérdida, el logo con URL firmada de 1 h), mismas escrituras (cliente del navegador + RLS), mismo permiso
(`configuracion.gestionar`; sin él, `rutaInicial`), mismos mensajes y nombres accesibles. Lógica pura en `configuracion/logica.ts` (+ `.check`).

- **PageBar:** "Configuración" + la línea de siempre como contador ("<razón social> · IA: activa|desactivada"; "IA: …" no se corta de
  renglón en el celular). Sin eyebrow ni bajada.
- **Sub-navegación por URL** (`?s=empresa|etapas|tipos|origenes|motivos`; sin parámetro, "Datos de la empresa", como abría el legacy; un
  valor desconocido cae ahí con `tabValida`): `Tabs vertical` con el tablist de siempre, **"Secciones de la configuración"**, y una tab
  por nombre ("Etapas", "Tipos de actividad"…: los usan el manual y la baseline). Desde 1024 es una columna de 208 a la izquierda
  (pegada arriba al scrollear); debajo, la fila de tabs con scroll. **Cambiar de sección no va al servidor:** la página ya trae todo, así
  que el `navigate` de las tabs hace `history.pushState` (Next lo integra: `useSearchParams` se entera; atrás/adelante y el deep link
  funcionan; Ctrl/Cmd+clic abre otra pestaña; `prefetch={false}`: prefetchear links que no van al servidor era en vano). Las cinco
  secciones quedan montadas (como antes): lo escrito en "Datos de la empresa" no se pierde al mirar otra sección, y mientras haya cambios
  sin guardar su tab lleva un punto de acento (+ "(cambios sin guardar)" para lectores de pantalla).
- **Secciones sin caja:** `SectionBar` (h2 = nombre de la sección, que nombra la sección por `aria-labelledby`; contador en sans con
  numerales tabulares —es una frase—; la primaria "Nuevo …" `sm`) + la línea de siempre que explica para qué sirve la lista + la tabla;
  ancho tope 48rem (una tabla de columnas angostas a 1800 px separaba el nombre de su estado).
- **Catálogos** (tipos, orígenes, motivos; `CatalogoTab`) y **Etapas** (`EtapasTab`): `DataTable` con las mismas columnas: N.º (mono) ·
  Nombre / Etapa · Estado (solo "Inactivo" a la vista; "Activo" queda para lectores de pantalla: repetido en cada fila era ruido) /
  Tipo (punto + palabra; Abierta info, Ganada éxito, Perdida peligro) · **Orden** (`Mover`) · `⋮`
  **"Acciones de <nombre>"** (Editar; Desactivar → `ConfirmDialog` "Desactivar <singular>" / Reactivar; en Etapas Editar y Borrar →
  "Borrar la etapa"). La etapa lleva su color como cuadradito de 12 (el dato que se configura acá; en el resto del CRM es el de 8), en
  `style`, y su nombre de color para lectores de pantalla ("(color Azul)"). N.º se queda: el orden no está en el nombre de las flechas. Debajo de 30rem de tabla, N.º y Estado/Tipo se esconden y "Inactivo" / el tipo
  bajan bajo el nombre. Vacío: `EmptyState compact` en la tabla con el texto de siempre + "Nuevo …".
- **Reordenar** (`Mover`): "Subir <nombre>" / "Bajar <nombre>" (`IconButton sm` + `Tooltip`), la misma lógica (catálogos: renumerado
  1..N escribiendo solo las filas que cambian, `moverEnCatalogo`; etapas: los tres pasos por el número libre con su vuelta atrás y la
  recarga). **Cambio:** se bloquean con `aria-disabled` (no `disabled`) y el foco vuelve a la flecha usada tras el movimiento
  (`useFocoMover`, `data-mover`): antes cada movimiento tiraba el foco al `body` (el botón se deshabilitaba con el foco adentro o la fila
  cambiaba de lugar en el DOM). Con teclado se puede bajar una fila varias veces seguidas con Enter.
- **Drawers** (`FormDrawer`, 480): "Nuevo/Editar <singular>" (`#catalogo-nombre`), "Nueva/Editar etapa" (`#etapa-nombre`, `#etapa-tipo`
  con `Select` CRM y la ayuda del tipo, fieldset "Color" con radios nativos `name="etapa-color"`: círculos de 32, el elegido con un anillo
  en `--crm-text`, el foco con el anillo de foco por fuera; un color fuera de la paleta se conserva como "Color actual"). Mismas
  validaciones y reglas (al menos una Ganada y una Perdida, antes de escribir; CHECK/FK/UNIQUE con sus mensajes). Guardado con
  `sinTrabarse`; las acciones de fila (activar, mover, borrar) liberan su `ocupado` en `finally` aunque la llamada tire.
- **Datos de la empresa:** formulario sin caja (h2 "Datos de la empresa") en tres grupos (`Grupo`: h3 13/600 + una línea): **Identidad
  fiscal** (Razón social · CUIT | Condición frente al IVA · Dirección; "Va en el encabezado de cada presupuesto."), **Contacto**
  (Teléfono | Mail · Sitio web) y **Presupuestos** (Validez (días) · Condiciones con su ayuda). Con 84rem de contenedor (la pantalla de
  1903) cada grupo toma la forma de una página de ajustes: título y ayuda a la izquierda (14rem), campos a la derecha (hasta 40rem). Los
  mismos ids (`#razon_social`, `#cuit`, `#condicion_iva`, `#direccion`, `#telefono`, `#email`, `#sitio_web`,
  `#presupuesto_validez_dias`, `#presupuesto_condiciones`) y validaciones. **"Guardar cambios"** es un solo botón (el de siempre,
  primaria, `sinTrabarse`); con cambios sin guardar (`hayCambios`, que compara sin espacios de los bordes) su fila se vuelve una barra
  flotante pegada abajo del área de trabajo: "Cambios sin guardar" · **"Descartar"** (vuelve a los valores guardados, `valoresDe`; solo
  estado local) · "Guardar cambios". Si la validación frena, el foco va al primer campo con error; si el guardado falla, al aviso
  (`tabIndex -1`), que en el celular quedaba arriba, fuera de la vista. Al lado desde 56rem de contenedor (debajo con menos): **Logo** (la ayuda `#logo-ayuda`, el `#logo-archivo` oculto "Elegir el archivo del logo", "Subir logo" / "Cambiar logo" /
  "Procesando…", "Quitar logo" → `ConfirmDialog` "Quitar el logo"; mismo flujo de storage: ruta fija por organización, PNG/JPG/WebP ≤ 1 MB,
  sin SVG, renovación de la URL firmada; el error en un `InlineBanner`) y **"Así va a verse en tus presupuestos"**: la vista previa de la
  hoja. **La hoja es papel:** blanca en claro y en oscuro, con clases de paleta (`bg-white`, `slate-*`), la misma excepción que
  `Hoja.tsx` (§10.20); nunca lleva la marca de Tuco & Nito.
- **Sin organización / sin datos:** h1 "Configuración" + `EmptyState` con los textos de siempre.
- **Carga:** barra con el h1, la sub-navegación y un bloque neutro (barra de sección + renglones: un deep link abre una tabla, no el
  formulario) + "Cargando la configuración…" (el texto de siempre).

### 10.25 Panel de plataforma, «Sin permisos» y el retiro de `(legacy)` (Lote F, construido)
**Panel de plataforma** (`src/app/admin/`, superadmin). Antes era otro shell (header propio con `ThemeToggle`, `min-h-dvh`, sin
contenedor de scroll); ahora es el **mismo marco**: `AppFrame plataforma` (`admin/layout.tsx`), con el rail de una sola sección
("Plataforma" › **Clientes**, de `SECCIONES_PLATAFORMA` en `lib/navegacion.ts`: ninguna pantalla del CRM de un cliente), sin búsqueda
global ni Ctrl/Cmd+K (busca datos de un cliente), tema y "Cerrar sesión" (con su confirmación) en la topbar y el menú de usuario
("Superadmin · Plataforma"). La miga es "Clientes". Las guardas son las de siempre: sin sesión → `/login`; sesión que no es de superadmin
→ `/dashboard` (layout) o `rutaInicial` (página). `actions.ts` y `page.tsx` sin cambios.

- **PageBar:** "Clientes" + "N clientes en la plataforma" / "N de T clientes" + **"Nuevo cliente"**. Toolbar: textbox **"Buscar cliente"**
  ("Buscar cliente o admin…", filtra en el cliente por nombre del cliente, nombre o mail de sus administradores, como antes).
- **Tabla "Clientes"** (antes, tarjetas en dos columnas): Cliente (nombre 500, "(la tuya)") · Administradores (escudo + "nombre · mail" y
  "Pendiente" o "De baja" como punto + palabra; "Pendiente" con **"Reenviar"** al lado, como el botón de antes; con más de uno, el primero
  y **"+N"** (`aria-expanded`, "Ver N administradores más") para ver el resto, así la fila mantiene los 36 px; sin ninguno, "Sin
  administrador: agregale uno." en peligro) · Usuarios activos (mono) ·
  Estado (Activo / Suspendido; el suspendido lleva el nombre en `--crm-text-2` en vez de la opacidad de antes) · `⋮` **"Acciones de
  <cliente>"**: "Agregar administrador", "Reenviar invitación a <mail>" por cada administrador pendiente (también a la vista, arriba) y
  "Suspender" (danger → `ConfirmDialog` "Suspender cliente", mismo texto) / "Reactivar". Con
  menos de 45rem de tabla, los administradores, los usuarios y "Suspendido" bajan bajo el nombre.
- **Drawers:** "Nuevo cliente" ("Se crea con su administrador"; `#cli-nombre`, `FormSection` "Administrador del cliente" con
  `#cli-admin-nombre` y `#cli-admin-email`, los textos de siempre; "Crear cliente") y "Agregar administrador" (descripción = el cliente;
  "Agregar administrador"). `sinTrabarse`; las acciones de fila atrapan si la Server Action tira y van **de a una**: mientras corre una,
  `ejecutar` no arranca otra y los ítems del menú quedan bloqueados (`aria-disabled`; en Usuarios, igual). Sin SMTP, el link de activación en
  `LinkManual` (generalizado desde Usuarios: `components/crm/LinkManual.tsx`). El overlay "Guardando…/Actualizando…" pasó a una región
  viva `sr-only` + la tabla `busy`.
- **Estados:** vacío "Todavía no hay clientes en la plataforma"; sin resultados "Ningún cliente con «…»"; carga `ListSkeleton` "Cargando
  clientes…"; error: `admin/error.tsx` reexporta el de `(crm2)` (antes /admin no tenía boundary).
- **Verificación:** la demo no tiene superadmin. Se verificó en vivo la redirección de no superadmins (Administrador, Vendedor,
  Responsable comercial → `/dashboard`; Solo lectura → `/empresas`) y, con un arnés de desarrollo borrado al terminar (datos falsos,
  Server Actions abortadas), el árbol nuevo en 6 anchos × claro/oscuro. La pantalla real con un superadmin queda sin ver.

**Sin permisos** (`(crm2)/sin-permisos/`, `git mv`): texto + una acción discreta, en el área de trabajo; sin escena ni ícono. Para un rol
sin ninguna sección, el h1 de siempre ("Tu rol todavía no tiene secciones habilitadas"); para alguien que sí tiene secciones y entró
directo, uno neutro que no contradiga al rail ("No tenés permisos para ver esta sección."); la indicación de siempre y **"Volver al
inicio"** (secundario, link a `/dashboard`, que manda a cada rol a su primera pantalla o de vuelta acá).

**Buscar / IA:** `(app)/buscar/` y `(app)/ia/` son solo Server Actions (la paleta Ctrl+K y la IA de Alertas y de la ficha), no pantallas:
no hay UI que migrar y quedan en `(app)/`.

**Retiro de `(legacy)`:** se borraron `(legacy)/layout.tsx` (el wrapper `p-3 md:p-8 print:p-0` + `max-w-7xl`), `(legacy)/error.tsx` y
`(legacy)/loading.tsx` y las carpetas vacías que quedaban. Toda ruta del CRM tiene los boundaries de `(crm2)` (más los suyos propios) y
`/admin` los suyos. Impresión: `[data-app-main] > div` ahora alcanza la raíz de cada pantalla (verificado en el presupuesto: shell
`block`, main sin overflow ni padding, chrome oculto). **Se borraron** por quedar sin usos (ninguno congelado): `components/{ConfirmModal,
Drawer,RowActions,ThemeToggle,form}.tsx` y `components/ui/{EmptyState,OverlayCarga,PantallaCarga,Loader,MoneyInput}.tsx`. Quedan sin
usos, de antes del Lote F y sin tocar: `components/Paginacion.tsx` y `components/ui/KpiCard.tsx`.

**Generalizado en el Lote F:** `Tabs vertical`, `prefetch` y `dot` (§10.7); `Button loading` sin `disabled` (§10.1); `SectionBar` →
`id` y contador en sans salvo una cifra suelta; `AppFrame`/`RailNav`/`Topbar` → `plataforma` (la marca va a `/admin`) / `onBuscar`
opcional; `LinkManual`; `lib/navegacion.ts` → `SECCIONES_PLATAFORMA`; migas → `/admin` = "Clientes".

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
- **DatePicker** (§10.15): en el campo, tipear + Enter/salir confirman, Alt+↓ abre. Abierto, el foco va al día elegido (o hoy, o el
  más cercano dentro del rango); ←/→ un día, ↑/↓ una semana, Home/End inicio/fin de semana (lunes/domingo), RePág/AvPág un mes,
  Shift+RePág/AvPág un año (cambiar de mes sigue al foco), Enter/Espacio eligen; Tab recorre cabecera → grilla (una parada,
  roving tabindex) → hora → pie y al salir cierra y deja el foco en el botón del calendario; Escape cierra SOLO el calendario y
  devuelve el foco al campo (dentro de un drawer, el siguiente Escape cierra el drawer).
- **Grilla (Etapa 3, construido):** ↑/↓ mueve la selección desde la fila con foco (optimista, una sola navegación al soltar), Enter en el nombre abre la ficha, Esc cierra la vista previa si no hay una capa abierta (detalle en §10.13).
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
