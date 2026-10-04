# CLAUDE.md

Contexto del proyecto para trabajar de forma consistente entre sesiones/personas.

## Qué es esto

CRM simple dirigido a **proveedores y distribuidores de equipamiento deportivo** que venden a
canchas de fútbol, clubes, complejos deportivos y escuelas de fútbol. Productos típicos: arcos,
redes, conos, pecheras, pelotas y demás materiales para el funcionamiento y mantenimiento de una
cancha.

La **primera entrega** (2026-09-17) fue una versión funcional mínima para registrar clientes y
gestionar oportunidades comerciales. La **segunda entrega** (2026-09-18 a 09-24) sumó la landing
pública, catálogo con vida útil, historial de ventas, alertas de recambio, bitácora, multitenancy,
roles con permisos y cuentas. Se trabaja hacia la **entrega final (2026-11-12)**: la migración
`0007_entrega_final.sql` ya está aplicada (la base cumple casi todo el módulo comercial de la
consigna) y la interfaz de esas capacidades se construye en las fases F1 a F8. El estado real,
requisito por requisito, está en [`docs/notas-de-version.md`](./docs/notas-de-version.md); el resto
de la documentación se indexa en [`docs/README.md`](./docs/README.md).

**Tres estados, siempre distintos:** *implementado* (anda en producción), *base lista, sin
interfaz* (la base ya lo aplica, la pantalla no) y *planificado*. No documentes como existente lo
que está en el segundo o tercer estado.

## Alcance actual

Incluido:

- **Acceso**: login con Supabase Auth, sin registro público. Los usuarios se invitan (superadmin y
  administradores), activan su cuenta definiendo una contraseña y pueden recuperarla (ver "Cuentas"
  más abajo).
- **Empresas y contactos**: alta y edición de empresas en `/empresas`; cada empresa es
  desplegable y muestra sus contactos anidados, con alta/edición de contacto ahí mismo (relación
  contacto → empresa, opcional).
- **Landing pública** en `/` (sin sesión): presentación, funcionalidades, cómo funciona,
  nosotros, FAQ y contacto. Los datos de contacto salen de variables de entorno
  (`src/lib/contacto.ts`). Si hay sesión, el botón cambia de "Ingresar" a "Ir al CRM".
- **Productos**: ABM en `/productos` con **duración estimada de vida útil** (en meses). Ese dato
  es el que alimenta las alertas. Un producto no se borra, se da de baja (`activo = false`): la FK
  desde `venta_items` es `on delete restrict` para no romper el historial.
- **Ventas**: historial de compras en `/ventas`, con cabecera + ítems. Cada ítem guarda su propia
  fecha de entrega y una **copia** de la vida útil del catálogo al momento de vender.
- **Alertas de recambio** en `/alertas`: equipos entregados que vencieron o vencen en los próximos
  60 días, con mensaje prearmado para enviar por mail o WhatsApp. Se registra cada envío.
- **Bitácora de clientes**: desde el menú "⋮" de cada empresa en `/empresas`. Llamadas, reuniones,
  consultas, quejas y observaciones, con fecha, autor y contacto opcional.
- **Oportunidades**: alta y edición, relacionadas a una empresa y/o contacto, con responsable
  asignado (usuario del sistema) y producto/servicio seleccionado. Listado; el detalle es el panel
  de edición (no hay página de detalle todavía, F2).
- **Embudo comercial**: vista Kanban integrada arriba de `/oportunidades` con las oportunidades
  agrupadas por etapa (sin scroll horizontal, se achica a grilla 3×2 en mobile; columnas fijas en 6
  con `lg:grid-cols-6`). Cambiar de etapa se hace **arrastrando la tarjeta** (HTML5 nativo, no
  funciona con touch: en mobile se cambia desde el formulario de edición) y el cambio se persiste en
  la base al instante con un `update` de `etapa_id` (todavía no usa la RPC `cambiar_etapa`).
- **Etapas**: las crea el trigger al dar de alta una organización (embudo del rubro: Consulta
  recibida, Relevamiento de cancha, Presupuesto enviado, Negociación, Entregado, Perdida). La base
  permite configurarlas (`configuracion.gestionar`), pero no hay pantalla todavía (F1).
