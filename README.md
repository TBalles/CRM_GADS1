# Tuco & Nito

CRM multitenant para **proveedores y distribuidores de equipamiento deportivo** (arcos, redes, conos,
pecheras, pelotas y todo lo que hace falta para mantener una cancha) que venden a clubes, complejos,
escuelas de fútbol, colegios y predios municipales.

Lo que lo distingue de un CRM genérico es el **ciclo del recambio**: cada producto tiene una vida útil, cada
venta la congela, y el sistema calcula qué equipos entregados vencieron o vencen en 60 días para que el
vendedor avise al cliente por mail o WhatsApp antes que nadie.

Trabajo práctico de *Gestión Aplicada al Desarrollo de Software II* (Ingeniería en Informática, UNLaM).
Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app). Entrega final: 2026-11-12.

> **Estado en una línea.** La base de datos ya cumple casi todo el módulo comercial de la consigna (migración
> `0007`, aplicada); la interfaz de esas capacidades se está construyendo en las fases F1 a F8 (hasta el
> 2026-11-11). Este README distingue siempre lo que ya funciona de lo que no.

## Qué hace hoy, por estado

| Estado | Qué significa |
|---|---|
| **Implementado** | Funciona en la aplicación y en la base, en producción |
| **Base lista, sin interfaz** | La base de datos ya lo aplica, pero ninguna pantalla lo muestra o permite usar |
| **Planificado** | No existe todavía; está en el plan con fase y fecha |

### Implementado

- **Acceso y cuentas.** Ingreso con email y contraseña; invitación por mail, activación, recuperación de
  contraseña y reenvío automático de la activación. Sin registro público. Mails por SMTP propio.
- **Empresas y contactos.** Alta, edición y búsqueda; cada empresa se despliega y muestra sus contactos.
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

### Base lista, sin interfaz (migración 0007)

Reglas del embudo en la base (ganada con fecha, perdida con motivo, reabrir con permiso), cuya interfaz
llegó en F2, y todo lo que la 0007 agregó y las fases F1 y F2 ya muestran. Detalle en
[docs/notas-de-version.md](./docs/notas-de-version.md).

### Planificado

IA opcional y manual de usuario en PDF. Ya están en el repositorio las funciones del rubro (F4, migración `0011`) y el
presupuesto imprimible, las pruebas E2E y la CI (F6, migración `0012`); las dos migraciones se aplican a mano (ver
[docs/deploy.md](./docs/deploy.md)).

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
   `0001`, `0002`, `0003`, `0004`, `0005`, `0006` y `0007`.
   - Antes de la `0004`, cambiá el email de la línea marcada con `>>>` por el del superadmin.
   - La `0007` no es solo aditiva (renombra roles y etapas, cierra oportunidades): leé su encabezado, y
     desplegá la aplicación inmediatamente después de aplicarla.
4. Verificá: ejecutá `supabase/tests/0005_permisos.sql` y `supabase/tests/0007_reglas.sql`. Cada uno tiene que
   devolver una fila `TODO OK` y no deja nada en la base (hacen rollback).
5. En **Authentication, Sign In / Providers, Email**, desactivá **Allow new users to sign up**.
6. Opcional: cargá los datos de demostración con `supabase/seeds/demo_catedra.sql` (ver abajo).

