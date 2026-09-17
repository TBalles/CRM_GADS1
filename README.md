# Tuco & Nito

CRM simple para proveedores y distribuidores de equipamiento deportivo (arcos, redes, conos,
pecheras, pelotas, etc.) que venden a canchas, clubes, complejos deportivos y escuelas de fútbol.

Primera entrega: login, empresas desplegables con sus contactos anidados, alta/edición de
oportunidades con un embudo comercial (Kanban, sin scroll horizontal) integrado en la misma
pantalla, edición inline de cualquier fila desde un panel lateral, modo oscuro y menú hamburguesa.
Ver [CLAUDE.md](./CLAUDE.md) para el detalle completo del alcance.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript). El CRUD muta la base directo desde
  el cliente con `@supabase/ssr`; Server Actions solo se usan para el login.
- [Tailwind CSS v4](https://tailwindcss.com/), con modo oscuro por clase (`dark:`)
- [Supabase](https://supabase.com/) (Postgres + Auth), plan gratuito
- Hosting en [Vercel](https://vercel.com/), plan gratuito

## 1. Crear el proyecto de Supabase

1. Entrá a [supabase.com](https://supabase.com/) y creá una cuenta (podés usar GitHub).
2. **New project** → elegí un nombre, una contraseña de base de datos (guardala) y una región
   (por ejemplo `South America (São Paulo)`).
3. Esperá a que termine de aprovisionarse (~2 minutos).

### Cargar el esquema y los datos precargados

1. En el proyecto, andá a **SQL Editor** → **New query**.
2. Pegá y ejecutá el contenido completo de
   [`supabase/migrations/0001_init_schema.sql`](./supabase/migrations/0001_init_schema.sql).
3. Repetí el paso con
   [`supabase/migrations/0002_seed_data.sql`](./supabase/migrations/0002_seed_data.sql) (carga las
   etapas del embudo y el catálogo de productos).

Esto crea las tablas `empresas`, `contactos`, `productos`, `etapas`, `oportunidades` y `perfiles`,
con Row Level Security habilitado (cualquier usuario autenticado puede leer y escribir — no hay
roles todavía).

### Crear el usuario para el login

1. Andá a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Cargá un email y una contraseña, y activá **Auto Confirm User** (si no, te va a pedir
   verificar el email antes de poder loguearse).
3. Ese es el usuario con el que se inicia sesión en la demo. Podés crear más desde el mismo lugar.

Como se guarda en `perfiles` un espejo del usuario (vía trigger), no hace falta ningún paso extra
para que aparezca como opción de "Responsable" en las oportunidades.

### Obtener las credenciales del proyecto

En **Project Settings** → **API** vas a encontrar:

- **Project URL** → va en `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(La anon key es segura para exponer en el cliente: el control de acceso real lo hace Row Level
Security en la base, no el secreto de la key.)

## 2. Correr el proyecto en local

```bash
npm install
cp .env.example .env.local
```

Editá `.env.local` y completá los dos valores que sacaste de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Después:

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) — te redirige a `/login`. Iniciá sesión con
el usuario que creaste en Supabase.

## 3. Deploy a Vercel (gratis)

1. Subí el repo a GitHub (ver sección siguiente si todavía no lo hiciste).
2. En [vercel.com](https://vercel.com/), **Add New** → **Project** → importá el repo de GitHub.
3. En **Environment Variables**, cargá las mismas dos variables que en `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **Deploy**. Vercel detecta Next.js automáticamente, no hace falta tocar el build command.

Cada push a `main` genera un deploy nuevo automáticamente, y esa URL de producción
(siempre la misma — no la de cada deploy individual) queda apuntando al último build exitoso.

**Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app)**

## Estructura del proyecto

Ver la sección "Estructura del proyecto" en [CLAUDE.md](./CLAUDE.md).

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # eslint
```
