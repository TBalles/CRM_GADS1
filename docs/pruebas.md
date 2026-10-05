# Pruebas y verificaciones

Todo lo que se puede ejecutar para comprobar que el proyecto está sano, cómo correrlo, qué demuestra y cómo
leer el resultado. No hay framework de pruebas: los self-checks usan el runner de Node y las pruebas SQL se
pegan en el SQL Editor de Supabase.

**Estado con la 2.0.0 (CRM 2.0)** (ejecutado al cerrar el rediseño, 2026-10-05; el rediseño no agregó migraciones ni cambió la base):

| Verificación | Resultado |
|---|---|
| `npm test` (`node --test "src/**/*.check.ts"`) | **37 archivos, 442 pruebas, 442 pasan, 0 fallan** (12 archivos nuevos y 14 pruebas más en `money` y `oportunidades`; 123 de las 442 son los pares de contraste de `contrasteCrm.check.ts`) |
| `npm run lint` (`eslint src e2e playwright.config.ts scripts/guard playwright.guard.config.ts --max-warnings=0`) | Sin advertencias |
| `npm run guard:frozen` | Pasa: 39 archivos congelados intactos y ningún cambio respecto de `main`; `crm.css` solo bajo `[data-crm]` |
| `npm run typecheck` | Sin errores |
| `npm run build` | Compila. El listado de rutas tiene **25 entradas**: las 21 páginas (las mismas de la 1.0.0), los 2 route handlers, `/_not-found` e `/icon.svg` |
| `npm run guard` (con `GUARD_BASE_URL` apuntando a ese build) | `guard:frozen` pasa y `guard:landing`: **7 de 7** comparaciones de píxeles iguales (`/` a 1440, 768 y 390; `/login` y `/recuperar` a 1440 y 390) |
| Manual de usuario | `npm run manual:capturas` contra ese build y la demo (solo navegación) y `npm run manual:pdf`: **93 páginas**, 6,6 MB, 61 de 65 figuras capturadas y 4 pendientes (IA y superadmin); el índice coincide con el PDF |
| E2E (`npm run test:e2e`) | **No se corrieron** en el rediseño: escriben en la base. Se conservaron sus contratos (MASTER §13.2); tienen que correr en CI con los secretos después del merge |

Las pruebas SQL, el kit de migraciones y la CI son los de la 1.0.0 (el rediseño no tocó la base): su estado es el de la tabla siguiente.

**Estado con la 1.0.0 (F8)** (ejecutado al cerrar esa entrega, 2026-10-04):

