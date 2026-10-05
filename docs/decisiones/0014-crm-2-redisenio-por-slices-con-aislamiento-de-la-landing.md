# 0014. CRM 2.0: rediseño por slices verticales con aislamiento de la landing

- **Estado:** Aceptada
- **Fecha:** 2026-10-04 a 2026-10-05 (rama `crm-2.0`, commits `341dc27` a `064ba3d`; versión 2.0.0, sin migraciones)

## Contexto

La interfaz del CRM de la 1.0.0 se había armado sobre el Sumar UI Kit, con la estética de la landing (césped, Varela Round, Jakarta) trasladada al
marco. Había que rediseñarla entera con un sistema más denso y sobrio ("Ledger": tokens propios, IBM Plex, un solo acento) bajo cuatro restricciones:

- **La landing (`/`) y las pantallas de acceso (`/login`, `/recuperar`, `/definir-clave`) no podían cambiar ni un píxel.** No son independientes del CRM: comparten
  `globals.css` (`@theme inline`, `:root`, `.dark`, el bloque `LANDING`), el layout raíz (fuentes, `ToastProvider` y `TooltipHost`) y `ui/UIComponents.tsx`. Tocar `--radius`,
  `--font-sans` o renombrar un token en `globals.css` cambia la landing y el login.
- **Cero capacidades nuevas.** Mismos datos, permisos, filtros, acciones y mensajes; el rediseño no toca la base ni agrega migraciones.
- **La aplicación está en producción** y las pruebas E2E y el manual dependen de nombres accesibles y textos que no podían moverse (MASTER §13.2).
- Son unas 25 pantallas (las de la baseline del CRM) y un marco: un cambio único habría sido imposible de revisar.

Decisión de proceso y de arquitectura: cómo migrar sin romper lo congelado ni dejar una aplicación a medio hacer. Contrato completo en
[`design-system/crm-2/README.md`](../../design-system/crm-2/README.md); sistema visual en [`design-system/crm-2/MASTER.md`](../../design-system/crm-2/MASTER.md).

## Decisión

**1. Rama larga `crm-2.0` y slices verticales.** Se trabaja en una rama aparte y cada paso deja la aplicación funcionando: la Etapa 0 pone las guardas (`341dc27`), la 1 el
sistema y los primitivos sin conectarlos a ninguna pantalla (`64ed7e4`), la 2 el marco (`8c59a36`), la 3 el primer slice completo (Empresas, `a3f61a3`), y después los
lotes A a F (contactos y productos; ventas, alertas y usuarios; oportunidades; presupuesto; inicio, tablero y embudo; configuración, panel de plataforma y «Sin permisos»).
Un slice es una pantalla migrada de punta a punta (lista, ficha, drawers, carga y error), con la definición de terminado de MASTER §15.

**2. Dos grupos de rutas durante la migración, uno al final.** `src/app/(app)/(crm2)/` tenía las pantallas migradas y `src/app/(app)/(legacy)/` las que faltaban, con su
propio layout (el padding y el ancho de antes). Cada pantalla pasó de un grupo al otro con `git mv`, así las URLs no cambiaron. En el Lote F el grupo `(legacy)` quedó vacío y
se **retiró** (`69cbd6e`): hoy todas las pantallas están en `(crm2)` y se borraron los componentes que solo ellas usaban.

**3. Aislamiento por `[data-crm]`.** `CrmRoot` envuelve el CRM en un `<div data-crm>` (`display: contents`: no genera caja ni cambia layout, scroll o impresión). Todo el CSS nuevo
vive en `src/app/(app)/crm.css` y solo puede tener selectores que cuelguen de `[data-crm]`, sin at-rules globales (`@theme`, `@layer`, `@property`, `@import`, `@font-face`);
solo lo importan los layouts de `(app)` y de `admin`, nunca el raíz.

**4. Tokens `--crm-*`, nunca se redefine una variable existente.** Se consumen con utilidades de Tailwind v4 que leen la variable (`bg-(--crm-panel)`), no con clases propias en
`crm.css`: así `tailwind-merge` sigue resolviendo conflictos y no hay CSS sin capa que le gane a una utilidad. El contraste de cada par se mide en `npm test`
(`contrasteCrm.check.ts`).

**5. Fuentes solo en el layout del CRM.** IBM Plex Sans y Mono se cargan en `CrmRoot`; la landing y el acceso no las descargan.

