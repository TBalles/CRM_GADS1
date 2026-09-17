# CLAUDE.md

Contexto del proyecto para trabajar de forma consistente entre sesiones/personas.

## Qué es esto

CRM simple dirigido a **proveedores y distribuidores de equipamiento deportivo** que venden a
canchas de fútbol, clubes, complejos deportivos y escuelas de fútbol. Productos típicos: arcos,
redes, conos, pecheras, pelotas y demás materiales para el funcionamiento y mantenimiento de una
cancha.

Esta es la **primera entrega**: una versión funcional mínima para registrar clientes y gestionar
oportunidades comerciales de forma básica. No es el producto final.

## Alcance de esta entrega

Incluido:

- **Acceso**: login funcional con Supabase Auth. Alcanza con un único usuario habilitado (no se
  pide gestión de roles/permisos).
- **Empresas y contactos**: alta y edición de empresas en `/empresas`; cada empresa es
  desplegable y muestra sus contactos anidados, con alta/edición de contacto ahí mismo (relación
  contacto → empresa, opcional).
- **Productos/servicios**: precargados por seed SQL (`supabase/migrations/0002_seed_data.sql`).
  No hace falta un ABM propio todavía.
- **Oportunidades**: alta y edición, relacionadas a una empresa y/o contacto, con responsable
  asignado (usuario del sistema) y producto/servicio seleccionado. Listado y detalle.
- **Embudo comercial**: vista Kanban integrada arriba de `/oportunidades` con las oportunidades
  agrupadas por etapa (sin scroll horizontal, se achica a grilla 3×2 en mobile). Cambiar de etapa
  se hace con un `<select>` en cada tarjeta (no hay drag & drop) y el cambio se persiste en la
  base al instante.
- **Etapas**: precargadas por seed SQL, sin configuración desde la UI.
- **Modo oscuro**: toggle manual (ícono sol/luna en la barra superior), respeta `prefers-color-scheme`
  la primera vez y después queda guardado en `localStorage`.

Explícitamente **fuera de alcance** en esta entrega (no agregar sin que el usuario lo pida):

- Gestión completa de roles y permisos.
- Actividades e historial comercial (notas de seguimiento, llamadas, etc.).
- Historial de cambios de etapa (auditoría/timeline).
- Pantallas de configuración general.
- Cierre completo de oportunidades (ganada/perdida como flujo especial, motivos de pérdida, etc.)
  — "Ganada" y "Perdida" existen solo como dos etapas más del embudo, sin lógica asociada.
- Cualquier funcionalidad de inteligencia artificial.

### Demo esperada

1. Iniciar sesión.
2. Registrar una empresa (en `/empresas`) y, desplegándola, un contacto.
3. Crear una oportunidad (en `/oportunidades`).
4. Visualizarla en el embudo (arriba de la misma página).
5. Cambiarla de etapa.
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