| Verificación | Resultado |
|---|---|
| `npm test` (`node --test "src/**/*.check.ts"`) | **25 archivos, 243 pruebas, 243 pasan, 0 fallan** (F8 sumó `migraciones.check.ts`: 4 y `manual.check.ts`: 6) |
| `npm run typecheck` (`tsc --noEmit` sobre `src` y sobre `e2e`) | Sin errores |
| `npm run lint` (`eslint src e2e playwright.config.ts --max-warnings=0`; hoy también lleva `scripts/guard` y `playwright.guard.config.ts`) | Sin advertencias |
| `npx next build` (con las variables públicas de relleno que usa la CI) | Compila. El listado de rutas de `next build` tiene **25 entradas**: las 21 páginas (`page.tsx`, con la landing, el acceso y `/admin`), los 2 route handlers (`/auth/confirm` y `/auth/signout`), `/_not-found` e `/icon.svg`; `/oportunidades/[id]/presupuesto` está entre ellas (la línea "Generating static pages (22/22)" cuenta otra cosa: páginas generadas, no rutas) |
| Pruebas SQL `0005`, `0007`, `0008`, `0009`, `0011` y `0012` | Todas `TODO OK` en PGlite con `0001` a `0007` y después **solo** el kit `supabase/aplicar/aplicar_0008_a_0012.sql` (aplicado dos veces). **No se corrieron contra la base viva**: las migraciones `0008` a `0012` no están aplicadas ahí |
| Kit de migraciones | Las 24 verificaciones del `select` final dicen `OK` y el `TOTAL`, `TODO OK`, también con el bloque `pg_trgm` encendido; sobre una base solo con la `0007` dice `HAY 22 FALTANTES` (prueba negativa) |
| Manual de usuario | `npm run manual:pdf`: 89 páginas, 7,2 MB; el índice coincide con las páginas del PDF completo y se revisó página por página (portada, índice, tablas, figuras y última página) |
| `npx playwright test --list` | 14 pruebas en 3 archivos compilan. **La suite E2E no se ejecutó contra una base real**: la organización de pruebas todavía no existe (ver [§5](#5-pruebas-e2e-con-playwright)) |
| `.github/workflows/ci.yml` | El YAML se parseó (PyYAML). **No se ejecutó en GitHub Actions** |

Contenido: [1. Resumen](#1-resumen) · [2. Self-checks](#2-self-checks-con-node---test) ·
[3. Verificación estática](#3-verificación-estática-y-build) · [4. Pruebas SQL](#4-pruebas-sql) ·
[5. Pruebas E2E con Playwright](#5-pruebas-e2e-con-playwright) · [6. Integración continua](#6-integración-continua) ·
[7. Cómo leer un resultado](#7-cómo-leer-un-resultado) · [8. Antes de hacer push](#8-antes-de-hacer-push) ·
[9. Lo que todavía no se prueba](#9-lo-que-todavía-no-se-prueba) ·
[10. Guardas de aislamiento de CRM 2.0](#10-guardas-de-aislamiento-de-crm-20)

---

## 1. Resumen

| Qué | Cómo se corre | Dónde | Qué prueba |
|---|---|---|---|
| Self-checks (37 archivos, 442 pruebas) | `npm test` (= `node --test "src/**/*.check.ts"`) | Terminal | Lógica pura: dinero, íconos, permisos, mails, mensajes, CUIT, sitio web, vocabulario de clientes, reglas de oportunidades, paginación y búsqueda por URL, errores de esquema faltante, licitaciones, parque instalado, equipamiento sugerido, recambio, ficha 360, tablero del responsable, conversión del embudo, búsqueda global, cuentas del presupuesto, **el marco y los primitivos de CRM 2.0** (selección y teclado, fechas, rail y migas, barras de datos, la lógica de cada pantalla migrada, el contraste de los tokens `--crm-*` y `sinTrabarse`), la IA asistida (contexto sin datos personales, errores, límite), que el kit de migraciones esté al día con las migraciones (`migraciones.check.ts`) y que las figuras del manual de usuario existan y los scripts no lleven contraseñas (`manual.check.ts`) |
| Tipos | `npm run typecheck` (= `next typegen && tsc --noEmit && tsc --noEmit -p e2e && tsc --noEmit -p scripts/guard`) | Terminal | Que todo el TypeScript compile: `src`, las pruebas E2E y las guardas |
| Lint | `npm run lint` (= `eslint src e2e playwright.config.ts scripts/guard playwright.guard.config.ts --max-warnings=0`) | Terminal | Estilo y errores comunes, sin tolerar advertencias |
| Guardas de CRM 2.0 | `npm run guard` (= `guard:frozen` + `guard:landing`) | Terminal | Que la landing y el acceso no cambien: hashes de los archivos congelados y pixel diff de `/`, `/login` y `/recuperar` (ver [§10](#10-guardas-de-aislamiento-de-crm-20)). **No corren en la CI** |
| E2E | `npm run test:e2e` (= `playwright test`) | Terminal, contra una app y la organización de pruebas | La demo de punta a punta, los roles, la paginación por URL, Ctrl+K y la hoja del presupuesto. Se saltan sin credenciales |
| CI | `.github/workflows/ci.yml` | GitHub Actions | Lint, tipos, self-checks y build en cada push; E2E en `main` si están los secretos |
| Build | `npx next build` | Terminal | Que la aplicación se construya (incluye el chequeo de `server-only`) |
| `0005_permisos.sql` | Pegar en el SQL Editor | Supabase | Aislamiento entre organizaciones y permisos |
| `0007_reglas.sql` | Pegar en el SQL Editor | Supabase | Reglas de la migración 0007 |
| `0008_baja_logica.sql` | Pegar en el SQL Editor, con la 0008 aplicada | Supabase | Que borrar empresas o contactos afecte 0 filas y que la baja lógica (`estado = 'inactivo'`) funcione |
| `0009_reglas_oportunidades.sql` | Pegar en el SQL Editor, con la 0009 aplicada | Supabase | Fecha de cierre no futura (fecha de Argentina), empresa o contacto obligatorio para usuarios (no para scripts ni para `on delete set null`), y que las reglas de la 0007 sigan en pie |
| `0011_rubro.sql` | Pegar en el SQL Editor, con la 0011 aplicada | Supabase | Canchas y licitaciones: CHECK, aislamiento entre organizaciones, cartera propia del Vendedor, solo lectura, sin borrar; la regla de la apertura (por `update` y por `cambiar_etapa`, con fecha de Argentina); `venta_item_id` y una sola oportunidad abierta por equipo (la segunda falla con `23505`; al cerrar la primera se puede abrir otra) |
| `0012_presupuestos.sql` | Pegar en el SQL Editor, con la 0012 aplicada | Supabase | Presupuestos: numeración correlativa por organización (el cliente no elige el número, un alta fallida no deja huecos, el UNIQUE respalda), aislamiento y cartera propia, inmutabilidad (solo `actividad_id`, una vez), sin borrar, contadores inaccesibles desde la API y borrado en cascada de la organización |
| `0007_reejecucion.sql` | Pegar con la migración dos veces | Supabase | Que la 0007 se pueda re-ejecutar sin efectos |

---

## 2. Self-checks con `node --test`

Cada archivo `*.check.ts` se ejecuta directamente con Node, sin bundler ni framework. Por eso los módulos
que prueban usan imports relativos con extensión (`./permisos.ts`) y no el alias `@/`: Node no lee los
`paths` de `tsconfig`.

```bash
# todos (el script `test` de package.json: anda igual en Windows, macOS y Linux porque Node expande el glob)
npm test
node --test "src/**/*.check.ts"

# uno solo
node --test src/lib/money.check.ts
node --test src/lib/equipo.check.ts
node --test src/lib/permisos.check.ts
node --test src/lib/cuit.check.ts
node --test src/lib/email/layout.check.ts
node --test "src/app/(app)/(crm2)/alertas/plantillas.check.ts"
node --test src/components/crm/seleccion.check.ts
node --test src/components/crm/fecha.check.ts
node --test src/lib/contrasteCrm.check.ts
node --test src/lib/guardar.check.ts
node --test src/lib/oportunidades.check.ts
node --test src/lib/paginacion.check.ts
node --test src/lib/timeline360.check.ts
node --test src/lib/tablero.check.ts
node --test src/lib/embudo.check.ts
node --test src/lib/paleta.check.ts
node --test src/lib/presupuesto.check.ts
node --test src/lib/ia/contexto.check.ts
node --test src/lib/ia/errores.check.ts
node --test src/lib/ia/limite.check.ts
```

Requiere un Node que ejecute TypeScript directamente; se verificó con Node 24.14.1 y la CI usa Node 22 (las versiones
22.18 y posteriores ya traen la eliminación de tipos sin flags; **no se verificó en Node 22 localmente**). Aparece una advertencia `MODULE_TYPELESS_PACKAGE_JSON` porque
`package.json` no declara `"type": "module"`; es inofensiva.

| Archivo | Pruebas | Qué demuestra |
|---|---|---|
| `src/lib/money.check.ts` | 18 | La máscara de dinero es-AR agrupa miles con puntos, usa la coma como decimal (máximo 2), descarta basura y ceros iniciales; `parseMoney` nunca devuelve `NaN` ni lanza; el cursor se mantiene al editar en el medio del monto; **CRM 2.0:** el cursor del `MoneyInput` tras tipear la coma o los decimales, borrar, pegar y la tecla rechazada ("1500" + "," + "50" da "1.500,50") |
| `src/lib/equipo.check.ts` | 3 | El nombre manda sobre la categoría y "red para arco" es una red; una marca ("Redex") no se confunde con el producto; sin pista en el nombre decide la categoría, y sin nada es "otro" |
| `src/lib/permisos.check.ts` | 8 | El CHECK de `roles.permisos` de la **migración 0007** tiene exactamente las claves del catálogo de TypeScript; los roles por defecto de SQL coinciden con `ROLES_POR_DEFECTO`; las dependencias apuntan a permisos que existen y se agregan de forma transitiva; el Administrador tiene los 19; `rutaInicial` elige la primera pantalla permitida |
| `src/lib/email/layout.check.ts` | 8 | El HTML de los mails escapa el contenido (no se puede inyectar `<script>`); `urlSegura()` solo deja `http(s)` y `mailto`, y `javascript:` no llega a un `href`; el logo es por CID, sin imágenes externas; la versión en texto plano trae contenido y link; las plantillas de activación y recuperación |
| `src/lib/oportunidades.check.ts` | 23 | Qué etapas sirven para cada acción (columnas del tablero, cierre a ganada o perdida, reabrir); qué acciones se ofrecen según estado y permisos; validación del cierre (motivo al perder, fecha real no futura, razón al reabrir), probabilidad y fechas; los errores de la base (42501, 23514, 23503, P0001) en palabras; el cambio de resultado (ganada a perdida y al revés) pide razón y motivo, y no admite repetir la fecha del cierre anterior; la línea de tiempo mezcla actividades y cambios de etapa sin mutar y titula cada uno (alta, registro inicial, cierre, reapertura, cambio de resultado); la auditoría traduce campos e ids; **CRM 2.0:** la etapa propuesta y el aviso de cada acción de cambio de etapa, el recorrido del embudo (hechas, actual y pendientes; una cerrada no inventa el recorrido), un solo texto cuando el estado y la etapa de cierre dicen lo mismo y el aviso de cerrada |
| `src/lib/paginacion.check.ts` | 14 | **F3.** `filtroOr` hace la búsqueda **literal**: `%`, `_`, `\` y `*` no son comodines de quien escribe, y una coma, un paréntesis o una comilla no rompen el `.or()` de PostgREST (el check emula lo que PostgREST y `ILIKE` hacen con el valor); `leerPaginacion` y los `*Param` rechazan `page=-4`, `pageSize=5000`, un estado inventado o un uuid falso; rango, total de páginas, "Mostrando 21–40 de 134" y la ventana de números con "…"; `urlConParams` conserva los demás parámetros y no escribe los valores por defecto; `leerPagina` detecta la página fuera de rango (`PGRST103`) y propaga los errores de la base en vez de devolver una lista vacía |
| `src/app/(app)/(crm2)/alertas/plantillas.check.ts` | 10 | Formato de fecha sin zonas horarias; saludo con nombre de pila o al club; la frase distingue vencido de por vencer; el verbo concuerda en plural; sin fecha de vencimiento no inventa plazo; el mensaje de WhatsApp es más corto que el del mail; los links de WhatsApp y `mailto` codifican bien |
| `src/lib/timeline360.check.ts` | 14 | **F5.** La historia junta las cinco fuentes, ordenada de más reciente a más vieja y sin depender del orden de entrada; los empates se resuelven siempre igual; la fila inicial del historial no es un cambio (salvo que ya naciera cerrada); cierre, reapertura y cambio de resultado se titulan bien; el filtro por chip ("Etapas" incluye las altas) y sus cuentas; el agrupado por mes **argentino** (las 22:00 del 30/09 no pasan a octubre); "Ver más" por tramos; el resumen con cifras calculadas a mano (y la primera compra consultada aparte), sus umbrales de 30 y 90 días y los casos sin datos |
| `src/lib/tablero.check.ts` | 15 | **F5.** `?dias=` y `?mes=` no confían en la URL; el rango del mes (también diciembre); `sinActividad`: el día del umbral ya cuenta, vale la actividad de la oportunidad, de su empresa o de su contacto, la que nunca tuvo se cuenta desde el alta y la más vieja que lo leído sale con "más de"; pipeline por responsable, cierres del mes y ranking de motivos con empates |
| `src/lib/embudo.check.ts` | 12 | **F5.** Fixtures calculados a mano con cinco oportunidades: una normal, una que **se salta una etapa**, una que **vuelve atrás**, una **reabierta** y una trabada. Entraron, avanzaron, conversión, mediana de estadías terminadas y "hasta hoy" para las que siguen, tasa de éxito y ciclo; sin historial; el orden del historial no cambia el resultado; la cohorte por día argentino y por origen |
| `src/lib/presupuesto.check.ts` | 20 | **F6.** Las cuentas del presupuesto en centavos enteros y con valores hechos a mano: el redondeo medio hacia arriba (1,005 → 1,01, sin el error de los flotantes), el importe de una línea con su descuento, la **regla de IVA** (Responsable Inscripto: precios netos, IVA 21 % sobre el neto y total con IVA; Monotributo, Exento o sin condición: sin discriminar y el total es el neto), el IVA redondeado una sola vez sobre el neto, las leyendas, el formato es-AR con centavos, el número `N° 000042` y «Borrador», la aritmética de la validez (cruce de mes y de año, bisiestos), la validación de líneas, el saneo del `jsonb` que viene de la base, **la foto del emisor** (armarla desde la organización y leerla del `jsonb`) y el título de la actividad |
| `src/lib/ia/contexto.check.ts` | 20 | **F7.** El contexto que se manda a la IA: se intentan tachar mails (también sin punto o `[at]`), usuarios `@`, enlaces y dominios sueltos o acortadores, CUIT y teléfonos o DNI en los textos libres, incluidos los que tienen forma de fecha (`11.45.6789`), y no las fechas reales ni las cantidades; un texto no puede cerrar el bloque `<DATOS>`; solo el nombre de pila; el aviso lleva los hechos que necesita y las canchas dadas de baja no viajan; lo que el rol no ve se declara desconocido; topes por tipo y total |
| `src/lib/ia/errores.check.ts` | 20 | **F7.** `ANTHROPIC_API_KEY` vacía apaga la función; modelo por defecto `claude-opus-5-5`; `effort` solo con los modelos que lo aceptan; un solo tope de largo (2000); con **errores reales del SDK** (429, 401, 403, 529, 500, 400, sin conexión y timeout) cada uno da su frase y ninguna filtra el mensaje del proveedor ni una clave; `refusal`, `max_tokens`, respuesta vacía y otros `stop_reason` no son un borrador; el texto tiene tope |
| `src/lib/ia/limite.check.ts` | 6 | **F7.** El límite por persona: deja pasar hasta el máximo, dice cuánto esperar, la ventana se desliza, cada persona tiene su cupo, una llamada rechazada no consume cupo y el Map no crece sin techo |
| `src/lib/paleta.check.ts` | 10 | **F5.** Las rutas piden permisos que existen; el menú por rol (el Vendedor no ve las dos pantallas del equipo); en qué tablas se busca según el rol; la consulta se limpia y exige 2 caracteres; grupos en orden fijo con tope de 5; las acciones rápidas por rol, con la caja vacía y con texto; las flechas dan la vuelta; los ids de las opciones |
| `src/lib/guardar.check.ts` | 2 | **CRM 2.0.** `sinTrabarse`: si el guardado termina no libera nada y devuelve `true`; si **tira**, llama a `liberar` con "No se pudo completar la acción. Intentá de nuevo.", devuelve `false` y no propaga el error |
| `src/lib/contrasteCrm.check.ts` | 123 | **CRM 2.0.** Lee el `crm.css` real y mide el contraste de cada par texto/fondo y de UI en claro y oscuro contra su mínimo (`PARES` en `src/lib/contrasteCrm.ts`); falla con el nombre del par si alguien cambia un color. Además: el lector de colores (hsl, hex, `var`, `color-mix`), que cada token usado esté definido en los dos temas y que todo color esté medido o exceptuado con motivo |
| `src/components/crm/seleccion.check.ts` | 7 | **CRM 2.0.** Master-detail por URL: ↑/↓ (`vecinoSel`) cuenta desde la fila con foco, sin vuelta en los bordes; ↓↓↓ seguidas terminan en la fila correcta; `tabValida` cae en la primera; a qué fila va el foco cuando una acción saca la suya de la lista (`filaTrasRefresco`) |
| `src/components/crm/teclado.check.ts` | 6 | **CRM 2.0.** Teclado de los primitivos: flechas según la orientación, vuelta que salta los deshabilitados, búsqueda por letras sin mayúsculas ni tildes, tipeo acumulado (500 ms) y paradas de Tab de un grupo de radios |
| `src/components/crm/fecha.check.ts` | 12 | **CRM 2.0.** `DatePicker`: bisiestos, fecha inexistente, "hoy" en hora local (no UTC), aritmética de días y meses sin desbordes, semana de lunes, grilla de 6 × 7, rangos min/max, textos es-AR, máscara dd/mm/aaaa, horas y minutos, y qué es un texto borrado frente a uno inválido |
| `src/components/crm/barra.check.ts` | 3 | **CRM 2.0.** Barras de datos: `anchoBarra` proporcional a la mayor con piso de 2 % y sin barra para el cero; `porcentajeDe` y por qué las filas redondeadas no suman 100 |
| `src/components/crm/shell/logica.check.ts` | 6 | **CRM 2.0.** El marco: secciones del rail por rol (las vacías no aparecen), ruta actual sin confundir prefijos, cookie del rail (ida y vuelta; otro valor es expandido) y migas (lista, ficha con y sin nombre, presupuesto, rutas desconocidas) |
| `src/app/(app)/(crm2)/alertas/logica.check.ts` | 4 | **CRM 2.0.** Alertas: los tres contadores, filtro por grupo, búsqueda en cliente, producto y contacto, y el texto del vencimiento |
| `src/app/(app)/(crm2)/ventas/logica.check.ts` | 6 | **CRM 2.0.** Ventas: ítems por venta, total, singular y plural, la entrega que sigue a la fecha de la venta, validación de líneas y "hoy" local |
| `src/app/(app)/(crm2)/usuarios/logica.check.ts` | 4 | **CRM 2.0.** Usuarios: estado (la baja manda sobre pendiente), grupos de permisos que cubren el catálogo, tildado con dependencias y los mensajes del formulario de rol |
| `src/app/(app)/(crm2)/configuracion/logica.check.ts` | 5 | **CRM 2.0.** Configuración: `?s=` válido y lo demás cae en "Datos de la empresa", el link de cada sección, renumerado de un catálogo al subir o bajar (solo escribe las filas que cambian) y detección de cambios sin guardar |
| `src/app/(app)/(crm2)/oportunidades/[id]/presupuesto/logica.check.ts` | 9 | **CRM 2.0.** Editor de presupuesto: líneas iniciales, ida y vuelta con la máscara es-AR, líneas nuevas, cambio de producto, mover y quitar líneas con el foco que corresponde, y totales iguales a los de la hoja |

`permisos.check.ts` lee `supabase/migrations/0007_entrega_final.sql`. **Si agregás un permiso, hay que
tocarlo en `src/lib/permisos.ts` y en la migración que redefina el CHECK y los roles por defecto**, o este
self-check falla. Es la red de seguridad contra guardar un rol que la base rechace.

### Cómo leer el resultado

```text
✔ maskMoney groups thousands with dots (1.2ms)     <- pasó
✖ nombre de la prueba                               <- falló, con el diff esperado vs. real debajo
ℹ tests 37
ℹ pass 37
ℹ fail 0
```

Lo que importa son las tres últimas líneas: `fail 0` es éxito. El proceso termina con código de salida distinto
de 0 si algo falla.

---

## 3. Verificación estática y build

```bash
npm run typecheck        # next typegen, tsc --noEmit (src), tsc --noEmit -p e2e y tsc --noEmit -p scripts/guard (cada uno con su tsconfig)
npm run lint             # eslint src e2e playwright.config.ts scripts/guard playwright.guard.config.ts --max-warnings=0
npx next build
```

- `tsc --noEmit` compila sin generar archivos. Un error de tipos en cualquier archivo corta. `e2e/` y
  `playwright.config.ts` están **excluidos del `tsconfig.json` raíz** (así `next build` no depende de los tipos de
  Playwright y el chequeo de `src` queda igual) y se chequean aparte con `e2e/tsconfig.json`.
- `eslint … --max-warnings=0` trata cualquier advertencia como error; desde F6 alcanza también a `e2e/` y a `playwright.config.ts`.
- En F7 se comprobó además, a mano, que el SDK de Anthropic no aparece en ningún chunk de `.next/static` (`rg -il anthropic .next/static`
  solo encuentra el texto de "Cómo usamos la IA").
- `next build` además comprueba que `src/lib/supabase/admin.ts` (que importa `server-only`) no termine
  importado desde un componente de cliente: si pasara, el build falla, y es la garantía de que la clave de
  servicio no llega al navegador.

Los tres tienen que pasar antes de pushear (ver [CONTRIBUTING](../CONTRIBUTING.md)).

`package.json` define los scripts `dev`, `build`, `start`, `lint` (lo mismo que corre la CI), `typecheck`, `test` y `test:e2e` (desde F6), y las
guardas de CRM 2.0: `guard`, `guard:frozen`, `guard:landing` y `guard:baseline-crm` (ver [§10](#10-guardas-de-aislamiento-de-crm-20)).

---

## 4. Pruebas SQL

Tres scripts en `supabase/tests/`. Todos:

- se pegan **enteros** en el **SQL Editor** de Supabase y se ejecutan;
- crean organizaciones y usuarios de prueba, y se hacen pasar por cada uno **como lo hace la aplicación**
  (`set local role authenticated` más un JWT con el `sub` del usuario);
- corren dentro de una transacción que termina en `ROLLBACK`: **no dejan nada en la base**;
- cortan con un `ERROR` que empieza con `FALLA:` apenas algo se cumple de más o de menos.

### Cuál corre antes y cuál después de la 0007

| Script | Requiere | Se corre | Por qué |
|---|---|---|---|
| `0005_permisos.sql` | `0004`, `0005` y **`0007` aplicadas** | **Después** de la 0007 | Desde la 0007 usa los nombres de rol nuevos (`Vendedor`, `Solo lectura`), exige que el Vendedor vea solo su cartera, y espera que la organización nueva reciba 4 roles y 6 etapas |
| `0007_reglas.sql` | **`0007` aplicada** (o la migración dentro de la misma transacción) | **Después** | Prueba objetos que crea la 0007 |
| `0007_reejecucion.sql` | Una base **sin** la 0007 | **Antes**, y nunca en una base que ya la tiene | Corre la migración **dos veces** dentro de la prueba para comprobar que es re-ejecutable. Hay que reemplazar cada línea `-- @@ MIGRACION 0007 @@` por el contenido completo de la migración (son dos líneas) |

`0009_reglas_oportunidades.sql` se corre **después** de aplicar la 0009. Se ensayó junto con `0005_permisos.sql`,
`0007_reglas.sql` y `0008_baja_logica.sql` en PGlite (la 0009 aplicada dos veces, para comprobar que es
idempotente); sin la 0009 la prueba falla, como corresponde. Una prueba de la 0007 que creaba una oportunidad
sin empresa para probar el responsable ajeno ahora lleva empresa, porque la 0009 lo exige a los usuarios.

`0011_rubro.sql` se corre **después** de aplicar la 0011. Se ensayó en PGlite junto con `0005_permisos.sql`,
`0007_reglas.sql`, `0008_baja_logica.sql` y `0009_reglas_oportunidades.sql` (migraciones `0001` a `0011`, la 0011
aplicada dos veces para comprobar que es idempotente). Se hizo una prueba de mutación: sin el trigger
`oportunidades_licitacion_regla`, o sin el índice único de una abierta por equipo, o con una política `ver` de canchas sin la cartera, la prueba falla.

`0012_presupuestos.sql` se corre **después** de aplicar la 0012. Se ensayó en PGlite con las migraciones `0001` a `0012`
(la 0012 aplicada dos veces, para comprobar que es idempotente) y con las pruebas `0005`, `0007`, `0008`, `0009`,
`0011` y `0012` seguidas. Se hicieron pruebas de mutación: con un trigger de numeración que calcula `max(numero) + 1`
(sin contador por organización), con una política `borrar`, sin el trigger `presupuestos_proteger`, sin forzar `creado_por` o `actividad_id` en el alta, sin la excepción que deja soltar el vínculo cuando se borra la actividad, con `default 1` en `numero` y sin el CHECK de `condicion_iva`, la prueba falla.
**La concurrencia real no se puede probar con una sola conexión**; lo que se prueba es el mecanismo que la resuelve
(`insert ... on conflict do update ... returning` sobre el contador, que bloquea esa fila hasta el fin de la
transacción), que el cliente no elige el número y que el `UNIQUE (organizacion_id, numero)` frena un duplicado si el
trigger faltara.

**Si re-ejecutás la 0007, re-ejecutá la 0008 después.** La 0007 de este repositorio ya no recrea las
políticas `borrar` de `empresas` y `contactos`, pero una copia vieja de la 0007 sí lo haría.
`0008_baja_logica.sql` prueba, además de la baja lógica, el trigger que conserva una etapa ganada y una
perdida; se corre **después** de aplicar la 0008.

Como la base de producción ya tiene la 0007 aplicada, **`0007_reejecucion.sql` no se puede ejecutar ahí**.
Sirve para una base nueva o un ensayo antes de aplicar la migración. Antes de la 0007 el script
`0005_permisos.sql` que está en el repositorio ya no sirve (usa nombres de la 0007).

### `0005_permisos.sql`: aislamiento y permisos

Crea dos organizaciones de prueba (A y B) y usuarios con distintos roles. Comprueba, entre otras cosas:

- una organización nueva recibe 4 roles y 6 etapas;
- un usuario no obtiene organización desde `user_metadata` (editable por él mismo) ni un rol de otra
  organización;
- cada usuario ve solo lo de su organización: empresas, productos, etapas, roles, perfiles, organizaciones;
- no se puede insertar ni mudar una fila a la otra organización, ni colgar un contacto de una empresa ajena ni
  vender un producto del catálogo ajeno (claves foráneas compuestas);
- el Vendedor no edita el catálogo, no edita ni borra la bitácora, no se modifica su propio perfil, no
  administra roles y no puede ejecutar `registrar_envio_auth`;
- Solo lectura ve clientes pero no ventas ni bitácora, y no crea ni edita;
- el Administrador crea y edita roles propios, pero no edita ni borra el rol Administrador, no crea otro con
  esa marca, y no puede guardar un permiso inexistente;
- un usuario dado de baja y el de una organización suspendida no ven nada;
- el superadmin ve todas las organizaciones y **ningún dato comercial**;
- un visitante sin sesión no ve nada.

### `0007_reglas.sql`: las reglas de la entrega final

Comprueba, verificando **el código y el mensaje del error** (así se sabe que frena el mecanismo correcto:
trigger, RLS, FK o CHECK) y no solo que falle:

| Bloque | Qué comprueba |
|---|---|
| Alta de organización | 4 roles con los nombres nuevos, 6 etapas (1 ganada, 1 perdida), 12 tipos de actividad, 7 orígenes, 7 motivos |
| Cartera propia | El Vendedor ve exactamente sus empresas, contactos (los de su empresa y su cliente individual), oportunidades, ventas, ítems, alertas, actividades e historial; no puede tocar ni borrar lo ajeno |
| Asignación | El Vendedor no puede crear para otro ni reasignar (empresas, contactos, oportunidades); un responsable de otra organización se rechaza |
| Compatibilidad con la app vieja | Altas con `responsable_id` nulo explícito quedan para el creador; la bitácora con solo `tipo` completa el tipo de catálogo y fuerza el autor |
| Actividades | Cada referencia tiene que ser visible y coherente; sin empresa ni contacto se rechaza |
| Reglas del embudo | Perdida sin motivo falla; estado incompatible falla; perdida con motivo por `cambiar_etapa` deja estado, fecha y motivo, historial y observación; editar una cerrada queda auditado; borrar la fecha de cierre falla; reabrir sin permiso falla (por RPC y por `update`) |
| Responsable comercial | Ve todo; reabre; reasigna; ganada por `update` directo con fecha de hoy; cambiar el resultado toma la fecha del nuevo cierre; no borra oportunidades; no crea motivos |
| Solo lectura | Sigue viendo todos los clientes y no ve oportunidades |
| Administrador | Edita catálogos, etapas y datos de la empresa; no puede suspender ni renombrar su organización; no cambia el tipo de una etapa con oportunidades; ni él borra oportunidades |
| Logo (Storage) | No se sube sin `configuracion.gestionar`; el administrador de A no ve ni sube el logo de B, no mueve el suyo a la carpeta de B, no sube un SVG; la política de borrado está limitada a la propia organización y al permiso; el bucket es privado, de 1 MB y solo PNG, JPG y WebP |
| Baja lógica | Un contacto con actividades no se borra; ni `postgres` borra una oportunidad con historial |
| Aislamiento | El administrador de B no ve catálogos, historial, auditoría ni logo de A; no puede cambiar de etapa una oportunidad de A; un visitante sin sesión no ve nada |
| Sin usuario | `service_role` y scripts pueden reabrir y el historial queda sin autor, pero las reglas de estado siguen valiendo |
| Borrar una organización | Con cerradas, historial, auditoría y actividades, borrar la organización entera funciona y no deja huérfanos |

> **El caso del borrado de logos.** Supabase prohíbe todo `DELETE` directo sobre `storage.objects` con el
> trigger `storage.protect_delete`, aun sin filas afectadas. Por eso la prueba no borra: verifica en
> `pg_policies` que la política de borrado esté limitada a la organización propia y a
> `configuracion.gestionar` (commit `cb7c251`). Los archivos se borran por la API de Storage, que aplica las
> mismas políticas.

### `0007_reejecucion.sql`: la migración se puede volver a correr

Prueba lo que `0007_reglas.sql` no puede, porque necesita correr la migración dos veces:

- la migración de roles corre **una sola vez**: si un administrador le saca `clientes.ver_todos` a un rol,
  volver a correr la 0007 no se lo devuelve;
- una organización que ya tenía un rol propio llamado "Vendedor" no choca: su "Ventas" no se renombra pero
  recibe el trato de vendedor;
- "Corporativo" conserva lo que el administrador le había agregado;
- correrla dos veces no duplica catálogos, etapas, historial ni roles.

### Cómo ensayar la 0007 sin aplicarla

Dentro de una transacción: `begin;`, el contenido de `0007_entrega_final.sql` y el de `0007_reglas.sql`
(que termina en `ROLLBACK` y deshace las dos cosas). Ver [deploy](./deploy.md#ensayar-la-0007-sin-aplicarla).

### Cómo correr las pruebas SQL fuera de Supabase

Para ensayar una migración sin tocar la base viva sirve un Postgres local con el esquema mínimo de Supabase
(`auth.users`, `auth.uid()`, `storage.buckets` y los roles `anon`, `authenticated` y `service_role`): PGlite
(`@electric-sql/pglite`, Postgres en WebAssembly, con `pgcrypto` y `pg_trgm`) o el stack local de la CLI
(`supabase start` y `supabase db reset`). Se aplican `0001` a `0012` en orden y después cada prueba; todas tienen que
terminar en `TODO OK`. **La CI no corre estas pruebas** (mantenerla simple: no tiene una base con el esquema de
Supabase); las corre quien toca `supabase/migrations/`, antes de pegarlas en el SQL Editor.

---

## 5. Pruebas E2E con Playwright

Las pruebas de extremo a extremo viven en `e2e/` y se corren con `npm run test:e2e` (`@playwright/test`, solo Chromium,
`playwright.config.ts`). Son lo único que ejercita la interfaz real: el login, los drawers, el tablero y la hoja del
presupuesto.

| Archivo | Qué prueba |
|---|---|
| `e2e/acceso.spec.ts` | Sin sesión se va al login; una contraseña equivocada no entra; el Administrador entra y ve Configuración; el Vendedor entra y **no** ve la administración; el Vendedor ve **menos empresas** que el Administrador y no encuentra las del otro ni buscándolas |
| `e2e/demo.spec.ts` | La demo de la consigna, en serie y como Administrador: crear empresa, agregarle un contacto desde su ficha, crear una oportunidad y verla en el tablero, moverla con «Cambiar etapa» (dos veces, con observación), marcarla perdida desde el detalle (**sin motivo la interfaz lo frena; con motivo se cierra**) y ver el historial con las observaciones, antes y después de recargar |
| `e2e/navegacion.spec.ts` | Solo lectura: paginación por URL (`?pageSize=10`, «Página 2», link directo), búsqueda que deja `q=` en la URL, **Ctrl+K** abre la búsqueda global y navega a la ficha, y la **hoja del presupuesto** (encabezado del proveedor sin la marca de la plataforma, totales con IVA, y en `@media print` desaparecen el menú y los botones) |

### La organización de pruebas

**Nunca se apuntan a la demo.** Las pruebas crean y mueven registros reales y el CRM no borra nada (baja lógica), así
que corren contra una organización aparte, **"E2E Tuco & Nito"**, que crea `supabase/seeds/e2e_tests.sql` (se pega una
vez en el SQL Editor; es re-ejecutable; requiere `0001` a `0007`). **El repositorio es público y el archivo no trae ninguna contraseña**: antes de pegarlo, elegí tu clave (12 caracteres o más, que no uses en ningún otro lado) y escribila en el bloque `CONFIGURACION` del archivo; si queda el valor de ejemplo, si es corta o si un correo no termina en `@e2e.tuconito.com.ar`, el script se corta sin crear nada. Después guardá esa clave como secreto `E2E_PASSWORD` y `E2E_PASSWORD_VENDEDOR` (en GitHub y en tu entorno); nunca la escribas en un archivo del repositorio. Trae un Administrador y un Vendedor, 12 empresas
(`E2E Club 01` a `12`: 01 a 06 del Administrador, 07 a 12 del Vendedor), un contacto, dos productos y una oportunidad fija
para el presupuesto. Cada corrida crea cosas llamadas `E2E <hora>` (la oportunidad termina perdida y la empresa activa);
una segunda corrida convive con la primera.

### Variables de entorno

| Variable | Para qué | Valor con el seed |
|---|---|---|
| `E2E_BASE_URL` | Dónde corre la app. Por defecto `http://localhost:3000` | |
| `E2E_EMAIL`, `E2E_PASSWORD` | Administrador | `e2e.admin@e2e.tuconito.com.ar` y la clave que elegiste |
| `E2E_EMAIL_VENDEDOR`, `E2E_PASSWORD_VENDEDOR` | Vendedor | `e2e.vendedor@e2e.tuconito.com.ar` y la misma clave |
| `E2E_WEB_SERVER` | Opcional: comando que levanta la app (por ejemplo `npm run start`); Playwright lo arranca y lo apaga | |

Sin las credenciales **las pruebas se saltan** (no fallan) y se imprime un aviso con lo que falta.

```bash
# la app apuntando al proyecto de Supabase que tiene la organización E2E (variables en .env.local)
npm run build && npm run start

# en otra terminal (bash; en PowerShell: $env:E2E_EMAIL="..."; npm run test:e2e)
E2E_EMAIL=e2e.admin@e2e.tuconito.com.ar E2E_PASSWORD="$TU_CLAVE_E2E" \
E2E_EMAIL_VENDEDOR=e2e.vendedor@e2e.tuconito.com.ar E2E_PASSWORD_VENDEDOR="$TU_CLAVE_E2E" \
npm run test:e2e

npx playwright install chromium     # la primera vez, para bajar el navegador
npx playwright test --list          # ver las 14 pruebas sin correrlas
npx playwright show-report          # el reporte HTML de la última corrida
```

En local, la traza (`trace: on-first-retry`) y las capturas de las fallas quedan en `test-results/` y `playwright-report/`
(ignorados por git; **no los compartas**: guardan lo que las pruebas escriben en los campos, el login incluido). En CI trazas, capturas y videos están apagados. Los selectores usan roles y nombres accesibles (`getByRole`), igual que una persona con lector de
pantalla: si cambia un texto de la interfaz que una prueba nombra, la prueba lo dice.

> **Estado.** Las 14 pruebas compilan (`npx playwright test --list`, `npm run typecheck`) y los selectores de solo
> lectura (búsqueda, Ctrl+K, menú de la tarjeta, modales «Cambiar de etapa» y «Marcar como perdida» hasta su error de
> validación, hoja del presupuesto en `@media print`) se comprobaron a mano contra la demo **sin crear ni modificar
> nada**. **La suite no se ejecutó completa**: la organización E2E y su seed no estaban cargados, y a propósito no se corrió
> contra la demo. Las pruebas que **escriben** (`demo.spec.ts`) están sin ejecutar; hay que correrlas una vez contra la
> organización de pruebas y ajustar lo que falle.

---

## 6. Integración continua

`.github/workflows/ci.yml` (GitHub Actions) corre en cada push y pull request a `main` y a mano (*Run workflow*):

| Paso | Comando |
|---|---|
| Lint | `npm run lint` (`src`, `e2e`, `playwright.config.ts`, `scripts/guard` y `playwright.guard.config.ts`, sin advertencias) |
| Tipos | `npm run typecheck` |
| Self-checks | `npm test` |
| Build | `npx next build`, con `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder`: **no usa ningún secreto** |

Node 22 (`engines.node` pide `>=22.18`: `node --test` ejecuta `.ts` sin flags desde esa versión), `npm ci` con caché, caché de `.next/cache`, y un push nuevo a la misma rama cancela la corrida anterior. El job
**E2E** corre solo en `main` o a mano y solo si están los secretos del repositorio (lista en
[deploy](./deploy.md#integración-continua-github-actions)); sin ellos termina bien con un aviso. **El repositorio es público**, así que los artefactos los puede bajar cualquiera: en CI Playwright corre con trazas, capturas y videos apagados y sin reporte HTML, y el job solo sube `e2e-junit` (`junit.xml`) después de tachar con `***` el valor de todos los secretos; los detalles de una falla se ven en el log (GitHub enmascara ahí los secretos). Las pruebas SQL no corren en la CI (ver §4).

> El archivo se validó parseando el YAML, pero **no se pudo ejecutar GitHub Actions** desde acá: la primera corrida real
> puede mostrar algo que ajustar (sobre todo la versión de Node 22 con `node --test` sobre `.ts`).

---

## 7. Cómo leer un resultado

Todas las pruebas SQL terminan con una consulta final que solo se alcanza si nada falló. Va **después** del
`ROLLBACK` porque el SQL Editor muestra el resultado de la **última** sentencia.

| Lo que ves | Qué significa |
|---|---|
| Una fila con `resultado` = `TODO OK: ...` | Todo se cumplió y no quedó nada guardado (rollback) |
| Un error que empieza con `FALLA: ...` | Se pudo hacer algo que no se debería (o no se pudo algo que sí). El texto dice qué |
| `FALLA: ... (fallo, pero por otro motivo: [sqlstate] mensaje)` | La operación falló, pero por un mecanismo distinto del esperado: revisar qué la está frenando |
| Un error de Postgres sin `FALLA:` (por ejemplo, objeto inexistente) | La prueba no llegó a evaluar nada: probablemente falta una migración, o se corrió en el orden equivocado |

Si una prueba falla a mitad de camino y el editor deja la transacción abierta, ejecutá `rollback;` antes de
seguir, para no dejar datos de prueba.

---

## 8. Antes de hacer push

Los pasos de verificación estática y automática, en este orden (son los mismos que corre la CI):

```bash
npm run lint
npm run typecheck
npm test
npx next build
npm run guard:frozen     # no es de la CI, pero tiene que pasar (no necesita la app levantada)
```

Si el cambio toca `supabase/migrations/`, además: ensayar la migración en una transacción con rollback,
aplicarla, correr `0005_permisos.sql` y `0007_reglas.sql` (o la prueba nueva que corresponda), y regenerar
`src/lib/supabase/types.ts`. Si toca la interfaz, correr `npm run test:e2e` contra la organización de pruebas y, si toca `src/app/globals.css`, la landing, el acceso
o `crm.css`, también `npm run guard` completo (§10).
Más en [CONTRIBUTING](../CONTRIBUTING.md).

---

## 9. Lo que todavía no se prueba

- **La suite E2E no corrió completa** (ver §5): falta cargar la organización de pruebas y ejecutarla una vez.
- **El guardado de presupuestos no se probó contra una base real.** La migración `0012` no está aplicada en la base viva:
  se probó en PGlite (`0012_presupuestos.sql`) y el camino del cliente (guardar, imprimir, registrar la actividad una sola
  vez, reabrir, «usar como base») se ejercitó en el navegador **simulando las respuestas de la base**; falta correrlo
  contra la `0012` real.
- **El logo del proveedor en la hoja** se comprobó con un logo simulado en la página: la demo no tiene un logo cargado.
- **El PDF se probó en Chromium** (`page.pdf()`); otros navegadores pueden paginar distinto.
- **La migración `0010` (índices) no tiene prueba SQL propia**: solo agrega índices. Se la ensayó en un Postgres
  local (PGlite) con y sin el bloque opcional de `pg_trgm` y re-ejecutándola; no está aplicada en la base viva.
- **La IA (F7) no se probó contra la API real** (no había clave): el navegador se ejercitó contra un servidor simulado que devuelve texto
  fijo y los errores 429, 401, 529, `refusal` y `max_tokens`. Falta leer borradores reales (calidad y tono), medir el costo y probar el
  envío completo del aviso desde el panel de IA, que escribe en `alertas_enviadas`. Sin clave, los botones no existen (verificado).
- **Los componentes React no tienen pruebas unitarias**: los self-checks cubren lógica pura (dinero, permisos, mails,
  mensajes, íconos, las cuentas del presupuesto) y lo demás lo cubren las E2E.
- **La CI no corre las pruebas SQL** ni las guardas de CRM 2.0 (`npm run guard`), y no se ejecutó todavía en GitHub.
- **Las pantallas migradas del CRM no tienen prueba visual automática**: el pixel diff cubre solo `/`, `/login` y `/recuperar`. Las del CRM se
  comparan a mano con las fotos de `guard:baseline-crm` (§10) y las cubren las E2E por sus nombres accesibles.

---

## 10. Guardas de aislamiento de CRM 2.0

El rediseño del CRM no puede cambiar la landing (`/`) ni `/login`, `/recuperar` y `/definir-clave`. Dos guardas lo hacen cumplir; el contrato completo
(qué está congelado y por qué, lo no determinista y cómo se neutraliza, y los límites) está en
[`design-system/crm-2/README.md`](../design-system/crm-2/README.md). **No corren en la CI** (necesitan una app construida y el `.env` de la landing).

```bash
npm run guard            # guard:frozen + guard:landing
npm run guard:frozen     # hashes + git diff contra la base + árbol de trabajo + reglas de crm.css (rápida; no necesita app)
npm run guard:landing    # pixel diff de /, /login y /recuperar contra la baseline commiteada
npm run guard:baseline-crm   # fotos del CRM actual (fuera del repo), para comparar antes y después
```

**`guard:frozen`** (`scripts/guard/frozen-files.mjs`, con `design-system/crm-2/guard/frozen-files.json`). Falla, y dice por qué, si: cambia el hash de un archivo
congelado (la clausura de imports de la landing, el layout raíz, el acceso, el proxy y `/auth/*`); aparece o desaparece un archivo de una carpeta congelada
(`src/components/landing/`); `git diff <base>...HEAD` o el árbol de trabajo tocan una ruta congelada; o `crm.css` rompe la regla de aislamiento (solo selectores bajo
`[data-crm]`, ningún at-rule global). La base es `GUARD_BASE`, o la `base` del manifiesto, o `main`; si no se puede resolver, falla (`GUARD_ALLOW_NO_BASE=1` omite
solo el diff de git).

**`guard:landing`** (`playwright.guard.config.ts` + `scripts/guard/landing.spec.ts`). Fotografía `/` a 1440, 768 y 390, y `/login` y `/recuperar` a 1440 y 390 (7 imágenes), con
**tolerancia cero** (`maxDiffPixels: 0`, `threshold: 0`) y `prefers-reduced-motion: reduce`, y las compara con `design-system/crm-2/guard/landing/`. Las partículas del canvas se
ocultan (`scripts/guard/landing.css`) y el año del pie se enmascara. Por defecto hace `npm run build` y `npm run start -p 3199`; variables: `GUARD_BASE_URL` (usar una app ya
levantada), `GUARD_SKIP_BUILD=1` (solo `next start`; falla si `.next` es más viejo que `src/`, salvo `GUARD_ALLOW_STALE=1`), `GUARD_PORT` y `GUARD_REUSE_SERVER=1`. Necesita
`NEXT_PUBLIC_SUPABASE_URL` y la clave pública en el `.env` (la guarda corre sin sesión y fotografía «Ingresar»).

**`guard:baseline-crm`** (`scripts/guard/baseline-crm.mjs`). Solo navega: fotografía el CRM (25 pantallas del Administrador en claro y oscuro a 1440 y 390, más las del Vendedor) a
`GUARD_BASELINE_OUT` (por defecto `../baseline-crm-actual/`, fuera del repo). Pide `GUARD_BASE_URL` y las credenciales de la demo (`MANUAL_EMAIL`, `MANUAL_PASSWORD`, y opcionalmente las
del Vendedor) **del entorno**, que no se escriben nunca en el repo. Para comparar dos generaciones se corre dos veces con carpetas distintas y
`node scripts/guard/compare-png.mjs <carpetaA> <carpetaB> [--solo=…]` (cuenta los píxeles distintos por par; sale con 1 si hay alguno). Lo atado al día de la demo ("Hace 72 d") cambia con
los días.

### Cómo refrescar las baselines (solo con un cambio aprobado de un archivo congelado)

1. Tener la aprobación explícita (qué archivo y por qué) y hacer el cambio.
2. **Commitearlo** (commit `C`).
3. Si cambia lo visual: `npx playwright test -c playwright.guard.config.ts --update-snapshots` regenera las imágenes afectadas; mirarlas a ojo.
4. `GUARD_BASE=C node scripts/guard/frozen-files.mjs --update`: regenera los hashes y fija `C` como `base` del manifiesto (sin `GUARD_BASE` conserva la que ya tenía).
5. Commitear el manifiesto y las baselines **en el mismo PR**, y que quien revisa mire el diff del manifiesto y de los PNG: las guardas no se protegen a sí mismas.

Las baselines son de Chromium en Windows; en una CI Linux hay que regenerarlas en ese entorno o correr solo `guard:frozen`.