**6. Guardas con baselines de píxeles y hashes congelados.** `npm run guard` combina `guard:frozen` (hashes de los archivos congelados en
`design-system/crm-2/guard/frozen-files.json`, chequeo de la carpeta `landing/`, `git diff` contra la base y las reglas de `crm.css`) y `guard:landing` (Playwright, tolerancia cero
sobre `/`, `/login` y `/recuperar` contra baselines commiteadas). La lista congelada es la clausura transitiva de imports de esas pantallas. Un cambio aprobado de un archivo congelado
tiene un procedimiento explícito (commitear, regenerar baselines y manifiesto, revisar el diff en el PR).

**7. Master-detail con estado en la URL, sin rutas paralelas.** La vista previa de Empresas y Contactos es `?sel=<id>`: la página servidor la dibuja en un
`<Suspense key={sel}>` y la lista marca la fila de forma optimista. Las fichas llevan su tab en `?tab=` y Configuración su sección en `?s=`.

**8. Sin capacidades nuevas.** Las lecturas, las mutaciones desde el navegador, las Server Actions, los permisos y las reglas de la base son los de la 1.0.0 (ver
[0001](./0001-mutaciones-desde-el-cliente.md)). Cada slice se compara contra la versión anterior (en Inicio, cifra por cifra) y la suite E2E tiene que pasar sin cambiar aserciones.

## Alternativas descartadas

- **Restyle global.** Cambiar los tokens y los primitivos de `globals.css` y `ui/` habría rediseñado el CRM en un solo commit, pero también la landing y el login, que comparten esos archivos:
  exactamente lo que no podía pasar, y sin una forma de demostrarlo. Con el aislamiento la prueba es mecánica (hashes y píxeles).
- **Rutas paralelas o interceptadas para la vista previa.** `@slot` con rutas interceptadas sirve cuando el panel es una ruta con identidad propia; acá la ficha completa ya existe
  (`/empresas/[id]`) y el panel es una vista de la lista, que depende de sus filtros y de la página. Con `?sel=` hay una sola fuente de verdad en la URL, el link se comparte, atrás y
  adelante andan, y no hay un segundo árbol de rutas (`default.tsx`, slots) que mantener sincronizado con la lista.
- **Una librería de componentes.** El proyecto ya era Tailwind v4 sin librería de componentes, y el sistema pide una densidad (filas de 36 px), un teclado y unos contratos de
  accesibilidad concretos, además de CSS que no puede salir de `[data-crm]`. Una librería suele traer sus propios temas y estilos globales, que entrarían en conflicto con las reglas de
  aislamiento. Se prefirió un conjunto chico de primitivos propios (`src/components/crm/`), con la spec de cada uno en MASTER §10.

## Consecuencias

- **Bueno.** La landing y el acceso quedan intactos y eso se verifica con un comando. La migración fue incremental: cada commit deja una aplicación que anda. Los tokens y las fuentes del CRM
  no llegan a la landing (no hay reglas `[data-crm]` en su documento ni precarga de IBM Plex) y sus píxeles son idénticos (guarda: 0 px). La selección de una fila se puede compartir como link. El contraste de los tokens lo mide `npm test` (123 de las 442 pruebas).
- **Cuesta.** Durante la migración convivieron dos juegos de primitivos; hoy `src/components/ui/` sigue vivo por la landing y el acceso (`UIComponents`, `Toast` y `Tooltip` están congelados) y los
  archivos que quedaron sin usos (`ui/Select.tsx`, `ui/overlay.ts`, `ui/KpiCard.tsx` y `components/Paginacion.tsx`) se borraron antes de la 2.0. La hoja de estilos global de la landing
  creció de unos 140 KB a unos 163 KB sin comprimir (alrededor de 4 KB más con gzip) porque Tailwind v4 escanea todas las fuentes, las del CRM incluidas, y vuelca a `globals.css` las
  utilidades que usan `--crm-*` (265 referencias): es peso inerte, sin efecto visual. Excluir las fuentes del CRM del escaneo exigiría editar `globals.css`, que está congelado; se aceptó el costo. Tras una navegación del lado del cliente del CRM a la landing, `crm.css` ya descargado sigue en el
  documento: es inerte por diseño (todo cuelga de `[data-crm]`). Los `title="…"` del CRM están prohibidos porque el `TooltipHost` del layout raíz los reescribe.
- **Límites de las guardas.** Cubren `/`, `/login` y `/recuperar` (`/definir-clave` solo por hashes), con movimiento reducido, y no protegen a las baselines ni al manifiesto: un `--update` mal
  usado pasaría, así que todo diff en `design-system/crm-2/guard/` se revisa en el PR. Las baselines son de Chromium en Windows y las guardas no están en la CI todavía.
- **Seguimiento.** Los archivos congelados solo se tocan con una decisión explícita. Una pantalla nueva va directo a `(crm2)` con los primitivos de `components/crm`.
