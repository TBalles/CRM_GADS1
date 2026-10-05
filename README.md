# Tuco & Nito

CRM multitenant para **proveedores y distribuidores de equipamiento deportivo** (arcos, redes, conos,
pecheras, pelotas y todo lo que hace falta para mantener una cancha) que venden a clubes, complejos,
escuelas de fútbol, colegios y predios municipales.

Lo que lo distingue de un CRM genérico es el **ciclo del recambio**: cada producto tiene una vida útil, cada
venta la congela, y el sistema calcula qué equipos entregados vencieron o vencen en 60 días para que el
vendedor avise al cliente por mail o WhatsApp antes que nadie.

Trabajo práctico de *Gestión Aplicada al Desarrollo de Software II* (Ingeniería en Informática, UNLaM).
Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app). Entrega final: 2026-11-12.

> **Estado en una línea.** Versión 2.0.0 (CRM 2.0): el CRM está completo (fases F0 a F8, entrega final 1.0.0) y toda su interfaz se
> rediseñó con el sistema "Ledger", sin capacidades, datos ni permisos nuevos; la landing y el acceso no cambiaron. Falta aplicar a mano en
> Supabase las migraciones `0008` a `0012` (hay un [kit de un solo archivo](./supabase/aplicar/LEEME.md)); mientras tanto la
> aplicación esconde canchas, licitaciones, recambio en un clic y la numeración de presupuestos, y anda igual. Este README
> distingue siempre lo que ya funciona de lo que no.

## Qué hace hoy, por estado

| Estado | Qué significa |
|---|---|
| **Implementado** | Funciona en la aplicación y en la base, en producción |
| **Base lista, sin interfaz** | La base de datos ya lo aplica, pero ninguna pantalla lo muestra o permite usar |
| **Planificado** | No existe todavía; está en el plan con fase y fecha |

### Implementado

- **Acceso y cuentas.** Ingreso con email y contraseña; invitación por mail, activación, recuperación de
  contraseña y reenvío automático de la activación. Sin registro público. Mails por SMTP propio.
- **Empresas y contactos.** Listas con búsqueda, filtros y vista previa de la fila elegida (desde 1280 px), y fichas por pestañas (resumen, actividad,
  oportunidades, ventas, contactos, canchas y parque); alta y edición en paneles laterales.
- **Productos** con vida útil estimada en meses; se dan de baja, no se borran.
- **Ventas** con cabecera e ítems; cada ítem copia la vida útil del catálogo (snapshot) y tiene su propia
  fecha de entrega.
- **Alertas de recambio**: equipos vencidos o por vencer en 60 días, con mensaje armado para mail o WhatsApp
  y registro de cada envío.
- **Bitácora por cliente** (llamadas, reuniones, consultas, quejas, notas).
- **Oportunidades y embudo comercial**: tablero por etapa (arrastre de tarjetas), lista con filtros, detalle con
  historial de etapas y actividades, cierre ganada/perdida con motivo, reapertura y reasignación.
- **Tablero** con la cifra en juego, distribución del embudo, rankings y los recambios que vienen.
- **Usuarios, roles y permisos**: 19 permisos y cuatro roles por defecto (Administrador, Vendedor,
  Responsable comercial, Solo lectura). Un Vendedor ve solo su cartera.
- **Multitenant** con aislamiento por Row Level Security, y **panel de plataforma** (`/admin`) para el
  superadmin.
- **Landing pública** en `/` y modo oscuro.
- **IA asistida opcional** (F7): borrador del aviso de recambio y resumen de cuenta, siempre revisados por una persona; se apaga
  quitando la clave. Probada contra un servidor simulado, **no contra la API real** ([docs/ia.md](./docs/ia.md)).

### Aplicado en la base viva (verificación parcial)

- **Migraciones `0008` a `0012`**: baja lógica garantizada por la base, fecha de cierre no futura, índices de búsqueda, **canchas y
  licitaciones** (con el recambio en un clic) y **presupuestos numerados**. Se aplicaron con
  [`supabase/aplicar/aplicar_0008_a_0012.sql`](./supabase/aplicar/LEEME.md). Verificado contra la base viva por la API: las tablas
  `canchas`, `licitaciones` y `presupuestos` responden, `oportunidades.venta_item_id` existe y el Vendedor ve solo su cartera.
  **Sin verificar todavía contra la base viva**: las reglas que se prueban escribiendo (borrado, fechas, etapas, numeración); ver
  [notas de versión](./docs/notas-de-version.md).