- **Modo oscuro**: toggle manual (ícono sol/luna en la barra superior), respeta `prefers-color-scheme`
  la primera vez y después queda guardado en `localStorage`.

- **Multitenant**: cada cliente es una `organizacion`; RLS aísla sus datos. Un **superadmin**
  (nivel plataforma, sin organización) tiene su propia interfaz en `/admin` (`src/app/admin`,
  fuera del CRM): da de alta clientes, cada uno con su usuario Administrador, y los suspende. El
  layout del CRM lo redirige ahí; NO ve datos comerciales de ningún cliente.
- **Roles con permisos** por cliente (`roles.permisos`), administrados en `/usuarios`. El catálogo
  de permisos está en `src/lib/permisos.ts` y la base exige cada uno en las políticas RLS; la UI
  solo esconde lo que el rol no puede usar.
- **Cuentas**: invitación por mail, activación (definir contraseña), recuperación de contraseña y
  reenvío automático de la activación si alguien intenta ingresar con una cuenta sin activar.
  Todos los mails salen por nuestro SMTP (`src/lib/email/`), ninguno por Supabase.

**Entrega final: en la base sí, en la interfaz todavía no** (migración `0007`, aplicada el
2026-10-04). Son reglas que viven en la base y se cumplen por cualquier camino; ninguna pantalla las
usa aún, salvo donde se aclara:

- Estados (potencial, cliente, inactivo, no contactar), responsable y origen en empresas y contactos
  (baja lógica = `inactivo`). Alta de la cartera: un alta sin responsable queda para quien la crea.
- Oportunidades con estado (abierta, ganada, perdida), fecha de cierre, motivo de pérdida, origen,
  probabilidad y tipo. **Reglas del embudo en el trigger `oportunidades_reglas`**: el estado sale del
  tipo de la etapa, ganada pone fecha de cierre, perdida exige motivo, reabrir exige
  `oportunidades.reabrir`. Hoy arrastrar una tarjeta a "Perdida" falla (el arrastre no pide motivo).
- Historial de cambios de etapa (`oportunidad_etapas_historial`) y auditoría de las cerradas
  (`oportunidad_auditoria`): se escriben solos, no hay pantalla para leerlos.
- Catálogos configurables por organización (`origenes`, `motivos_perdida`, `tipos_actividad`) y datos
  fiscales del proveedor más el bucket privado `logos` (PNG/JPG/WebP, 1 MB, sin SVG).
- **Cartera propia**: sin `clientes.ver_todos` solo se ve lo asignado. Esto **sí rige en pantalla**
  (la base devuelve menos filas). Las oportunidades ya **no se borran** (sin política de borrar).
- Actividades (`bitacora_entradas`) con tipo de catálogo, oportunidad y resultado; la pantalla
  todavía usa el campo `tipo` viejo (un trigger lo traduce).

**Planificado** (F1 a F8, 2026-10-13 a 2026-11-11): `/configuracion`, detalles de empresa, contacto y
oportunidad, cierre desde la UI, búsqueda/filtros/paginación en el servidor, funciones del rubro
(canchas, parque instalado, licitaciones), presupuesto imprimible, E2E y CI, IA opcional y manual.

**Fuera de alcance según la consigna** (no agregar sin que el usuario lo pida): tareas, agenda,
recordatorios, exportación, integraciones, API pública, importación, facturación, pagos,
contabilidad, stock y campañas. El proyecto igual tiene multitenancy, envío de mails, links de
WhatsApp y un tablero con indicadores, que la consigna lista como fuera de alcance: se conservan.
Además: no hay envío automático de alertas (lo confirma una persona), la bitácora no se edita ni se
borra, y no hay IA todavía.

### Demo esperada

1. Iniciar sesión.
2. Registrar una empresa (en `/empresas`) y, desplegándola, un contacto.
3. Crear una oportunidad (en `/oportunidades`).
4. Visualizarla en el embudo (arriba de la misma página).
5. Cambiarla de etapa (arrastrando la tarjeta).
6. Refrescar y comprobar que la información permanece guardada.

## Stack técnico

Elegido priorizando: gratis para hostear, poco código de infraestructura, y fácil de repartir
entre el equipo.

