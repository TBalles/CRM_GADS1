# Seguridad

El modelo de seguridad tal como está construido, sus límites conocidos y cómo se prueba. Para reportar una
vulnerabilidad, ver [SECURITY.md](../SECURITY.md).

**Principio.** La base de datos es la autoridad. Cada política de Row Level Security (RLS) pide dos cosas: que
la fila sea de la organización del usuario y que su rol tenga el permiso. La aplicación esconde lo que el rol
no puede usar, pero eso es comodidad, no protección. Si una pantalla fallara, la base seguiría negando.

Contenido: [1. Modelo](#1-modelo-de-amenazas-y-controles) · [2. Capas](#2-capas-de-defensa) ·
[3. Secretos](#3-secretos-y-claves) · [4. Mails y cuentas](#4-mails-y-cuentas) ·
[5. Storage y logo](#5-storage-y-logo) · [6. Límites conocidos](#6-límites-conocidos) ·
[7. Cómo se prueba](#7-cómo-se-prueba) · [8. Lista de verificación](#8-lista-de-verificación-de-despliegue)

---

## 1. Modelo de amenazas y controles

| Amenaza | Control | Dónde | Prueba |
|---|---|---|---|
| Un cliente (organización) ve o toca datos de otro | RLS por `organizacion_id = org_actual()` en todas las tablas; `organizacion_id` con `default org_actual()` y `with check` | `0004`, `0005`, `0007` | `0005_permisos.sql` |
| Colgar un registro propio de uno ajeno conociendo su id | Claves foráneas compuestas `(organizacion_id, id)` | `0004` | `0005_permisos.sql` (contacto a empresa de B, venta de producto de B) |
| Un usuario se otorga permisos o cambia de organización | `perfiles` sin políticas de escritura; `roles` solo editables con `usuarios.gestionar` y nunca el Administrador | `0004`, `0005` | `0005_permisos.sql` |
| Un usuario elige su organización o rol al registrarse | Se lee de `raw_app_meta_data` (solo el servidor la escribe), no de `raw_user_meta_data` | `handle_new_user()` | `0005_permisos.sql` ("colado") |
| Un rol usa permisos que no existen | CHECK `roles_permisos_validos` | `0007` | `0005_permisos.sql`, `permisos.check.ts` |
| Un vendedor ve la cartera de otro | RLS de cartera propia (`clientes.ver_todos` o ser el responsable) | `0007` | `0007_reglas.sql` |
| Un vendedor se asigna o reasigna sin permiso | Trigger `validar_responsable` | `0007` | `0007_reglas.sql` |
| Un vendedor cuelga una actividad en un cliente ajeno | `with check` de la política "crear" de `bitacora_entradas` | `0007` | `0007_reglas.sql` |
| Cerrar mal una oportunidad, reabrirla sin autorización o editarla sin dejar rastro | Triggers `oportunidades_reglas` y `oportunidades_auditar_cerrada` | `0007` | `0007_reglas.sql` |
| Borrar oportunidades con historial | Sin política de borrar; FK `no action` | `0007` | `0007_reglas.sql` |
| Un usuario dado de baja o una organización suspendida siguen operando | `org_actual()` y `tiene_permiso()` devuelven nulo y falso | `0004`, `0005` | `0005_permisos.sql` |
| El superadmin lee datos comerciales | No pertenece a ninguna organización | `0006` | `0005_permisos.sql` |
| Visitante sin sesión | `anon` no tiene políticas; el proxy exige login | RLS, `proxy.ts` | `0005_permisos.sql`, `0007_reglas.sql` |
| Relay abierto de mails desde la acción de alertas | La acción solo recibe el id del ítem y deriva destinatario y texto de la base; verifica `alertas.enviar` | `alertas/actions.ts` | Revisión de código |
| Bombardeo de una casilla ajena con mails de cuenta | Límite de 1 por minuto y 5 por hora, atómico con lock | `registrar_envio_auth()` | `0005_permisos.sql` (no invocable por usuarios) |
| Envenenamiento del link de recuperación (`Host` falso) | Los links se arman con `SITE_URL`, no con el `Host` del pedido | `origenPublico()` | Revisión de código |
| Open redirect vía `next` | Solo rutas internas; se descartan `//` y `/\` | `auth/confirm/route.ts` | Revisión de código |
| Enumerar qué emails tienen cuenta o invitación | Mensaje idéntico en login y en recuperar | `login/actions.ts`, `recuperar/actions.ts` | Revisión de código |
| Inyección de HTML en los mails | `esc()` en todo texto interpolado; `urlSegura()` solo deja `http(s)` y `mailto` | `src/lib/email/layout.ts` | `layout.check.ts` |
| Script en un logo subido | SVG rechazado: tipos MIME y extensiones permitidas, ruta validada | `0007`, bucket `logos` | `0007_reglas.sql` |
| La clave de servicio llega al navegador | `import "server-only"` en `admin.ts`; sin prefijo `NEXT_PUBLIC_` | `src/lib/supabase/admin.ts` | El build falla si se importa desde el cliente |
| El administrador de un cliente renombra o suspende su organización | Trigger `organizaciones_proteger_plataforma` | `0007` | `0007_reglas.sql` |

---

## 2. Capas de defensa

```text
Navegador  →  proxy.ts (sesión)  →  layout (superadmin / baja / suspensión)
           →  exigirPermiso() en la página  →  RLS en la base (organización + permiso + cartera)
```

1. **Proxy** (`src/proxy.ts`, lógica en `src/lib/supabase/middleware.ts`): refresca la sesión con
   `supabase.auth.getUser()` (que valida el token con el servidor de Auth, no solo lo decodifica) y redirige
   a `/login` si no hay usuario. Públicas: `/` (igualdad exacta), `/login`, `/recuperar`, `/auth/confirm`.
2. **Layouts**: separan al superadmin (`/admin`) del CRM, y muestran "Sin acceso" si el usuario está dado de
   baja o su organización suspendida.
3. **Páginas**: `exigirPermiso(permiso)` lleva a la primera pantalla permitida si falta el permiso.
4. **Server Actions**: empiezan por `getSesion()` y verifican el permiso. Validan tipo, forma y largo de sus
   argumentos, porque llegan del navegador. Las acciones sobre usuarios verifican además que el usuario o rol
   destino sea de la misma organización (el id se puede falsificar).
5. **Base de datos**: es la barrera final y la única que no depende del código de la aplicación.

Las Server Actions de Next.js comparan además el encabezado `Origin` con `Host` y abortan si no coinciden
(comportamiento del framework, descrito en `node_modules/next/dist/docs/01-app/02-guides/data-security.md`;
no hay configuración propia en este repositorio).

### Cómo se calculan los permisos

- `org_actual()`, `es_superadmin()` y `tiene_permiso()` son `SECURITY DEFINER` con `search_path = public`,
  para poder leer `perfiles` y `roles` sin entrar en recursión de RLS.
- Las políticas las llaman como `(select public.org_actual())` para que Postgres las evalúe una vez por
  consulta y no una vez por fila.
- Las vistas son `security_invoker = on`: sin eso, una vista saltea la RLS de las tablas que lee.
- Los triggers que escriben en tablas sin política de escritura (historial, auditoría) son `SECURITY DEFINER`.

---

## 3. Secretos y claves

| Variable | Sensibilidad | Dónde se usa | Regla |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública por diseño | Navegador y servidor | La clave anon es segura de exponer **porque** el control real lo hace la RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta, saltea toda la RLS** | Solo servidor (`admin.ts`) | Nunca con prefijo `NEXT_PUBLIC_`. Se usa solo después de verificar permisos |
| `SMTP_USER`, `SMTP_PASS` | **Secreta** | Solo servidor | Con Gmail, `SMTP_PASS` es una contraseña de aplicación, no la de la cuenta |
| `SITE_URL` | Pública | Servidor | Define el origen de los links de los mails |

- `.env` y `.env.local` están en `.gitignore`; no se commitean. La lista completa de variables está en
  [deploy](./deploy.md).
- Ante una filtración de la clave de servicio o de la contraseña SMTP: rotarla en Supabase o Google,
  actualizarla en Vercel y volver a desplegar.
- Si cambian la contraseña de la cuenta de Gmail, Google revoca las contraseñas de aplicación: hay que
  generar una nueva.

---

## 4. Mails y cuentas

- **Sin registro público.** Los usuarios los crea el superadmin o un administrador. Conviene además
  desactivar "Allow new users to sign up" en Supabase (Authentication, Sign In / Providers, Email), como
  segunda barrera.
- **Supabase no envía ningún mail.** El alta usa `auth.admin.createUser` (que no envía) y los links se
  generan con `auth.admin.generateLink` (que tampoco). La aplicación arma un link propio a `/auth/confirm`
  con el `hashed_token`, que el servidor canjea con `verifyOtp`. Ese flujo no usa los redirects de Supabase.
- **El link es de un solo uso.** Un segundo clic cae en el error y se puede pedir otro.
- **Baja doble.** `perfiles.activo = false` corta el acceso a los datos al instante (la base lo mira en cada
  consulta) y `ban_duration` en Auth impide iniciar sesión de nuevo.
- **Cuenta activada = contraseña definida.** No alcanza con tocar el link: `activado_at` se marca recién al
  elegir contraseña.
- **Contraseña.** Mínimo 8 caracteres en la aplicación; Supabase aplica además sus propias reglas
  (`weak_password`).

---

## 5. Storage y logo

- Bucket `logos` **privado**, solo `image/png`, `image/jpeg`, `image/webp`, hasta 1 MB.
- Ruta `{organizacion_id}/logo.{ext}` validada con expresión regular en la política de inserción y de
  actualización. Un usuario no puede escribir fuera de la carpeta de su organización ni mover su archivo a la
  de otra.
- **Se rechaza SVG a propósito**: un SVG subido por un usuario puede contener scripts.
- Lo ve cualquiera de la organización; lo escribe `configuracion.gestionar`. Se sirve por URL firmada
  (planificado en F1; hoy no hay interfaz).
- Las pruebas SQL no pueden hacer `DELETE` sobre `storage.objects` (Supabase lo prohíbe con el trigger
  `storage.protect_delete`); verifican la definición de la política de borrado en `pg_policies`.

---

## 6. Límites conocidos

Lo que hoy no está cubierto o se cubre solo en parte. Se listan porque conocerlos es parte del modelo.

| # | Límite | Impacto | Qué haría falta |
|---|---|---|---|
| 1 | *Cerrado por la `0008`* (pendiente de aplicar en Supabase): se quitaron las políticas `borrar` de `empresas` y `contactos`; un `DELETE` de un usuario afecta 0 filas. Hasta que se aplique, una llamada directa a la API de quien tiene `clientes.editar` podría borrar una empresa y arrastrar sus ventas y bitácora (`on delete cascade`) | Con la `0008` aplicada, la baja lógica es una garantía de la base | Aplicar `0008_baja_logica.sql` y correr `tests/0008_baja_logica.sql` |
| 2 | `next.config.ts` no define cabeceras de seguridad (CSP, `X-Frame-Options`, etc.) | Sin defensa en profundidad contra XSS y clickjacking a nivel de cabeceras | Agregar `headers()` en la configuración |
| 3 | La aplicación no limita los intentos de login; depende de los límites de Supabase Auth (no verificados en este repositorio) | Fuerza bruta sobre contraseñas | Confirmar los límites de Auth o agregar un control propio |
| 4 | La contraseña de las cuentas de demostración es pública (está en `supabase/seeds/demo_catedra.sql`) | Si el seed está cargado en el proyecto de producción, esas cuentas existen ahí. Solo dan acceso a la organización de demostración | Rotar o desactivar las cuentas al terminar la cátedra |
| 5 | `src/lib/supabase/types.ts` no refleja el esquema de la 0007 | No es un riesgo de seguridad, pero el tipado no protege las columnas nuevas | Regenerar el archivo |
| 6 | La creación de una venta no es transaccional (cabecera e ítems en dos pedidos) | Puede quedar una venta vacía si falla el segundo | Una función RPC |
| 7 | No se ejecutó `npm audit` | Dependencias sin revisar | Ejecutarlo y revisar |
| 8 | Cuando falta el SMTP, el administrador ve el link de activación en pantalla | Aceptado: quien lo ve es un administrador verificado de la misma organización | — |
| 9 | Sin autenticación de dos factores ni política de contraseñas propia | Cuentas protegidas solo por contraseña | Configurar MFA en Supabase |

---

## 7. Cómo se prueba

Detalle en [pruebas](./pruebas.md). Lo relevante para seguridad:

| Prueba | Qué demuestra |
|---|---|
| `supabase/tests/0005_permisos.sql` | Aislamiento entre organizaciones; que `user_metadata` no otorga organización; roles de otra organización; escalada de privilegios; bajas; superadmin sin datos comerciales; visitante sin sesión |
| `supabase/tests/0007_reglas.sql` | Cartera propia; asignación con permiso; reglas de cierre, historial y auditoría; catálogos; logo; aislamiento de las tablas nuevas. Los negativos verifican código y mensaje del error |
| `src/lib/email/layout.check.ts` | El contenido dinámico no inyecta HTML; `javascript:` no llega a un `href`; el logo es por CID |
| `src/lib/permisos.check.ts` | El catálogo de permisos de la aplicación coincide con el CHECK de la base |

Las pruebas SQL se hacen pasar por cada usuario como lo hace la aplicación (rol `authenticated` con un JWT
del usuario) y terminan en `ROLLBACK`: no dejan nada en la base.

---

## 8. Lista de verificación de despliegue

- [ ] `SUPABASE_SERVICE_ROLE_KEY` cargada solo en Vercel, sin prefijo `NEXT_PUBLIC_`.
- [ ] "Allow new users to sign up" desactivado en Supabase.
- [ ] Migraciones `0001` a `0007` aplicadas en orden; `0005_permisos.sql` y `0007_reglas.sql` devuelven `TODO OK`.
- [ ] `SITE_URL` configurada con el dominio de producción.
- [ ] `SMTP_PASS` es una contraseña de aplicación de Google.
- [ ] El email de superadmin de la `0004` es una cuenta real del equipo.
- [ ] Decidido qué hacer con las cuentas de demostración.
- [ ] `.env` y `.env.local` fuera del repositorio.
