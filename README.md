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
4. Repetí el paso con
   [`supabase/migrations/0003_productos_ventas_alertas_bitacora.sql`](./supabase/migrations/0003_productos_ventas_alertas_bitacora.sql)
   (agrega la vida útil a los productos, el historial de ventas, la bitácora de clientes y la
   vista de alertas de recambio).

Esto crea las tablas `empresas`, `contactos`, `productos`, `etapas`, `oportunidades`, `perfiles`,
`ventas`, `venta_items`, `bitacora_entradas` y `alertas_enviadas`, más la vista
`alertas_vida_util`, con Row Level Security habilitado (cualquier usuario autenticado puede leer y
escribir — no hay roles todavía).

> Las tres migraciones se corren **en orden**. La 0003 es puramente aditiva: no borra ni modifica
> datos existentes, así que se puede aplicar sobre una base que ya está en uso.

#### Después de correr la 0003: regenerar los tipos

`src/lib/supabase/types.ts` tiene la sección de la 0003 escrita **a mano**, porque la migración no
se había aplicado todavía cuando se escribió el código. Una vez que la corras, regeneralos contra
el proyecto real para que la fuente de verdad vuelva a ser el generador:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/supabase/types.ts
```

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

### Variables de contacto (opcionales)

Son los datos que muestra la landing pública. Si no las cargás, se ven valores de ejemplo: la
aplicación funciona igual, pero el pie y la sección de contacto van a mostrar datos genéricos.
Van en `.env.local` en desarrollo y en **Project Settings → Environment Variables** en Vercel.

```
CONTACTO_EMAIL=contacto@tudominio.com
CONTACTO_WHATSAPP=+54 9 11 5555-5555
CONTACTO_TELEFONO=11 5555-5555
CONTACTO_DIRECCION=Florencio Varela 1903
CONTACTO_CIUDAD=San Justo, Buenos Aires
CONTACTO_INSTAGRAM=https://instagram.com/tucuenta
CONTACTO_LINKEDIN=https://linkedin.com/company/tuempresa
```

No llevan el prefijo `NEXT_PUBLIC_` a propósito: la landing es un Server Component, así que estos
valores se resuelven en el servidor y viajan ya renderizados en el HTML.

### Envío de mails de alerta (opcional)

La sección **Alertas** funciona sin configurar nada: al tocar "Mail" abre el cliente de correo del
usuario con el mensaje ya escrito, y el envío queda registrado igual.

Para que los mails salgan **solos desde la casilla de la marca**, se configura por SMTP. Con
`SMTP_USER` y `SMTP_PASS` cargadas, la aplicación cambia de modo sola:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=lacasilla@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

`SMTP_HOST` y `SMTP_PORT` tienen esos valores por defecto, así que con Gmail alcanza con las dos
últimas. `ALERTAS_FROM_EMAIL` es opcional: si no está, se envía desde `SMTP_USER`.

#### Con Gmail: contraseña de aplicación, NO la de la cuenta

Google no acepta la contraseña de la cuenta por SMTP. Hace falta una **contraseña de aplicación**:

1. Entrá a la cuenta de Gmail de la marca → [myaccount.google.com/security](https://myaccount.google.com/security)
   y activá la **Verificación en dos pasos** (sin esto, el paso 2 no aparece).
2. Entrá a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), creá una
   con el nombre `Tuco & Nito CRM` y copiá los 16 caracteres que muestra (se ven una sola vez).
3. Esos 16 caracteres van en `SMTP_PASS` (con o sin los espacios, da igual).

Si cambian la contraseña de la cuenta, Google **revoca** las contraseñas de aplicación: hay que
generar una nueva y actualizar `SMTP_PASS`. El síntoma es el aviso "La casilla rechazó el usuario
o la contraseña de aplicación" en la pantalla de Alertas.

> Gmail permite unos **500 mails por día** desde una cuenta común: de sobra para avisos de
> recambio. Si algún día necesitan más volumen o un remitente con dominio propio
> (`alertas@tucoynito.com.ar`), se pasa a un proveedor transaccional (Resend, Postmark,
> SendGrid): todos exponen SMTP, así que se cambian estas variables y no el código.

Después:

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) — vas a ver la **landing pública**. Desde
"Ingresar" entrás al CRM con el usuario que creaste en Supabase.

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