- **Next.js 16** (App Router, TypeScript, React Server Components + Server Actions) en `src/app`.
- **Tailwind CSS v4** para estilos (sin librería de componentes, clases utilitarias directas).
- **Supabase** como backend: Postgres (base de datos), Auth (login) y Row Level Security.
- **Deploy**: Vercel (plan gratuito) para el frontend, Supabase (plan gratuito) para la base y el
  auth. Sin servidores propios que mantener.

### Por qué mutaciones client-side y no Server Actions para el CRUD

Las Server Actions se reservan para lo que no puede ir desde el navegador: escribir cookies de
sesión (`src/app/login/actions.ts`), usar la clave de servicio (`usuarios/actions.ts`,
`admin/actions.ts`, `recuperar/`, `definir-clave/`) y enviar mails (`alertas/actions.ts`).
Pero el CRUD de empresas/contactos/oportunidades/productos/ventas (crear, editar, cambiar
etapa) se hace desde Client Components con el cliente de Supabase del navegador
(`src/lib/supabase/client.ts`), no con Server Actions. Motivo: la UI usa paneles laterales
(`Drawer`) para editar sin navegar a otra página, y `router.refresh()` después de una Server Action
no siempre volvía a pintar la lista con los datos nuevos en este proyecto (a veces quedaba
mostrando el estado viejo hasta un reload manual). La solución fue mover la escritura al cliente,
pedir la fila guardada de vuelta con `.select().single()`, y mezclarla a mano en el estado local de
React — así la UI se actualiza al instante sin depender del refresh del router. RLS sigue
protegiendo el acceso igual que si fuera server-side.

## Estructura del proyecto

