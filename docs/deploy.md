# Despliegue (runbook)

Cómo levantar Tuco & Nito desde cero en Supabase y Vercel, y cómo actualizar una instalación que ya existe.
Todo corre en planes gratuitos. Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app).

> **Regla de oro de cada actualización con migración.** Aplicar la migración en Supabase y **desplegar la
> aplicación inmediatamente después**. Entre un paso y otro, no editar roles desde `/usuarios`. Motivo en
> [Orden de migración y deploy](#8-orden-de-migración-y-deploy).

Contenido: [1. Supabase](#1-supabase) · [2. Migraciones](#2-migraciones-en-orden) ·
[3. Datos de demostración](#3-datos-de-demostración-seed) · [4. Auth](#4-configuración-de-auth) ·
[5. Variables de entorno](#5-variables-de-entorno) · [6. Vercel](#6-vercel) · [7. Mails con Gmail](#7-mails-por-smtp-con-gmail) ·
[8. Orden de migración y deploy](#8-orden-de-migración-y-deploy) · [9. Lista de verificación](#9-lista-de-verificación-posterior-al-deploy) ·
[10. Problemas frecuentes](#10-problemas-frecuentes)

---

## 1. Supabase

1. Creá una cuenta en [supabase.com](https://supabase.com/) y un proyecto (**New project**). Anotá la
   contraseña de la base y elegí una región cercana.
2. Esperá a que se aprovisione (unos 2 minutos).
3. Requisito: **Postgres 15 o superior** (la `0004` usa `on delete set null (columna)`, que es de PG15).
4. Credenciales: **Project Settings, API** muestra la **Project URL**, la clave **anon / public** y la
   clave **service_role**. La `service_role` es secreta (ver [seguridad](./seguridad.md#3-secretos-y-claves)).
5. Antes de la migración `0004`, creá en **Authentication, Users, Add user, Create new user** (con *Auto
   Confirm User* activado) la cuenta que va a ser el **superadmin** de la plataforma.

## 2. Migraciones, en orden

Se aplican **en orden**, pegando cada archivo completo en **SQL Editor, New query** (o con
`supabase db push`). Todas viven en `supabase/migrations/`.

| Orden | Archivo | Qué hace | Antes de correrla |
|---|---|---|---|
| 1 | `0001_init_schema.sql` | Tablas base, índices, trigger de `perfiles`, RLS inicial | Nada |
| 2 | `0002_seed_data.sql` | Etapas y productos precargados | Nada |
| 3 | `0003_productos_ventas_alertas_bitacora.sql` | Vida útil, ventas, bitácora, alertas y la vista de alertas. Aditiva | Nada |
| 4 | `0004_multitenant.sql` | Organizaciones, `organizacion_id` en todo, FKs compuestas, RLS por organización. Va dentro de `begin`/`commit` | **Editar el email del superadmin** en la línea marcada con `>>>` (línea 22) y que exista en Authentication. Todo lo cargado hasta ahí pasa a la organización "Tuco & Nito (demo)" |
| 5 | `0005_roles_permisos.sql` | Roles con permisos por organización, RLS por permiso. `begin`/`commit` | Requiere la 0004 |
| 6 | `0006_superadmin_sin_organizacion.sql` | El superadmin deja de pertenecer a la organización demo | Requiere la 0005. Se puede correr más de una vez |
| 7 | `0007_entrega_final.sql` | Entrega final (ver [notas de versión](./notas-de-version.md#c-la-base-de-datos-de-la-entrega-final-migración-0007)) | Requiere 0001 a 0006. **Leer la regla de orden de abajo** |

| 8 | `0008_baja_logica.sql` | Quita las políticas `borrar` de empresas y contactos y garantiza una etapa ganada y una perdida. Idempotente, sin `begin`/`commit` | Requiere la 0007. **Pendiente de aplicar en la base viva** |
| 9 | `0009_reglas_oportunidades.sql` | Fecha de cierre no futura (fecha de Argentina), fecha de cierre por defecto de Argentina y "empresa o contacto" obligatorio en oportunidades. `create or replace` + trigger nuevo, idempotente, sin `begin`/`commit` | Requiere la 0008. **Pendiente de aplicar en la base viva.** Después, `supabase/tests/0009_reglas_oportunidades.sql` |

Cosas a saber:

- **0008 y 0009 están en el repositorio pero no en la base viva.** Se aplican a mano, en ese orden, y se
  despliega enseguida. La app de F2 ya valida las tres reglas de la 0009 en pantalla y traduce sus errores,
  así que desplegarla antes o después no rompe nada; sin la 0009 la base simplemente no las impone.
- **La 0004 cambia datos existentes** y, si el email del superadmin no existe en Authentication, aborta con
  un mensaje claro (todo dentro de una transacción: no queda nada a medias).
- **La 0007 no es solo aditiva.** Renombra roles y etapas, cierra oportunidades, asigna responsables. Corre
  esos pasos de datos una sola vez; volver a correrla no duplica ni devuelve permisos, pero **no deshace
  nada**. No lleva `begin`/`commit` propios a propósito.
- **No hay migraciones de reversa.** Antes de aplicar una en una base con datos que importan, hacé una copia
  de seguridad. *Pendiente de confirmar:* qué respaldos ofrece el plan gratuito del proyecto.
- **El comentario de la `0004` menciona `supabase/tests/0004_aislamiento.sql`, que no existe.** La prueba
  vigente es `supabase/tests/0005_permisos.sql`.

### Ensayar la 0007 sin aplicarla

El script de pruebas termina en `ROLLBACK`, así que se puede ensayar la migración en una transacción:

```sql
begin;
-- pegar acá TODO supabase/migrations/0007_entrega_final.sql
-- pegar acá TODO supabase/tests/0007_reglas.sql   (su propio ROLLBACK deshace las dos cosas)
```

La última fila tiene que decir `TODO OK`. No dejés la transacción abierta si el ensayo falla: ejecutá
`rollback;`.

### Después de cada migración que cambia el esquema

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/supabase/types.ts
```

`src/lib/supabase/types.ts` **no se regeneró después de la 0007** y todavía refleja el esquema anterior.
Regenerarlo es previo a construir las pantallas de F1.

### Pruebas SQL

Se ejecutan en el SQL Editor y terminan en `ROLLBACK` (no dejan nada). Detalle y qué prueba cada una en
[pruebas](./pruebas.md). Después de la 0007: `0005_permisos.sql` y `0007_reglas.sql` tienen que devolver
`TODO OK`; después de la 0008, `0008_baja_logica.sql`; después de la 0009, `0009_reglas_oportunidades.sql`. `0007_reejecucion.sql` es la excepción: solo funciona en una base **sin** la 0007.

### Storage

La 0007 crea el bucket privado `logos` (PNG, JPG, WebP, hasta 1 MB) y sus políticas. No hace falta crearlo a
mano. Limitación: Supabase prohíbe `DELETE` directo sobre `storage.objects` (trigger
`storage.protect_delete`), por eso las pruebas SQL no borran de ahí; los archivos se borran por la API de
Storage, que aplica las mismas políticas.

## 3. Datos de demostración (seed)

`supabase/seeds/demo_catedra.sql` crea la organización "Cátedra UNLaM (demo)" con cuatro cuentas (una por
rol por defecto) y datos en todos los módulos. Requiere `0001` a `0007`.

- Se pega entero en el SQL Editor. Es **re-ejecutable**: las filas tienen id fijo y los datos que sumó la
  0007 se refrescan en cada corrida.
- Las fechas se calculan contra `current_date`, así que las alertas quedan bien sin importar el día.
- Para borrar la demo entera:

  ```sql
  delete from public.organizaciones where id = '11111111-1111-1111-1111-111111111111';
  delete from auth.users where email like '%@demo.tuconito.com.ar';
  ```

- Las cuentas están en el [README](../README.md#cuentas-de-demostración). Su contraseña es pública: ver los
  [límites de seguridad](./seguridad.md#6-límites-conocidos).
- Después de aplicar la 0007 a una demo anterior, hay que volver a correr el seed.

## 4. Configuración de Auth

En **Authentication** del proyecto de Supabase:

| Ajuste | Valor | Por qué |
|---|---|---|
| Sign In / Providers, Email: **Allow new users to sign up** | **Desactivado** | Los usuarios los crean el superadmin y los administradores desde la app; nunca un registro público |
| Provider Email | Habilitado | Es el método de ingreso (email y contraseña) |

La aplicación **no usa el mailer de Supabase**: no manda invitaciones ni recuperaciones por ahí. Genera los
links con la clave de servicio y los envía por SMTP propio, y los canjea en su propia ruta `/auth/confirm`
con `verifyOtp`. Por eso este flujo no depende de los *Redirect URLs* de Supabase. *Pendiente de confirmar:*
valores de *Site URL* y *Redirect URLs* en el proyecto real (no son necesarios para este flujo según el
código, pero conviene fijar el *Site URL* en el dominio de producción por higiene).

## 5. Variables de entorno

En local van en `.env.local` (ignorado por git; se parte de `.env.example`). En producción, en **Vercel,
Project Settings, Environment Variables**. La lista sale del uso de `process.env` en `src/`.

| Variable | Obligatoria | Para qué | Sensible |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto de Supabase | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave anon (pública; la RLS protege los datos) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí, para usuarios, clientes y cuentas | Crear usuarios, generar links de acceso, dar de baja, panel `/admin`. **Solo servidor, nunca con `NEXT_PUBLIC_`**. Sin ella, esas pantallas muestran "Falta configurar SUPABASE_SERVICE_ROLE_KEY" | **Sí** |
| `SITE_URL` | Recomendada | Origen de los links de los mails (`https://dominio`, sin barra final). Si falta, se usa el dominio que Vercel inyecta; en desarrollo, `http://localhost:3000` | No |
| `SMTP_USER` | Opcional | Casilla que envía. Con `SMTP_USER` y `SMTP_PASS` los mails salen del servidor; sin ellas, las alertas abren `mailto:` y las invitaciones devuelven el link | No |
| `SMTP_PASS` | Opcional | Contraseña de aplicación de Google (se aceptan los espacios) | **Sí** |
| `SMTP_HOST` | Opcional | Por defecto `smtp.gmail.com` | No |
| `SMTP_PORT` | Opcional | Por defecto `465` (TLS directo); con `587` usa STARTTLS | No |
| `ALERTAS_FROM_EMAIL` | Opcional | Remitente. Por defecto, `SMTP_USER`. Gmail lo reescribe si no es la propia casilla | No |
| `CONTACTO_EMAIL` | Opcional | Landing; además es el `Reply-To` de los mails si está definida | No |
| `CONTACTO_WHATSAPP` | Opcional | Landing; además arma el botón "Coordinar por WhatsApp" del mail de alerta | No |
| `CONTACTO_TELEFONO`, `CONTACTO_DIRECCION`, `CONTACTO_CIUDAD`, `CONTACTO_INSTAGRAM`, `CONTACTO_LINKEDIN` | Opcionales | Datos de contacto de la landing. Sin ellas se ven valores de ejemplo | No |
| `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` | No se cargan | Las inyecta Vercel; `origenPublico()` las usa si no hay `SITE_URL` | No |

Las variables `CONTACTO_*` no llevan prefijo `NEXT_PUBLIC_` a propósito: la landing es un Server Component y
se resuelven en el servidor.

*Pendiente de confirmar:* que `.env.example` liste todas las variables de esta tabla (no se pudo leer al
escribir este documento).

## 6. Vercel

1. Subí el repositorio a GitHub.
2. En [vercel.com](https://vercel.com/): **Add New, Project**, importá el repositorio. Vercel detecta
   Next.js; no hace falta tocar el comando de build.
3. Cargá las variables de la sección anterior (al menos las tres de Supabase y `SITE_URL`).
4. **Deploy**.

Desde ahí, **cada push a `main` genera un deploy de producción** automático. El proyecto actual se llama
`crmgads1` (sin guion). El dominio de producción apunta siempre al último build exitoso.

Una variable de entorno nueva o cambiada solo se aplica con un deploy nuevo.

## 7. Mails por SMTP con Gmail

Hace falta una **contraseña de aplicación**, no la contraseña de la cuenta (Google no acepta esa por SMTP).

1. En la cuenta de Gmail de la marca, activá la **Verificación en dos pasos**
   ([myaccount.google.com/security](https://myaccount.google.com/security)).
2. Creá una contraseña de aplicación en
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) con el nombre
   `Tuco & Nito CRM` y copiá los 16 caracteres (se ven una sola vez).
3. Cargá `SMTP_USER` (la casilla) y `SMTP_PASS` (los 16 caracteres) en Vercel y redeployá.

- Si cambian la contraseña de la cuenta, Google **revoca** las contraseñas de aplicación. El síntoma es el
  aviso "La casilla rechazó el usuario o la contraseña de aplicación" en Alertas.
- Gmail permite unos 500 mails por día desde una cuenta común: sobra para avisos de recambio.
- Para un remitente con dominio propio se cambia a un proveedor transaccional con SMTP (Resend, Postmark,
  SendGrid): se cambian las variables, no el código.

## 8. Orden de migración y deploy

El caso concreto que motivó la regla es la `0007`:

1. **Aplicar la migración** en Supabase.
2. **Desplegar la aplicación inmediatamente después** (push a `main`).
3. **Entre 1 y 2, no editar roles** desde `/usuarios`. La aplicación vieja no conoce los permisos nuevos y, al
   guardar un rol, los descarta: un Responsable comercial perdería `clientes.ver_todos` sin aviso.

Qué cambia en la aplicación vieja con la base nueva (y por qué es compatible): las altas de empresas,
contactos, oportunidades y bitácora siguen funcionando porque todo lo nuevo tiene valor por defecto o lo
completa un trigger, y mover una tarjeta con `update` de `etapa_id` también (la app de F2 usa la RPC `cambiar_etapa`). Lo que cambia a propósito: soltar
una oportunidad en "Perdida" sin motivo da error en la app vieja (la actual pide el motivo), reabrir exige permiso, asignar a otro exige permiso y las
oportunidades ya no se borran.

## 9. Lista de verificación posterior al deploy

- [ ] `https://<dominio>/` muestra la landing y el botón lleva a `/login`.
- [ ] Un ingreso con una cuenta de demostración llega al tablero.
- [ ] La cuenta Vendedor ve 4 de las 8 empresas; la Administrador ve las 8 (según el comentario de
      verificación del seed).
- [ ] El superadmin entra a `/admin` y no ve ningún dato comercial.
- [ ] Una invitación desde `/usuarios` llega por mail; el link abre `/definir-clave` en el dominio correcto.
- [ ] Una alerta se puede enviar por mail (con `SMTP_*`) y queda registrada.
- [ ] `0005_permisos.sql` y `0007_reglas.sql` devuelven `TODO OK`.
- [ ] El tablero de Vercel muestra el último commit de `main` como deploy de producción.
- [ ] "Allow new users to sign up" está desactivado.
- [ ] Ninguna clave aparece en el repositorio ni en variables con prefijo `NEXT_PUBLIC_` (salvo la URL y la
      clave anon).

## 10. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Falta configurar SUPABASE_SERVICE_ROLE_KEY" en `/usuarios` o `/admin` | Variable ausente en Vercel | Cargarla y redeployar |
| "La casilla rechazó el usuario o la contraseña de aplicación" | Contraseña de aplicación inválida o revocada | Generar una nueva y actualizar `SMTP_PASS` |
| Los links de los mails apuntan a `localhost` o a un dominio de preview | Falta `SITE_URL` | Definirla con el dominio de producción |
| La `0004` aborta con "No existe un usuario con el email..." | El email de la línea `>>>` no existe en Authentication | Crear la cuenta o corregir la línea |
| Un rol guardado pierde permisos nuevos | Se editó con la aplicación anterior a la 0007 | Desplegar y volver a asignar los permisos |
| El test SQL devuelve `FALLA:` | Una regla o permiso no se cumple | El mensaje dice qué se pudo hacer que no se debía; ver [pruebas](./pruebas.md) |
| Un usuario nuevo no puede ingresar | Cuenta sin activar | Reenviar la invitación desde `/usuarios`; al intentar ingresar también se reenvía sola |