- **Manual de usuario** en PDF: [`docs/Manual-de-usuario-Tuco-y-Nito.pdf`](./docs/Manual-de-usuario-Tuco-y-Nito.pdf). Se
  regenera con `npm run manual`. Quedan **4 figuras pendientes** (las dos de IA, que necesitan `ANTHROPIC_API_KEY`, y las dos del
  panel de plataforma, que necesitan una cuenta de superadmin).
  Cómo funciona: [docs/manual/LEEME.md](./docs/manual/LEEME.md).
- Pruebas E2E con Playwright y CI en GitHub Actions: escritas, **sin ejecutar completas**.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript, React 19)
- [Tailwind CSS v4](https://tailwindcss.com/), con modo oscuro por clase
- [Supabase](https://supabase.com/): Postgres (con RLS), Auth y Storage, plan gratuito
- Mails con `nodemailer` por SMTP (hoy una casilla de Gmail)
- Hosting en [Vercel](https://vercel.com/), plan gratuito

El CRUD muta la base directo desde el navegador con `@supabase/ssr`; las Server Actions se usan para lo
privilegiado (login, usuarios, mails). El porqué está en la
[decisión 0001](./docs/decisiones/0001-mutaciones-desde-el-cliente.md).

## Inicio rápido (local)

Necesitás Node (se probó con Node 24; los self-checks usan la ejecución directa de TypeScript de Node) y un
proyecto de Supabase.

```bash
npm install
cp .env.example .env.local
```

Completá en `.env.local` los valores de **Project Settings, API** de tu proyecto de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000): vas a ver la **landing pública**; "Ingresar" lleva al
CRM. La lista completa de variables (mails, contacto, `SITE_URL`) está en
[docs/deploy.md](./docs/deploy.md#5-variables-de-entorno).

> `SUPABASE_SERVICE_ROLE_KEY` es **obligatoria** para crear usuarios, invitar, recuperar contraseñas y usar el
> panel `/admin`, y es **secreta**: se usa solo en el servidor y nunca lleva el prefijo `NEXT_PUBLIC_`
> (saltea toda la seguridad de la base). `src/lib/supabase/admin.ts` importa `server-only`, así que el build
> falla si alguien la importa desde un componente de cliente.

### Preparar la base de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com/) (Postgres 15 o superior).
2. Creá en **Authentication, Users** la cuenta que va a ser el **superadmin**, con *Auto Confirm User*.
3. En **SQL Editor**, pegá y ejecutá **en orden** los archivos de `supabase/migrations/`:
   `0001`, `0002`, `0003`, `0004`, `0005`, `0006` y `0007`; después, **un solo archivo** con las cinco restantes:
   `supabase/aplicar/aplicar_0008_a_0012.sql` (pasos y verificación en [su LEEME](./supabase/aplicar/LEEME.md)).
   - Antes de la `0004`, cambiá el email de la línea marcada con `>>>` por el del superadmin.
   - La `0007` no es solo aditiva (renombra roles y etapas, cierra oportunidades): leé su encabezado, y
     desplegá la aplicación inmediatamente después de aplicarla.
4. Verificá: el kit termina con una tabla (todo `OK` y un `TODO OK` final); además corré las pruebas de `supabase/tests/`
   (`0005`, `0007`, `0008`, `0009`, `0011` y `0012`). Cada una tiene que devolver una fila `TODO OK` y no deja nada en la base
   (hacen rollback).
5. En **Authentication, Sign In / Providers, Email**, desactivá **Allow new users to sign up**.
6. Opcional: cargá los datos de demostración con `supabase/seeds/demo_catedra.sql` (ver abajo).

Después de cambiar el esquema, regenerá los tipos:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/supabase/types.ts
```

(`src/lib/supabase/types.ts` todavía refleja el esquema anterior a la `0007`: regeneralo después de aplicar el kit y volvé a correr `npm run typecheck`.) El paso a paso completo, con
advertencias y problemas frecuentes, está en [docs/deploy.md](./docs/deploy.md).

### Mails

Activación, recuperación de contraseña y alertas salen por el SMTP propio; **Supabase no manda ningún
mail**. Sin configurar nada todo funciona: las alertas abren el cliente de correo del usuario (`mailto:`) y
las invitaciones devuelven el link para compartirlo a mano. Para que salgan solos desde la casilla de la
marca, cargá `SMTP_USER` y `SMTP_PASS` (con Gmail, una **contraseña de aplicación**, no la de la cuenta;
requiere verificación en dos pasos) y `SITE_URL` con el dominio público. Los links de los mails se arman con
`SITE_URL` y nunca con el encabezado `Host`. Pasos de Gmail y límites en
[docs/deploy.md](./docs/deploy.md#7-mails-por-smtp-con-gmail).

### IA opcional (F7)

Con `ANTHROPIC_API_KEY` en `.env.local` (y `ANTHROPIC_MODEL`, por defecto `claude-opus-5-5`) aparecen "Redactar con IA" en
`/alertas` y "Resumir con IA" en las fichas de empresa y de contacto. Son borradores que una persona revisa: nada se envía ni se
guarda solo. **Sin la clave la función no existe** y el CRM anda igual. Qué datos salen, costo y límites: [docs/ia.md](./docs/ia.md).

## Cuentas de demostración

`supabase/seeds/demo_catedra.sql` crea la organización **Cátedra UNLaM (demo)** con una cuenta por cada rol
por defecto y datos en todos los módulos (8 clientes, 9 contactos, 13 productos, 12 oportunidades, 6 ventas,
alertas, bitácora e historial de etapas). Las fechas se calculan contra la fecha de ejecución. Es
re-ejecutable.

| Cuenta | Rol | Qué ve |
|---|---|---|
| `administrador@demo.tuconito.com.ar` | Administrador | Todo, más usuarios, roles y configuración |
| `ventas@demo.tuconito.com.ar` | Vendedor | Solo su cartera: 4 de los 8 clientes |
| `corporativo@demo.tuconito.com.ar` | Responsable comercial | Todo el equipo; asigna y reabre |
| `lectura@demo.tuconito.com.ar` | Solo lectura | Clientes y catálogo |

Contraseña de las cuatro: `Catedra.2026`. Son credenciales de demostración para la cátedra, públicas y
compartidas (no son un secreto). Entrar con `administrador@` y con `ventas@` muestra la diferencia de
cartera. El superadmin es la cuenta que cada instalación define en la migración `0004`; entra a `/admin`.

## Scripts

```bash
npm run dev                          # servidor de desarrollo (http://localhost:3000)
npm run build                        # build de producción
npm run start                        # sirve el build de producción
npm run lint                         # eslint (src, e2e, scripts/guard y las configs de Playwright) --max-warnings=0 (sin advertencias)
npm run typecheck                    # next typegen + tsc --noEmit sobre src, e2e y scripts/guard
npm test                             # self-checks: node --test "src/**/*.check.ts" (442 pruebas en 37 archivos)
npm run guard                        # guardas de CRM 2.0: archivos congelados (guard:frozen) + pixel diff de la landing y el acceso (guard:landing, necesita .env)
npm run test:e2e                     # pruebas de extremo a extremo (Playwright); sin credenciales E2E_* se saltan
npm run manual                       # manual de usuario: capturas (necesita la app y MANUAL_EMAIL…) + PDF en docs/
npm run manual:pdf                   # solo el PDF (sin la app ni internet, salvo la primera vez por las fuentes)
npm run migraciones:consolidar       # regenera supabase/aplicar/aplicar_0008_a_0012.sql (npm test lo verifica)
```

`lint`, `typecheck`, `test` y `build` son los pasos de la integración continua (`.github/workflows/ci.yml`); las guardas (`npm run guard`) todavía no están en la CI. Las
pruebas SQL (`supabase/tests/`) se pegan en el SQL Editor. Las E2E corren contra una organización de pruebas aparte
(`supabase/seeds/e2e_tests.sql`), nunca contra la demo. Qué prueba cada una, las variables y cuál SQL va antes o
después de la `0007`: [docs/pruebas.md](./docs/pruebas.md).

## Mapa del proyecto

```text
src/
  app/                  Páginas (App Router)
    (app)/              CRM protegido: el layout valida la sesión y monta el marco; `crm.css` (tokens `--crm-*`)
      (crm2)/           Todas las pantallas: dashboard, empresas, contactos, oportunidades, productos, ventas,
                        alertas, usuarios, configuración, tablero comercial, embudo, sin-permisos
    admin/              Panel de plataforma (superadmin), con el mismo marco del CRM
    login, recuperar, definir-clave, auth/   Acceso y cuentas
    page.tsx            Landing pública
  components/           crm/ (primitivos y marco del CRM, `crm/shell/`), ui/ y landing/ (landing y acceso), íconos del rubro
  lib/                  sesion, permisos, cuentas, email, ia (F7), supabase (3 clientes), money, equipo
  proxy.ts              Refresca la sesión y exige login
supabase/
  migrations/           0001 a 0012 (se aplican en orden; de la 0008 en adelante faltan en la base viva)
  aplicar/              Kit: las migraciones 0008 a 0012 en un solo archivo, con verificación, y su LEEME
  tests/                Pruebas SQL con rollback
  seeds/                demo_catedra.sql, demo_rubro.sql (canchas, licitación, presupuesto) y e2e_tests.sql
scripts/                manual/ (capturas y PDF del manual), migraciones/ (el kit consolidado) y guard/ (guardas de CRM 2.0)
docs/                   Documentación (ver abajo) y el manual de usuario (docs/manual/ y el PDF)
design-system/          crm-2/ (sistema "Ledger" del CRM, contrato de aislamiento y baselines) y tuco-y-nito/ (marca; vigente para la landing)
```

La estructura detallada está en [CLAUDE.md](./CLAUDE.md).

## Documentación

| Documento | Contenido |
|---|---|
| [Manual de usuario (PDF)](./docs/Manual-de-usuario-Tuco-y-Nito.pdf) | Para el personal del proveedor: 22 capítulos, capturas y reglas. Cómo se arma: [docs/manual/LEEME.md](./docs/manual/LEEME.md) |
| [supabase/aplicar/LEEME.md](./supabase/aplicar/LEEME.md) | Aplicar las migraciones 0008 a 0012 en Supabase, verificarlas y regenerar tipos y manual |
| [docs/README.md](./docs/README.md) | Índice de toda la documentación |
| [docs/notas-de-version.md](./docs/notas-de-version.md) | Todo lo agregado desde la primera entrega, por área, con el estado frente a la consigna |
| [CHANGELOG.md](./CHANGELOG.md) | Cambios por hito y fecha |
| [docs/arquitectura.md](./docs/arquitectura.md) | Componentes, flujos, sesión, multitenencia, mails, despliegue (con diagramas) |
| [docs/modelo-de-datos.md](./docs/modelo-de-datos.md) | Esquema, relaciones y RLS por tabla |
| [docs/reglas-de-negocio.md](./docs/reglas-de-negocio.md) | Cada regla y dónde se hace cumplir |
| [docs/seguridad.md](./docs/seguridad.md) y [SECURITY.md](./SECURITY.md) | Modelo de seguridad y cómo reportar |
| [docs/deploy.md](./docs/deploy.md) | Supabase, Vercel, SMTP y variables de entorno |
| [docs/pruebas.md](./docs/pruebas.md) | Pruebas y verificaciones, incluidas las guardas de aislamiento de CRM 2.0 |
| [design-system/crm-2/](./design-system/crm-2/README.md) | Sistema de diseño del CRM (`MASTER.md`) y contrato de aislamiento de la landing (`README.md`) |
| [docs/decisiones/](./docs/decisiones/README.md) | Decisiones de arquitectura (ADR) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Commits, ramas, migraciones y diseño |

## Despliegue

El frontend está en Vercel, conectado al repositorio de GitHub: **cada push a `main` genera un deploy de
producción**. La base, la autenticación y el almacenamiento están en Supabase. Las migraciones se aplican a
mano y **antes** del deploy cuando la aplicación vieja no es compatible. Resumen y runbook completo en
[docs/deploy.md](./docs/deploy.md).

## Estado de las entregas del curso

| Entrega | Fecha | Estado |
|---|---|---|
| Primera: login, empresas y contactos, oportunidades, embudo | 2026-09-24 | Alcance cubierto por la aplicación, que además ya incluye multitenencia, roles, ventas y alertas |
| Final: CRM completo según la consigna | 2026-11-12 | Hecho (1.0.0, rediseño de la interfaz en la 2.0.0): interfaz y base completas; falta aplicar las migraciones `0008` a `0012` en la base viva |

Las fases F0 a F8 están hechas; el plan y el requisito por requisito frente a la consigna están en
[docs/notas-de-version.md](./docs/notas-de-version.md#e-estado-frente-a-la-consigna).

## Equipo y licencia

Equipo de cuarto año de Ingeniería en Informática, UNLaM (los nombres figuran en la landing pública).

**Licencia:** pendiente de definir.