```
src/
  app/
    globals.css               Tokens del UI Kit (:root + .dark), @theme de Tailwind v4, keyframes
    layout.tsx                Fuentes (Jakarta, JetBrains Mono, Varela Round), anti-flash, Toast + Tooltip
    icon.svg                  Favicon (isotipo con el verde de marca horneado)
    login/                    Login (fuera del grupo protegido), Server Action en actions.ts
      page.tsx                 Split-screen: panel de marca (cancha en SVG) + panel de form
      LoginForm.tsx            Client: show/hide de contraseña, banner de error, useFormStatus
    recuperar/                "Olvidé mi contraseña" (pública; responde siempre igual)
    definir-clave/            Elegir contraseña tras activar o recuperar (Server Action)
    auth/signout/route.ts     Logout (POST, borra la sesión)
    auth/confirm/route.ts     Canjea el token de los mails con verifyOtp (solo rutas internas en `next`)
    admin/                    Panel del superadmin (alta/suspensión de clientes), fuera del CRM
    (app)/                    Grupo de rutas protegidas (layout valida sesión)
      layout.tsx               AppShell + guards: superadmin va a /admin; baja o suspensión = "Sin acceso"
      usuarios/                Usuarios y roles del cliente (permiso usuarios.gestionar); actions.ts
      sin-permisos/            Destino cuando el rol no tiene ninguna sección
      */loading.tsx            Loader de marca por módulo
      dashboard/                KPIs + distribución del embudo + rankings
        page.tsx                 Server Component: cuenta y agrega oportunidades por etapa/empresa
        charts.tsx               MagnitudeBars / ShareBar en CSS puro (sin librería de charts)
      empresas/                 Empresas desplegables con sus contactos anidados
        page.tsx                 Server Component: fetch de empresas + contactos
        EmpresasList.tsx          Client: header+toolbar, búsqueda, acordeón, abre los drawers
        EmpresaForm.tsx           Form de alta/edición de empresa (usado dentro del Drawer)
        ContactoForm.tsx          Form de alta/edición de contacto (idem)
        BitacoraPanel.tsx         Bitácora de la empresa (lista + alta), dentro del Drawer
      productos/                 ABM del catálogo con vida útil
        page.tsx / ProductosList.tsx / ProductoForm.tsx
      ventas/                    Historial de compras (cabecera + ítems)
        page.tsx / VentasList.tsx / VentaForm.tsx
      alertas/                   Recambios vencidos o por vencer
        page.tsx                 Lee la vista alertas_vida_util
        AlertasView.tsx          Client: KPIs, filtros, envío por mail/WhatsApp
        actions.ts               Server Actions: envío por SMTP/Gmail (o mailto) + registro
        plantillas.ts            Mensajes prearmados — funciones puras
        plantillas.check.ts      Self-check: node --test "src/app/(app)/alertas/plantillas.check.ts"
      oportunidades/             Embudo (kanban con drag & drop) + listado en una sola página
        page.tsx                 Server Component: fetch de oportunidades + catálogos
        OportunidadesView.tsx     Client: embudo, tabla + cards mobile, filtro por etapa, EtapaBadge
        OportunidadForm.tsx       Form de alta/edición (usado dentro del Drawer)
  components/
    ui/                        Primitivos del Sumar UI Kit — reusar, no reinventar
      UIComponents.tsx          cn, useModalAnimation, useAnchoredPortal, Card, Button, Input,
                                Textarea, FieldLabel, Badge, Table, Avatar, initials, SectionTitle
      Select.tsx                Reemplazo portaled del <select> nativo (flip, buscador, a11y)
      MoneyInput.tsx            Input de dinero con máscara es-AR
      KpiCard.tsx               Tile de métrica canónico del dashboard
      Loader.tsx                Spinner de marca (loading de página/lista)
      Toast.tsx                 ToastProvider + useToast()
      Tooltip.tsx               TooltipHost: convierte todo title= del DOM en un pill propio
      EmptyState.tsx            Empty state canónico (dashed + ícono en círculo)
      backdropClose.ts          Cierre de overlay a prueba de arrastre
    landing/                    Solo para la landing pública (ver design-overrides.md §12)
      ParticleField.tsx         Canvas de partículas: isotipo, halo y cielo; reacciona al mouse
      BallCursor.tsx            Cursor pelota de fútbol + spotlight de las cards
      ProductShowcase.tsx       Ventanas simuladas del CRM (datos de ejemplo)
    AppShell.tsx                Sidebar colapsable desktop + header/drawer mobile + logout (NAV por permiso)
    AuthCard.tsx                Tarjeta de las pantallas de acceso (login, recuperar, sin acceso)
    Logo.tsx                    GoalMark: isotipo en currentColor (sidebar, login, loader)
    Cancha.tsx                  MarcasCancha: la cancha en SVG sobre la superficie .cesped
    Equipamiento.tsx            Íconos del rubro (arco, red, pelota…) + IconoEquipo
    ConfirmModal.tsx            Alert dialog centrado (lo usa el logout)
    Drawer.tsx                   Panel lateral derecho para los formularios de alta/edición
    RowActions.tsx               Menú "⋮" portaled que usan las filas de cada lista
    ThemeToggle.tsx              Toggle de modo oscuro (localStorage + prefers-color-scheme)
    form.tsx                    <Campo>, <CampoTextarea>, <CampoSelect>, <CampoMoney>,
                                <CampoGrupo>, <FormBanner>, <FormActions>
  lib/
    utils.ts                   cn() — merge de clases Tailwind
    brand.ts                   APP_NAME — única fuente del nombre de la app
    contacto.ts                Datos de contacto y remitente SMTP, leídos de variables de entorno
    sesion.ts                  getSesion(), exigirPermiso() y origenPublico() (SITE_URL para los links de mails)
    permisos.ts                Catálogo de 19 permisos, ROLES_POR_DEFECTO, rutaInicial()
    permisos.check.ts          Self-check: el catálogo coincide con el CHECK de la 0007
    cuentas.ts                 Alta, activación, recuperación y límite de mails (solo servidor)
    email/                     enviar.ts (único punto de salida SMTP), layout.ts (HTML de mails), plantillas.ts
    money.ts                   Máscara/parseo es-AR + formatters de display
    money.check.ts             Self-check: node --test src/lib/money.check.ts
    equipo.ts                  tipoEquipo(): qué equipo es un producto, para su ícono
    equipo.check.ts            Self-check: node --test src/lib/equipo.check.ts
    supabase/
      client.ts                Cliente Supabase para Client Components (drawers, mutaciones)
      server.ts                Cliente Supabase para Server Components/Actions (usa cookies())
      admin.ts                  Cliente con service_role (`server-only`); solo tras verificar permisos
      middleware.ts             Lógica de refresco de sesión + redirects, usada por proxy.ts
      types.ts                  Tipos Database generados. OJO: anteriores a la 0007 (13 tablas); regenerar
  proxy.ts                      Proxy raíz de Next.js (exige login; públicas: /, /login, /recuperar, /auth/confirm)
docs/
  DESIGN.md                     Sumar UI Kit canónico (vendoreado, READ-ONLY, no editar)
  design-overrides.md           Dónde esta app se desvía del kit a propósito, y por qué
  README.md                     Índice de la documentación
  notas-de-version.md           Todo lo agregado desde la primera entrega + estado frente a la consigna
  arquitectura.md, modelo-de-datos.md, reglas-de-negocio.md, seguridad.md, deploy.md, pruebas.md
  decisiones/                   ADR: por qué se decidió cada cosa de peso
CHANGELOG.md, CONTRIBUTING.md, SECURITY.md     En la raíz
supabase/
  migrations/
    0001_init_schema.sql        Tablas, índices, triggers, RLS
    0002_seed_data.sql          Etapas y productos precargados
    0003_productos_ventas_alertas_bitacora.sql
                                Vida útil, ventas, bitácora, alertas enviadas y vista de alertas
    0004_multitenant.sql        Organizaciones, organizacion_id en todo, FKs compuestas, RLS por org
    0005_roles_permisos.sql     Roles con permisos por organización y RLS por permiso
    0006_superadmin_sin_organizacion.sql  El superadmin sale de la org demo (solo plataforma)
    0007_entrega_final.sql      Catálogos, estados, reglas del embudo, historial, cartera propia, logo
  tests/                        SQL con rollback; devuelven "TODO OK" o fallan con "FALLA:"
    0005_permisos.sql           Aislamiento y permisos (correr DESPUÉS de la 0007)
    0007_reglas.sql             Reglas de la 0007 (correr después de aplicarla)
    0007_reejecucion.sql        Re-ejecución de la 0007 (SOLO en una base sin la 0007)
  seeds/demo_catedra.sql        Organización "Cátedra UNLaM (demo)" con una cuenta por rol y datos
```

