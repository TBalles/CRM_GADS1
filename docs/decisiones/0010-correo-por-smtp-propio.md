# 0010. Todos los mails por SMTP propio

- **Estado:** Aceptada
- **Fecha:** 2026-09-18 (commits `b9b2fe9` y `2908420`)

## Contexto

La aplicación envía tres tipos de mails: avisos de recambio, activación de cuentas y recuperación de
contraseña. Se evaluaron dos puntos de partida:

- El mailer de Supabase Auth manda poquísimos mails por hora en el plan gratuito y con su propio diseño.
- Las APIs de proveedores transaccionales como Resend exigen un dominio propio verificado. La casilla de la
  marca es un Gmail, y gmail.com no es de nadie del equipo. Con un Gmail, SMTP con una contraseña de
  aplicación de Google es la única opción.

La primera versión de las alertas usaba la API de Resend (`a72f794`); se reemplazó por SMTP (`b9b2fe9`).

## Decisión

- **Supabase no envía ningún mail.** El alta usa `auth.admin.createUser` y los links se generan con
  `auth.admin.generateLink`, que tampoco envían. El link a `/auth/confirm` se arma con el `hashed_token` y lo
  canjea el servidor con `verifyOtp`. Es el flujo recomendado para SSR y apunta al dominio propio.
- Un **único punto de salida**: `src/lib/email/enviar.ts`, con `nodemailer`. Por defecto `smtp.gmail.com:465`;
  `SMTP_HOST`, `SMTP_PORT` y `ALERTAS_FROM_EMAIL` lo cambian sin tocar código.
- Los mails son HTML con el diseño de la marca, el logo incrustado por CID y todo texto interpolado escapado
  (`src/lib/email/layout.ts`), con versión en texto plano.
- Los links se construyen con `SITE_URL` (o el dominio de Vercel), **nunca con el encabezado `Host`**, para
  evitar el envenenamiento del link de recuperación.
- Límite por casilla: 1 mail por minuto y 5 por hora de cada tipo, atómico (`registrar_envio_auth()` con
  lock), porque activación y recuperación se piden desde pantallas públicas.
- Sin `SMTP_USER` y `SMTP_PASS` la aplicación sigue funcionando: las alertas abren `mailto:` y las
  invitaciones devuelven el link para que el administrador lo comparta a mano.

## Consecuencias

- Gmail limita a unos 500 mails por día desde una cuenta común: alcanza para avisos de recambio.
- Si cambian la contraseña de la cuenta de Gmail, Google revoca las contraseñas de aplicación: hay que generar
  una nueva y actualizar `SMTP_PASS`. La aplicación muestra un aviso específico para ese error (`EAUTH`).
- Pasar a un dominio propio es cambiar variables de entorno: Resend, Postmark y SendGrid también exponen SMTP.
- La entrega depende de la reputación de la cuenta de Gmail y de que Google no la bloquee; no hay seguimiento
  de rebotes.
- Mails y alertas son iniciados por una persona; no hay envío automático ni cola.