El login usa una Server Action (`src/app/login/actions.ts`) porque necesita escribir cookies de
sesión del lado servidor. Pero el CRUD de empresas/contactos/oportunidades (crear, editar, cambiar
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
    layout.tsx                Inter, anti-flash de dark mode, ToastProvider + TooltipHost
    icon.svg                  Favicon (isotipo con el verde de marca horneado)
    login/                    Login (fuera del grupo protegido), Server Action en actions.ts
      page.tsx                 Split-screen: panel de marca (cancha en SVG) + panel de form
      LoginForm.tsx            Client: show/hide de contraseña, banner de error, useFormStatus
    auth/signout/route.ts     Logout (POST, borra la sesión)
    (app)/                    Grupo de rutas protegidas (layout valida sesión)
      layout.tsx               Arma el AppShell + guard de auth
      dashboard/                KPIs + distribución del embudo + rankings
        page.tsx                 Server Component: cuenta y agrega oportunidades por etapa/empresa
        charts.tsx               MagnitudeBars / ShareBar en CSS puro (sin librería de charts)
      empresas/                 Empresas desplegables con sus contactos anidados
        page.tsx                 Server Component: fetch de empresas + contactos
        EmpresasList.tsx          Client: header+toolbar, búsqueda, acordeón, abre los drawers
        EmpresaForm.tsx           Form de alta/edición de empresa (usado dentro del Drawer)
        ContactoForm.tsx          Form de alta/edición de contacto (idem)
      oportunidades/             Embudo (kanban) + listado en una sola página
        page.tsx                 Server Component: fetch de oportunidades + catálogos
        OportunidadesView.tsx     Client: embudo, tabla + cards mobile, filtros, EtapaBadge
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
    AppShell.tsx                Sidebar colapsable desktop + header/drawer mobile + logout
    Logo.tsx                    GoalMark: isotipo en currentColor (sidebar, login, loader)
    ConfirmModal.tsx            Alert dialog centrado (lo usa el logout)
    Drawer.tsx                   Panel lateral derecho para los formularios de alta/edición
    RowActions.tsx               Menú "⋮" portaled que usan las filas de cada lista
    ThemeToggle.tsx              Toggle de modo oscuro (localStorage + prefers-color-scheme)
    form.tsx                    <Campo>, <CampoTextarea>, <CampoSelect>, <CampoMoney>,
                                <CampoGrupo>, <FormBanner>, <FormActions>
  lib/
    utils.ts                   cn() — merge de clases Tailwind
    money.ts                   Máscara/parseo es-AR + formatters de display
    money.check.ts             Self-check: node --test src/lib/money.check.ts
    supabase/
      client.ts                Cliente Supabase para Client Components (drawers, mutaciones)
      server.ts                Cliente Supabase para Server Components/Actions (usa cookies())
      middleware.ts             Lógica de refresco de sesión + redirects, usada por proxy.ts
      types.ts                  Tipos Database generados (tablas + relaciones para embeds tipados)
  proxy.ts                      Proxy/middleware raíz de Next.js (protege todas las rutas salvo /login)
docs/
  DESIGN.md                     Sumar UI Kit canónico (vendoreado, READ-ONLY, no editar)
  design-overrides.md           Dónde esta app se desvía del kit a propósito, y por qué
supabase/
  migrations/
    0001_init_schema.sql        Tablas, índices, triggers, RLS
    0002_seed_data.sql          Etapas y productos precargados
```

No hay rutas separadas para "nueva empresa" o "detalle de oportunidad": todo alta/edición pasa
por el `Drawer` desde la lista correspondiente. Tampoco hay una página de Contactos aparte — viven
anidados dentro de cada empresa en `/empresas`.

### Modelo de datos (Postgres, esquema `public`)

- `perfiles` — espejo liviano de `auth.users` (id, nombre, email) para poder mostrar el nombre de
  un responsable sin exponer la tabla `auth.users`. Se completa solo via trigger
  `on_auth_user_created` cuando se crea un usuario en Supabase Auth.
- `empresas` — nombre, cuit, teléfono, email, dirección, notas.
- `contactos` — nombre, apellido, email, teléfono, cargo, notas, `empresa_id` (FK opcional a
  `empresas`).
- `productos` — nombre (único), descripción, precio, categoría, activo.
- `etapas` — nombre, `orden` (único, define el orden de las columnas del embudo), color (hex,
  usado en la UI).
- `oportunidades` — título, monto, notas, `empresa_id`, `contacto_id`, `producto_id` (todas FK
  opcionales), `responsable_id` (FK opcional a `perfiles`), `etapa_id` (FK obligatoria a
  `etapas`).

Todas las tablas tienen RLS habilitado con una política única: cualquier usuario autenticado
puede leer y escribir. No hay distinción de roles todavía — ver "fuera de alcance" arriba.

## Supabase

Ya hay un proyecto de Supabase conectado y provisionado (organización `dgmoqhihtjjbetuedaad`,
proyecto `pdseuwdifzywpdgawbrl`, región `us-west-2`). Se armó vía el MCP de Supabase:

- Las migraciones `0001_init_schema.sql` y `0002_seed_data.sql` ya están aplicadas.
- RLS habilitado en las 6 tablas, sin warnings de seguridad pendientes (`get_advisors`).
- Hay un usuario habilitado para el login de la demo (`admin@crmgads1.com` — ver al usuario del
  proyecto por la contraseña, se generó una vez y no queda guardada en el repo).
- `.env.local` ya tiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` cargados
  (archivo gitignoreado, no se commitea).
- `src/lib/supabase/types.ts` está generado contra este proyecto real.

Si en algún momento hace falta reconectar a otro proyecto o recrearlo desde cero, `.env.example`
documenta qué variables hacen falta y el [README](./README.md) tiene los pasos manuales
(crear proyecto, correr las migraciones desde el SQL Editor, crear un usuario en
Authentication → Users).

## Vercel

**Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app)** — proyecto `crmgads1` (sin
guion; los intentos previos con `crm-gads1` fueron un nombre distinto que quedó descartado),
team `tomasballesteros12-8080`, conectado al repo de GitHub `TBalles/CRM_GADS1`: cada push a
`main` dispara un build y deploy de producción automático. Las env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) ya están cargadas en Project
Settings → Environment Variables. Verificado andando en producción (login + datos de Supabase +
UI rediseñada) el 2026-09-17.

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
- Respetá los tokens: `primary` (negro) y los neutros son fijos; el color de marca vive en
  `--brand` (`src/app/globals.css`). **No hardcodees colores de marca fuera de ese token** — la
  única excepción documentada es `src/app/icon.svg`, que es estático y no puede leer CSS.
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
- El único Server Action del proyecto es el login (`src/app/login/actions.ts`), porque necesita
  escribir la cookie de sesión. El resto del CRUD (empresas, contactos, oportunidades) muta la
  base directo desde Client Components — ver "Por qué mutaciones client-side" más arriba antes de
  agregar un Server Action nuevo para alguna de esas pantallas.
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

# Self-check de la máscara de dinero (sin framework, corre con el runner de Node)
node --test src/lib/money.check.ts
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