No hay rutas separadas para "nueva empresa" o "detalle de oportunidad": todo alta/edición pasa
por el `Drawer` desde la lista correspondiente. Tampoco hay una página de Contactos aparte — viven
anidados dentro de cada empresa en `/empresas` (un contacto sin empresa existe en la base pero hoy
no se lista; `/contactos` y los detalles son F1). Rutas planificadas: `/configuracion`,
`/contactos`, `/empresas/[id]`, `/oportunidades/[id]`.

### Modelo de datos (Postgres, esquema `public`)

Resumen. El detalle completo (diagrama ER, columnas, FKs, RLS por tabla) está en
[`docs/modelo-de-datos.md`](./docs/modelo-de-datos.md). 18 tablas más la vista `alertas_vida_util`.

- **Plataforma**: `organizaciones` (un cliente = una fila; desde la 0007 también datos fiscales y
  `logo_path`), `perfiles` (espejo de `auth.users`: organización, rol, `activo`, `activado_at`,
  `es_superadmin`; solo el servidor lo escribe), `roles` (por organización; `permisos text[]` con
  CHECK de 19 claves), `envios_auth` (límite de mails de cuenta).
- **Clientes**: `empresas` y `contactos` (contacto → empresa opcional). Con `estado`
  (potencial/cliente/inactivo/no_contactar), `responsable_id`, `origen_id`; empresas con
  `tipo_cliente` y `sitio_web`, contactos con `documento`.
- **Comercial**: `productos` (`vida_util_meses`, null = sin seguimiento; se dan de baja con
  `activo`), `etapas` (con `tipo` abierta/ganada/perdida), `oportunidades` (con `estado`,
  `fecha_cierre`, `motivo_perdida_id`, `origen_id`, `probabilidad`, `tipo` directa/licitacion;
  **no se borran**).
- **Ventas y recambio**: `ventas` (hecho consumado, distinto de la oportunidad) y `venta_items`
  (`fecha_entrega` propia y `vida_util_meses` **copiada** del producto por trigger: snapshot).
  `alertas_enviadas` guarda solo lo enviado; las pendientes las calcula la vista
  `alertas_vida_util` (`security_invoker`, ventana de 60 días, sin cron).