Después de cambiar el esquema, regenerá los tipos:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/supabase/types.ts
```

(`src/lib/supabase/types.ts` todavía refleja el esquema anterior a la `0007`.) El paso a paso completo, con
advertencias y problemas frecuentes, está en [docs/deploy.md](./docs/deploy.md).

### Mails

Activación, recuperación de contraseña y alertas salen por el SMTP propio; **Supabase no manda ningún
mail**. Sin configurar nada todo funciona: las alertas abren el cliente de correo del usuario (`mailto:`) y
las invitaciones devuelven el link para compartirlo a mano. Para que salgan solos desde la casilla de la
marca, cargá `SMTP_USER` y `SMTP_PASS` (con Gmail, una **contraseña de aplicación**, no la de la cuenta;
requiere verificación en dos pasos) y `SITE_URL` con el dominio público. Los links de los mails se arman con
`SITE_URL` y nunca con el encabezado `Host`. Pasos de Gmail y límites en
[docs/deploy.md](./docs/deploy.md#7-mails-por-smtp-con-gmail).

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
npm run lint                         # eslint src e2e playwright.config.ts --max-warnings=0 (sin advertencias)
npm run typecheck                    # tsc --noEmit sobre src y sobre e2e
npm test                             # self-checks: node --test "src/**/*.check.ts" (187 pruebas en 20 archivos)
npm run test:e2e                     # pruebas de extremo a extremo (Playwright); sin credenciales E2E_* se saltan
```

`lint`, `typecheck`, `test` y `build` son los pasos de la integración continua (`.github/workflows/ci.yml`). Las
pruebas SQL (`supabase/tests/`) se pegan en el SQL Editor. Las E2E corren contra una organización de pruebas aparte
(`supabase/seeds/e2e_tests.sql`), nunca contra la demo. Qué prueba cada una, las variables y cuál SQL va antes o
después de la `0007`: [docs/pruebas.md](./docs/pruebas.md).

## Mapa del proyecto

```text
src/
  app/                  Páginas (App Router)
    (app)/              CRM protegido: dashboard, empresas, oportunidades, productos, ventas,
                        alertas, usuarios, sin-permisos
    admin/              Panel de plataforma (superadmin)
    login, recuperar, definir-clave, auth/   Acceso y cuentas
    page.tsx            Landing pública
  components/           Primitivos del UI Kit, formularios, shell, íconos del rubro
  lib/                  sesion, permisos, cuentas, email, supabase (3 clientes), money, equipo
  proxy.ts              Refresca la sesión y exige login
supabase/
  migrations/           0001 a 0009 (se aplican en orden; la 0008 y la 0009 faltan en la base viva)
  tests/                Pruebas SQL con rollback
  seeds/                demo_catedra.sql
docs/                   Documentación (ver abajo)
design-system/          Sistema de diseño de la marca
```

La estructura detallada está en [CLAUDE.md](./CLAUDE.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/README.md](./docs/README.md) | Índice de toda la documentación |
| [docs/notas-de-version.md](./docs/notas-de-version.md) | Todo lo agregado desde la primera entrega, por área, con el estado frente a la consigna |
| [CHANGELOG.md](./CHANGELOG.md) | Cambios por hito y fecha |
| [docs/arquitectura.md](./docs/arquitectura.md) | Componentes, flujos, sesión, multitenencia, mails, despliegue (con diagramas) |
| [docs/modelo-de-datos.md](./docs/modelo-de-datos.md) | Esquema, relaciones y RLS por tabla |
| [docs/reglas-de-negocio.md](./docs/reglas-de-negocio.md) | Cada regla y dónde se hace cumplir |
| [docs/seguridad.md](./docs/seguridad.md) y [SECURITY.md](./SECURITY.md) | Modelo de seguridad y cómo reportar |
| [docs/deploy.md](./docs/deploy.md) | Supabase, Vercel, SMTP y variables de entorno |
| [docs/pruebas.md](./docs/pruebas.md) | Pruebas y verificaciones |
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
| Final: CRM completo según la consigna | 2026-11-12 | En curso. Base de datos lista (`0007`); interfaz en F1 a F8 |

Plan de fases (F1 2026-10-13, F2 2026-10-18, F3 2026-10-22, F4 2026-10-28, F5 2026-11-02, F6 2026-11-05,
F7 2026-11-08, F8 2026-11-11) y requisito por requisito frente a la consigna en
[docs/notas-de-version.md](./docs/notas-de-version.md#e-estado-frente-a-la-consigna).

## Equipo y licencia

Equipo de cuarto año de Ingeniería en Informática, UNLaM (los nombres figuran en la landing pública).

**Licencia:** pendiente de definir.