- **Actividad e historial**: `bitacora_entradas` (las "actividades": log inmutable, con
  `tipo_actividad_id`, `oportunidad_id`, `resultado`; empresa o contacto), `oportunidad_etapas_historial`
  y `oportunidad_auditoria` (las escriben triggers).
- **Catálogos**: `origenes`, `motivos_perdida`, `tipos_actividad` (por organización, con `activo`).

**Seguridad (importante):** todas las tablas tienen RLS. Cada política pide la organización propia
(`organizacion_id = org_actual()`) **y** el permiso (`tiene_permiso(...)`); las FKs entre tablas de
datos son compuestas `(organizacion_id, id)`. Desde la 0007, empresas, contactos y oportunidades
además se limitan a la cartera propia salvo `clientes.ver_todos`. Un Vendedor ve solo lo asignado;
Responsable comercial y Solo lectura ven todos los clientes; el Administrador tiene los 19 permisos.
El superadmin no tiene organización ni ve datos comerciales. Las reglas de negocio (embudo, cierre,
asignación, vida útil) viven en triggers, no en la UI.

## Supabase

Ya hay un proyecto de Supabase conectado y provisionado (organización `dgmoqhihtjjbetuedaad`,
proyecto `pdseuwdifzywpdgawbrl`, región `us-west-2`). Se armó vía el MCP de Supabase:

- Las migraciones `0001` a `0007` están aplicadas (la `0007` el 2026-10-04, con sus pruebas SQL).
  Se aplican a mano en el SQL Editor, en orden; **aplicar y desplegar enseguida**, ver
  [`docs/deploy.md`](./docs/deploy.md).
- El seed `supabase/seeds/demo_catedra.sql` crea la organización de demostración con una cuenta por
  rol (credenciales en el README).
- `.env.local` tiene las variables de Supabase (archivo gitignoreado, no se commitea). La lista
  completa de variables está en `docs/deploy.md`.
- `src/lib/supabase/types.ts` está generado contra este proyecto real pero **es anterior a la
  0007**: regenerarlo antes de construir pantallas que usen las tablas y columnas nuevas.

Si en algún momento hace falta reconectar a otro proyecto o recrearlo desde cero, el
[README](./README.md) y [`docs/deploy.md`](./docs/deploy.md) tienen los pasos.

## Vercel

**Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app)** — proyecto `crmgads1` (sin
guion; los intentos previos con `crm-gads1` fueron un nombre distinto que quedó descartado),
team `tomasballesteros12-8080`, conectado al repo de GitHub `TBalles/CRM_GADS1`: cada push a
`main` dispara un build y deploy de producción automático. Las env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) están cargadas en Project
Settings → Environment Variables; también `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` y `SMTP_*` (tabla
completa en `docs/deploy.md`). Verificado andando en producción (login + datos de Supabase + UI
rediseñada) el 2026-09-17.

Nota para el futuro: el MCP de Vercel de esta sesión nunca pudo leer el proyecto vía API
(`list_projects` devolvía `[]` con el proyecto andando perfecto desde el dashboard) — si hace
falta automatizar algo de Vercel de nuevo, probar primero si ese problema se repite antes de
asumir que el proyecto no existe.

## Diseño / UI

Esta app usa el **Sumar UI Kit**, documentado en [`docs/DESIGN.md`](./docs/DESIGN.md). Antes de
crear o modificar cualquier UI (componentes, modales, vistas, tablas, dashboards):

- Leé `docs/DESIGN.md` y **reutilizá** los primitivos de `src/components/ui/` — no inventes
  variantes nuevas de Button/Card/Drawer ni reimplementes dropdowns/selects.
- Leé también [`docs/design-overrides.md`](./docs/design-overrides.md): **`DESIGN.md` manda
  salvo lo listado ahí**. Si te desviás del kit por una razón nueva, agregá un bloque a ese
  archivo (kit → esta app → dónde → por qué); nunca edites `DESIGN.md`.
- Respetá los tokens: el color de marca vive en `--brand` (`src/app/globals.css`) y en esta
  app **`primary` y `ring` lo aliasean**, así que el verde es el color principal de la
  interfaz — botones, nav activo, links y focus rings salen de ahí. Ojo que esto se desvía
  del kit, que manda un `primary` negro fijo: ver el override #2.
  **No hardcodees colores de marca fuera de esos tokens** — la única excepción documentada es
  `src/app/icon.svg`, que es estático y no puede leer CSS.
- Si cambiás un token de color, **verificá contraste** antes de shipear. Los actuales dan
  6.34:1 (claro) y 7.25:1 (oscuro) para texto sobre `primary`; el piso es 4.5:1 (WCAG AA).
- Seguí las recetas de composición de `DESIGN.md` (página estándar §4.4, drawer §4.3,
  sidebar §4.5, dashboard §4.6) y las "Reglas de oro" (§15).
- Notá en particular: **montos siempre por `MoneyInput` + `parseMoney`, nunca `type="number"`**
  (regla #4); tablas responsive en dos bloques (`md:hidden` cards + `hidden md:block` tabla,
  regla #9); tooltips poniendo `title="…"` (el `TooltipHost` global se encarga, regla #10).

Como el stack es Tailwind v4 (no v3 como el kit), los tokens se declaran con `@theme inline` en
`globals.css` en vez de `tailwind.config.js` — el detalle está en el override #2.

## Convenciones de código

- Nombres de tablas, columnas, rutas y textos de UI **en español**, consistente con el dominio
  del negocio (empresas, contactos, oportunidades, embudo, etapas).
- Identificadores de código (variables, funciones, tipos TS) en inglés/español mixto está bien,
  pero seguí el patrón ya usado en cada archivo en vez de mezclar convenciones nuevas.
- Las Server Actions son solo para lo privilegiado (login/cookies, clave de servicio, mails). Cada una
  verifica sesión y permiso con `getSesion()` y valida tipo y forma de sus argumentos. El CRUD
  (empresas, contactos, oportunidades, productos, ventas) muta la base directo desde Client
  Components — ver "Por qué mutaciones client-side" más arriba antes de agregar un Server Action
  nuevo para alguna de esas pantallas.
- Las reglas de negocio van en la base (triggers, CHECK, RLS), no en la UI. Un permiso nuevo se
  agrega en `src/lib/permisos.ts` **y** en la migración (CHECK + roles por defecto):
  `permisos.check.ts` lee `0007_entrega_final.sql` y falla si divergen.
- Migraciones: aditivas si se puede, idempotentes, probadas dentro de `begin ... rollback`, con su
  prueba en `supabase/tests/`. Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Commits: Conventional Commits y **sin líneas de atribución de IA** (nada de `Co-Authored-By`).
- Los formularios usan los componentes de `src/components/form.tsx` en vez de reinventar inputs
  estilizados en cada página.
- Los tipos de la base (`src/lib/supabase/types.ts`) están generados contra el proyecto real de
  Supabase (`generate_typescript_types` del MCP de Supabase, equivalente a
  `supabase gen types typescript`). Si se agrega o modifica una tabla/columna en las migraciones
  SQL, hay que volver a generar este archivo en el mismo cambio — si no, los embeds
  (`etapa:etapas(...)`, `empresa:empresas(...)`, etc.) pueden perder el tipado correcto.

## Comandos

```bash
npm run dev      # servidor de desarrollo (http://localhost:3000)
npm run build    # build de producción
npm run lint     # eslint

npx tsc --noEmit                     # tipos
npx eslint src --max-warnings=0      # lint sin advertencias

# Self-checks (sin framework, runner de Node): money, equipo, permisos, email/layout, alertas/plantillas
node --test "src/**/*.check.ts"      # 5 archivos, 37 pruebas
node --test src/lib/money.check.ts   # o uno solo
```

Antes de pushear pasan `tsc`, `eslint`, los self-checks y `next build`. Las pruebas SQL de
`supabase/tests/` se pegan en el SQL Editor (hacen rollback); `0005_permisos.sql` y `0007_reglas.sql`
se corren después de la 0007, y `0007_reejecucion.sql` solo en una base que no la tiene. Detalle en
[`docs/pruebas.md`](./docs/pruebas.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
