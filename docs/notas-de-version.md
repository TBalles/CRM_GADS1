# Notas de la versión: entrega final (1.0.0)

Estas notas cuentan todo lo que se agregó al proyecto desde la primera versión funcional hasta la entrega final
(versión 1.0.0, 2026-10-04), organizado por área. Cada punto dice qué hace, dónde vive, qué regla de
negocio aplica, cómo verlo o probarlo y en qué commit entró.

> **Cómo leer el estado de cada punto.** Todo el documento distingue tres estados y los nombra siempre
> igual:
>
> | Estado | Significado |
> |---|---|
> | **Implementado** | Funciona en la aplicación y en la base, y está en producción. |
> | **Base lista, sin interfaz** | La base de datos ya lo aplica (migración `0007` aplicada en Supabase el 2026-10-04), pero la pantalla todavía no lo muestra ni lo permite usar. |
> | **Planificado** | No existe ni en la base ni en la interfaz. Figura en el plan con su fase y fecha. |

Contenido: [a. Resumen](#a-resumen-en-una-pantalla) ·
[b. Qué cambió, por área](#b-qué-cambió-desde-la-primera-entrega-por-área) ·
[c. Base de datos de la entrega final](#c-la-base-de-datos-de-la-entrega-final-migración-0007) ·
[d. Cambios que alteran el comportamiento](#d-cambios-que-alteran-el-comportamiento) ·
[e. Estado frente a la consigna](#e-estado-frente-a-la-consigna) ·
[f. Seguridad](#f-seguridad-de-esta-versión) ·
[g. Pendiente y próximos pasos](#g-pendiente-y-próximos-pasos) ·
[h. Apéndices](#h-apéndices)

---

## a. Resumen en una pantalla

**Qué es.** Tuco & Nito es un CRM multitenant para proveedores y distribuidores de equipamiento
deportivo (arcos, redes, conos, pecheras, pelotas) que venden a clubes, complejos, escuelas de fútbol,
colegios y predios municipales. Es un trabajo práctico de la UNLaM (Gestión Aplicada al Desarrollo de
Software II); la entrega final es el 2026-11-12. Lo que lo distingue de un CRM genérico es el ciclo del
recambio: cada producto tiene una vida útil, cada venta la congela, y una vista calcula qué equipos
vencieron o vencen en 60 días para avisar al cliente.

**Dónde está hoy.** Todas las fases (F0 a F8) están hechas y en `main`. El CRM cumple la consigna en la interfaz y en
la base; lo que **falta es de operación, no de código**: aplicar a mano en Supabase las migraciones `0008` a `0012` (hay un
kit de un solo archivo, [`supabase/aplicar/`](../supabase/aplicar/LEEME.md)) y, con eso, regenerar el manual para que se
completen sus figuras pendientes. Hasta entonces la aplicación esconde las secciones que dependen de esas migraciones
(canchas, licitaciones, recambio en un clic, numeración de presupuestos) y anda igual.

**Números, calculados del repositorio al cerrar la 1.0.0.**

| Medida | Valor | Cómo se obtiene |
|---|---|---|
| Commits en `main` | 54 | `git log --oneline` |
| Migraciones SQL | 12 (`0001` a `0012`); la base viva tiene hasta la `0007` | `supabase/migrations/` |
| Kit de migraciones | 1 archivo (`0008` a `0012`, 895 líneas, verificado en PGlite) | `supabase/aplicar/` |
| Seeds | 3 (`demo_catedra.sql`, `demo_rubro.sql`, `e2e_tests.sql`) | `supabase/seeds/` |
| Scripts de prueba SQL | 7 (`0005_permisos`, `0007_reglas`, `0007_reejecucion`, `0008`, `0009`, `0011`, `0012`) | `supabase/tests/` |
| Tablas en `public` | 18 con la `0007`; 20 con la `0011` (canchas, licitaciones); 22 con la `0012` (presupuestos y su contador); más la vista `alertas_vida_util` y el bucket `logos` | migraciones |
| Permisos del catálogo | 19, en 8 grupos; 4 roles por defecto | `src/lib/permisos.ts` |
| Páginas (`page.tsx`) | 21 (incluye la landing, el acceso y `/admin`); `next build` lista 25 rutas (esas 21, 2 route handlers, `/_not-found` e `/icon.svg`) | `src/app` |
| Route handlers | 2 (`/auth/confirm`, `/auth/signout`) | `src/app/auth` |
| Server Actions (archivos) | 8 | `src/**/actions.ts` |
| Self-checks (`node --test`) | 25 archivos, 243 pruebas, todas pasan | `npm test`, ver [pruebas](./pruebas.md) |
| E2E (Playwright) | 14 pruebas en 3 archivos; escritas, **sin ejecutar completas** | `e2e/` |
| Verificación estática | `tsc --noEmit` (src y e2e), `eslint --max-warnings=0` y `next build` pasan | `npm run typecheck`, `npm run lint`, `npx next build` |
| Manual de usuario | PDF A4 de 89 páginas (22 capítulos y 3 apéndices), 7,2 MB; 53 figuras con captura y 10 pendientes | `docs/Manual-de-usuario-Tuco-y-Nito.pdf` |

---

## b. Qué cambió desde la primera entrega, por área

La primera versión funcional (2026-09-17) tenía login, empresas con contactos anidados, oportunidades y
un embudo. Todo lo que sigue se agregó después. Las áreas están ordenadas de lo que el usuario toca
primero a lo que sostiene el sistema.

### b.1 Acceso y cuentas

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/login/`, `src/app/recuperar/`, `src/app/definir-clave/`, `src/app/auth/confirm/route.ts`, `src/lib/cuentas.ts`, `src/lib/email/` |
| Commits | `2908420` (cuentas), `b9b2fe9` (SMTP propio), `4461b5f` (login rediseñado) |

**Qué hace.**

- **No hay registro público.** Los usuarios los crean el superadmin (el primer administrador de cada
  cliente) o un administrador del cliente desde `/usuarios`. Se recomienda además desactivar
  "Allow new users to sign up" en Supabase (ver [deploy](./deploy.md)).
- **Invitación.** `crearUsuario()` crea la cuenta con la API de administración de Supabase, sin enviar
  nada, y guarda la organización y el rol en `app_metadata` (que solo escribe el servidor). Después
  manda por SMTP propio un mail de activación con un link de un solo uso.
- **Activación.** El link apunta a `/auth/confirm`, que canjea el token con `verifyOtp` y abre sesión;
  de ahí se pasa a `/definir-clave`, donde la persona elige su contraseña (mínimo 8 caracteres). Recién
  ahí se marca `perfiles.activado_at`. Mientras esa columna es nula, la invitación figura como pendiente.
- **Recuperación de contraseña.** `/recuperar` responde siempre lo mismo, exista o no la cuenta, para no
  revelar qué emails están registrados. Si la cuenta nunca se activó, en lugar de recuperación se
  reenvía la activación.
- **Reenvío automático.** Si alguien con una invitación pendiente intenta ingresar en `/login`, falla
  (no tiene contraseña) y el servidor le reenvía la activación en silencio. El mensaje de error es el
  mismo en todos los fallos.
- **Límite de envíos.** Un mail de cada tipo por minuto y cinco por hora por casilla, controlado por
  la función `registrar_envio_auth()` con un lock en la base (sin condiciones de carrera).
- **SMTP propio.** Ningún mail sale por Supabase. `src/lib/email/enviar.ts` es el único punto de salida
  (nodemailer; por defecto Gmail en el puerto 465). Los mails son HTML con el logo incrustado por CID,
  y todo texto interpolado se escapa (`src/lib/email/layout.ts`, con self-check).
- **Baja de usuarios.** `perfiles.activo = false` corta el acceso a los datos en la siguiente consulta
  (la base lo mira en cada `org_actual()`), y además se aplica un ban en Auth. Un usuario dado de baja
  o de una organización suspendida ve la pantalla "Sin acceso".
- **Pantallas de carga.** Hay un `loading.tsx` por módulo y un overlay para las acciones de fila.

**Regla de negocio.** Cualquier fallo de ingreso muestra el mismo mensaje; las cuentas no se pueden
enumerar. Los links se construyen con `SITE_URL`, nunca con el encabezado `Host` del pedido.

**Cómo probarlo.** Desde la cuenta Administrador del seed, en `/usuarios` → "Invitar usuario". Sin
SMTP configurado, la pantalla muestra el link de activación para compartirlo a mano (solo a un
administrador verificado; en el login público ese link se descarta a propósito).

### b.2 Empresas y contactos

| Aspecto | Detalle |
|---|---|
| Estado | Alta, edición, búsqueda y contactos anidados: **implementado**. Estado, responsable, origen, tipo de cliente, sitio web y documento: **base lista, sin interfaz** |
| Dónde | `src/app/(app)/empresas/` (`EmpresasList.tsx`, `EmpresaForm.tsx`, `ContactoForm.tsx`) |
| Commits | `65d5b4a`, `6a15472` (restyle), `de6b9cd` (contactos acotados a la empresa elegida en oportunidades); base: `a5c0135` |

**Qué hace hoy.**

- `/empresas` lista las empresas como acordeón; al desplegar una se ven sus contactos, con alta y edición
  en un panel lateral (`Drawer`). Busca por nombre, CUIT, mail, teléfono o dirección de la empresa, y por nombre, apellido, mail o cargo de sus contactos.
- **F1b: implementado.** `/empresas` y `/contactos` son listas con filtros (estado, responsable si el rol
  tiene `clientes.ver_todos`, origen, empresa o individual) y un chip "Ver dadas de baja": las empresas y
  contactos `inactivo` o `no_contactar` quedan escondidos hasta pedirlos. Cada nombre es un link a su
  ficha: `/empresas/[id]` (datos, contactos con alta y edición, oportunidades, ventas y línea de tiempo de
  actividades) y `/contactos/[id]` (datos, empresa, oportunidades, ventas y actividades). Un id inexistente,
  o de la cartera de otro vendedor (la RLS lo esconde), da 404.
- Campos que edita la interfaz: empresa (razón social, CUIT con dígito verificador solo si cambió, tipo de
  cliente, teléfono, email, dirección, sitio web, estado, origen, responsable, observaciones) y contacto
  (nombre, apellido, documento, cargo, empresa opcional, email, teléfono, estado, origen, responsable,
  observaciones). El responsable se elige solo con `clientes.asignar`; sin él se muestra de solo lectura y
  el alta queda a nombre de quien la crea (lo garantiza el trigger).
- **Baja lógica, sin borrar:** "Dar de baja" (`estado = 'inactivo'`, con confirmación) y "Reactivar"
  (vuelve a `potencial`). La interfaz no ofrece borrar empresas ni contactos.
- Si el cliente está en `no_contactar`, la ficha y el formulario de actividad muestran un aviso (no
  bloquean). El formulario de oportunidad también avisa (F2); el de ventas todavía no.

**Qué agregó la base (migración 0007); la interfaz la usa desde F1b.**

- `estado` en empresas y contactos: `potencial`, `cliente`, `inactivo`, `no_contactar`. La baja lógica es
  pasar a `inactivo`.
- `responsable_id` (la cartera), `origen_id` (catálogo de orígenes), `tipo_cliente` en empresas (club,
  complejo_f5, escuela_futbol, predio_municipal, colegio, otro; es la "industria o actividad" del rubro),
  `sitio_web` y `documento` en contactos.
- Un contacto puede existir sin empresa (cliente individual).

**Regla de negocio.** Una empresa o contacto nuevo queda asignado a quien lo crea (trigger
`validar_responsable`). Asignar a otro o reasignar exige `clientes.asignar`. El responsable tiene que
ser del mismo cliente (organización).

**Lo que hay que saber.**

- Toda empresa o contacto creado hoy desde la interfaz queda con estado `potencial`, porque el formulario
  no envía el campo.
- Los contactos sin empresa (clientes individuales) se listan en `/contactos` desde F1b.
- Las fichas de empresa y contacto existen desde F1b y desde F5 son una **ficha 360**: "Resumen de la cuenta" e
  "Historia de la cuenta" (ver [b.16](#b16-ficha-360-tablero-del-responsable-conversión-del-embudo-y-búsqueda-global-f5)).
  El título de cada oportunidad en la ficha lleva al detalle (`/oportunidades/[id]`, F2).
- **F3: implementado.** `/empresas` y `/contactos` buscan, filtran y paginan en el servidor (ver [b.14](#b14-búsqueda-filtros-y-paginación-en-el-servidor-f3)). La búsqueda de empresas alcanza razón social, CUIT, email, teléfono, dirección y los nombres, apellidos y mails de sus contactos; la de contactos, nombre y apellido (juntos o por separado), documento, email, teléfono, cargo y nombre de la empresa. Se agregan los filtros "tipo de cliente" (empresas) y "origen" (contactos).

**Cómo probarlo.** Cuenta Vendedor del seed: `/empresas` muestra 4 de las 8 empresas (su cartera). Con
la cuenta Administrador se ven las 8.

### b.3 Productos con vida útil

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/(app)/productos/`, tabla `productos` |
| Commits | `a72f794` (alta del módulo), `0c65a35` (pills de color), `aa0619c` (iconos y barra de vida útil) |

**Qué hace.** ABM del catálogo con nombre, descripción, marca, categoría, precio y **vida útil estimada
en meses**. Ese número es el dato del que sale todo el sistema de alertas. Un producto sin vida útil
(`null`) no genera seguimiento de recambio.

**Regla de negocio.** Un producto no se borra: se da de baja (`activo = false`). La clave foránea desde
`venta_items` es `on delete restrict`, así que el historial de ventas nunca se rompe. El nombre es único
por organización. Editar el catálogo requiere `productos.editar`.

**Cómo verlo.** `/productos`: cada producto muestra el ícono de su equipo y una barra de vida útil
relativa al resto del catálogo. El kit de mantenimiento del seed va sin vida útil a propósito.

### b.4 Ventas con snapshot de vida útil

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/(app)/ventas/`, tablas `ventas` y `venta_items`, función `venta_items_defaults()` |
| Commits | `a72f794`, `e58b5cd` (la fecha de entrega sigue a la fecha de venta) |

**Qué hace.** Registra el historial de compras: una cabecera por venta y un ítem por producto, cada uno
con cantidad, precio, **fecha de entrega propia** y **vida útil copiada del catálogo**.

**Regla de negocio.** La vida útil se **copia** del producto al insertar el ítem (trigger
`set_venta_items_defaults`), no se lee por join. Si mañana el catálogo cambia la vida útil de un arco de
24 a 36 meses, lo ya entregado sigue venciendo con lo que se prometió. La fecha de entrega, si no viene,
hereda la de la venta. El reloj arranca con la entrega, no con la factura. Ver
[reglas de negocio](./reglas-de-negocio.md) y la [decisión 0003](./decisiones/0003-vida-util-snapshot-en-venta-items.md).

**Cómo probarlo.** `/ventas` → nueva venta con un producto con vida útil; el aviso confirma que
"arrancó el reloj del recambio". Si la venta no tiene ningún producto con vida útil, el aviso no lo dice.

**Límite conocido.** Cabecera e ítems se insertan en dos pedidos; no es una transacción. Si fallan los
ítems, la pantalla intenta borrar la cabecera y, si eso también falla, avisa que quedó una venta vacía
para borrar a mano (`VentaForm.tsx`).

### b.5 Alertas de recambio

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/(app)/alertas/`, vista `alertas_vida_util`, tabla `alertas_enviadas` |
| Commits | `a72f794`, `b9b2fe9` (SMTP), `2908420` (mail HTML), `51428ca` (reloj del recambio), `aa0619c` (tablero) |

**Qué hace.** Lista los equipos entregados que **vencieron o vencen en los próximos 60 días**, con KPIs,
filtros (todas, vencidas, por vencer, sin avisar), búsqueda y un "reloj" por alerta (barra de la entrega
al vencimiento con la ventana de 60 días marcada). Desde cada alerta se puede avisar por:

- **Mail.** Con `SMTP_USER` y `SMTP_PASS` cargadas, sale del servidor desde la casilla de la marca. Sin
  ellas, abre el cliente de correo del usuario con el mensaje armado (`mailto:`) y registra el envío igual.
- **WhatsApp.** Abre `wa.me` con el mensaje armado; la aplicación solo registra el envío.

**Regla de negocio.**

- La vista calcula en vivo: no hay cron ni tabla de pendientes. Solo se guarda lo enviado
  (`alertas_enviadas`), que sirve para mostrar el último aviso de cada ítem.
- Es una vista `security_invoker`: respeta la RLS de quien consulta (desde la 0007, un Vendedor solo ve
  las alertas de su cartera).
- La acción de servidor **no acepta destinatario ni texto del navegador**: recibe solo el id del ítem y
  deriva todo de la fila de la vista. Así no se puede usar como relay abierto de mails.
- El permiso `alertas.enviar` se verifica antes de enviar.
- Los mensajes son funciones puras (`plantillas.ts`) con self-check; el verbo concuerda con la
  cantidad ("la unidad superó", "las 2 unidades superaron").
- El envío lo confirma siempre una persona. No hay envío automático (es una decisión de producto, ver el
  FAQ de la landing).

**Cómo verlo.** Cuenta Administrador del seed: según el comentario de verificación del seed, hay 5
alertas pendientes (3 vencidas y 2 por vencer) y 3 envíos ya registrados.

### b.6 Tablero (inicio)

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/(app)/dashboard/page.tsx`, `charts.tsx` |
| Commits | `ffc4d9e`, `bfa9c1a`, `aa0619c`, `5e6a95c`, `dd50fe7` |

**Qué hace.** Cifra principal "en juego" (suma de montos), tira de conteos (empresas, contactos,
oportunidades), distribución del embudo, oportunidades por etapa, ranking de empresas por valor en juego,
tarjeta "Recambios que vienen" (solo con `alertas.ver`) y el ciclo "De la venta al recambio". Los gráficos
son CSS puro, sin librería (ver [decisión 0007](./decisiones/0007-graficos-en-css-sin-libreria.md)).

**Correcciones de esta versión.** El ranking de empresas mide la barra por monto y no por cantidad
(`5e6a95c`) y excluye oportunidades sin empresa (`dd50fe7`).

**Estado de las cifras.** "En juego", las oportunidades abiertas y el ranking de empresas cuentan solo las
abiertas (filtran por `estado`); el embudo de abajo sí muestra cada etapa con todo lo que tiene, cerradas
incluidas.

### b.7 Bitácora de clientes

| Aspecto | Detalle |
|---|---|
| Estado | **Implementado (F1b)** desde las fichas de empresa y de contacto: tipo de catálogo, fecha y hora, descripción, resultado, vínculo a oportunidad y cliente individual. Desde F2 también se registra desde el detalle de la oportunidad |
| Dónde | `src/components/ActividadForm.tsx` (alta reutilizable) y `src/components/ActividadesTimeline.tsx` (línea de tiempo); tabla `bitacora_entradas`. `BitacoraPanel.tsx` se eliminó |
| Commits | `a72f794`; base: `a5c0135` |

**Qué hace hoy.** En la ficha de la empresa y en la del contacto hay una línea de tiempo con las
actividades (más recientes primero: tipo con ícono, fecha y hora en horario argentino, quien la registró,
descripción, detalle, resultado y oportunidad) y el botón "Registrar actividad". El tipo sale del
catálogo de la organización (solo los activos), la fecha no puede ser futura (una actividad es un hecho
ya ocurrido) y el usuario lo completa la base. Es un log: se agrega y no se corrige el pasado (no hay
política de update ni delete).

**Qué agregó la 0007.**

- Tipo de actividad **de catálogo** (`tipos_actividad`, 12 por organización, de los cuales 9 son los que
  pide la consigna), vínculo opcional con una oportunidad, campo `resultado`, y la posibilidad de que la
  actividad sea solo de un contacto (cliente individual, sin empresa).
- El autor es siempre quien la registra: el trigger `bitacora_defaults` ignora un `autor_id` ajeno.
- Compatibilidad: el campo viejo `tipo` sigue existiendo; desde F1b la interfaz manda solo
  `tipo_actividad_id` y el trigger completa `tipo` (los códigos fuera de los 6 históricos quedan como `nota`).

**Regla de negocio.** Para escribir no alcanza con ver una referencia: la empresa, el contacto y la
oportunidad tienen que ser visibles para quien escribe y coherentes entre sí. Así un Vendedor no puede
colgar una actividad en el cliente de otro usando su propia oportunidad.

### b.8 Oportunidades y embudo

| Aspecto | Detalle |
|---|---|
| Estado | **Implementado (F2)**: alta y edición completas, tablero dinámico, lista con filtros, detalle, cierre ganada/perdida con motivo, reapertura, reasignación, historial de etapas y auditoría |
| Dónde | `src/app/(app)/oportunidades/` (`OportunidadesView.tsx`, `OportunidadForm.tsx`, `datos.ts`, `[id]/`), `src/components/CierreModal.tsx`, `src/components/oportunidades.tsx`, `src/lib/oportunidades.ts`, `src/lib/cambiarEtapa.ts` |
| Commits | `65d5b4a`, `9aa5e7d`, `95f5273`, `7e8f775` (arrastre), `de6b9cd`; base: `a5c0135` |

**Qué hace.**

- **Formulario** (Drawer): título, empresa o contacto (uno de los dos es obligatorio), producto, valor
  estimado, probabilidad (entero de 0 a 100, opcional), fecha estimada de cierre, origen (catálogo),
  responsable y observaciones. El responsable se elige solo con `oportunidades.asignar`; sin ese permiso
  se ve de solo lectura y el alta queda a nombre de quien la crea. En el alta la etapa es una de las
  abiertas; en la edición la etapa se muestra pero se cambia desde "Cambiar etapa" (así cada cambio deja
  su observación). **Estado, fecha real de cierre y motivo de pérdida no se editan a mano**: los fija la
  base al cambiar de etapa o cerrar. Un cliente "No contactar" muestra un aviso, no bloquea.
- **Tablero**: una columna por **etapa abierta** del cliente, en el orden de `/configuracion`, con scroll
  horizontal e imán en pantallas chicas. Solo oportunidades abiertas. Arrastrar una tarjeta llama a la RPC
  `cambiar_etapa` (nunca un `update`); el movimiento es optimista y, si la base lo rechaza, la tarjeta
  vuelve y un aviso dice por qué. Las etapas de cierre no son columnas: se cierra desde el menú de la
  tarjeta ("Marcar ganada" / "Marcar perdida"). "Cambiar etapa" del menú es también la alternativa en el
  móvil, donde el arrastre no anda, y permite dejar una observación.
- **Lista** (conmutador Tablero | Lista): filtros por estado (por defecto Abiertas), etapa, responsable
  (solo con `clientes.ver_todos`), origen y búsqueda. Las cerradas muestran el estado con texto, la fecha
  de cierre y, si es perdida, el motivo. **Desde F3** la búsqueda, los filtros y la paginación corren en el
  servidor (la lista pide solo la página que se ve) y el conmutador Tablero | Lista vive en la URL
  (`?vista=lista`). El tablero sigue mostrando solo las abiertas, hasta 500, con un aviso si hay más.
- **Cierre** (`CierreModal`): "Marcar ganada" (fecha de cierre, por defecto hoy y nunca futura;
  observación opcional), "Marcar perdida" (motivo del catálogo obligatorio, fecha, observación),
  "Reabrir" (con `oportunidades.reabrir`; vuelve a una etapa abierta a elección y pide la razón) y "Cambiar
  etapa". Si hay varias etapas del tipo ganada o perdida se elige una; si hay una sola, se usa esa.
- **Detalle** `/oportunidades/[id]`: cabecera (título, estado, etapa, valor, insignia de licitación),
  acciones (Registrar actividad, Cambiar etapa, Marcar ganada/perdida, Reabrir, Cambiar resultado, Reasignar,
  Editar según permisos), datos con links a la empresa y al contacto, **línea de tiempo unificada** (actividades y
  cambios de etapa con etapa anterior a nueva, usuario y observación, lo último arriba) y, si existe, la
  sección **"Cambios después del cierre"** con la auditoría (campo, antes y después). 404 si el id no
  existe o la RLS lo esconde (la oportunidad de otro Vendedor).
- Las fichas de empresa y de contacto enlazan cada oportunidad a su detalle.

**Reglas que la interfaz cumple y la base sigue exigiendo.**

| Acción en pantalla | Resultado |
|---|---|
| Arrastrar o mover a otra etapa abierta | Por `cambiar_etapa`; fila en el historial con el usuario |
| Marcar ganada | Estado y fecha de cierre los fija el trigger; la fecha elegida en el modal viaja a la RPC |
| Marcar perdida sin motivo | El modal no deja enviar ("Elegí el motivo de pérdida."); si llegara a la base, el trigger lo rechaza y la interfaz traduce el mensaje |
| Reabrir sin `oportunidades.reabrir` | El botón no se ofrece; por RPC la base responde 42501 y la interfaz lo traduce |
| Un Vendedor reasigna | El botón y el selector no se ofrecen; la base rechaza el cambio de responsable |
| Un rol con `oportunidades.asignar` sin `clientes.ver_todos` | No se puede armar: el catálogo de permisos exige `clientes.ver_todos` para asignar |
| Editar una oportunidad cerrada | Se puede y queda auditado; el formulario lo avisa |

**Cambiar el resultado.** Una cerrada con `oportunidades.reabrir` ofrece "Cambiar resultado" (ganada a
perdida y al revés) sin reabrirla: etapas del cierre contrario, motivo si va a perdida, fecha del nuevo cierre y
razón obligatoria. El modal rechaza repetir la fecha del cierre anterior (salvo que sea hoy), porque el trigger
la tomaría por "sin fecha" y la reemplazaría en silencio por la de hoy. En la línea de tiempo se lee
"Cambio de resultado"; las filas que escribió la 0007 al activar el historial se leen "Registro inicial".

**Migración 0009 (pendiente de aplicar a mano, junto con la 0008).** La base no imponía tres reglas que la
interfaz sí: fecha de cierre no futura (con fecha de Argentina), fecha por defecto de Argentina y empresa o
contacto obligatorio. La `0009_reglas_oportunidades.sql` las agrega (ver
[reglas de negocio](./reglas-de-negocio.md), 2.16 a 2.18) y la interfaz traduce esos errores y mantiene sus
propias validaciones. Mientras no se aplique, la base viva sigue aceptando una fecha de cierre futura y una
oportunidad sin cliente por la API.

**Otros límites conocidos.** La tabla de licitaciones y sus reglas son de F4 (migración `0011`, pendiente de aplicar): sin ella `licitacion` es solo una insignia. Las reaperturas también quedan en
"Cambios después del cierre", porque la base audita todo cambio de una oportunidad que estaba cerrada.

**Cómo verlo.** Cuenta Administrador: en `/oportunidades` arrastrá una tarjeta de "Negociación" a
"Presupuesto enviado", abrí su menú y elegí "Marcar perdida" con un motivo; entrá a su detalle, reabrila y
mirá el historial. Con la cuenta Vendedor comprobá que no ve "Reabrir" ni "Reasignar".

### b.9 Usuarios, roles y permisos

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/(app)/usuarios/`, `src/lib/permisos.ts`, `src/lib/sesion.ts`, tablas `roles` y `perfiles` |
| Commits | `2908420`, `a5c0135` |

**Qué hace.** `/usuarios` (permiso `usuarios.gestionar`) lista los usuarios del cliente y sus roles. Se
puede invitar, cambiar el rol, dar de baja y reactivar, reenviar la invitación, y crear, editar y borrar
roles propios. Cada rol es un conjunto de permisos tomados de un catálogo fijo (19, ver
[apéndice h.3](#h3-catálogo-de-permisos)).

**Regla de negocio.**

- La base exige el permiso en cada operación (RLS); ocultar un botón es solo comodidad.
- Al guardar un rol se agregan las dependencias de cada permiso (por ejemplo, para registrar ventas hace
  falta poder ver clientes y productos).
- El rol Administrador (`es_admin`) tiene todos los permisos y nadie puede editarlo ni borrarlo; no se
  puede crear un segundo rol con esa marca.
- Nadie cambia su propio rol, se da de baja ni le quita a su propio rol la gestión de usuarios.
- No se borra un rol asignado (clave foránea `restrict`).
- Los roles por defecto de cada cliente son **Administrador, Vendedor, Responsable comercial y Solo
  lectura** (en la segunda entrega eran Administrador, Ventas, Corporativo y Solo lectura).

**Límite.** Editar el nombre o el email de un usuario no está previsto; solo el rol y el estado.

### b.10 Multitenant y panel de plataforma (`/admin`)

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/admin/`, migraciones `0004` y `0006` |
| Commits | `2908420`, `ecef8bf` |

**Qué hace.** Cada cliente del CRM es una **organización**; la base aísla sus datos con RLS y con claves
foráneas compuestas `(organizacion_id, id)`. El **superadmin** opera la plataforma desde `/admin`: da de
alta clientes, cada uno con su primer Administrador y la invitación por mail, agrega administradores,
reenvía invitaciones y suspende o reactiva clientes.

**Regla de negocio.** Desde la migración `0006` el superadmin **no pertenece a ninguna organización**:
`org_actual()` le devuelve `null` y `tiene_permiso()` le devuelve `false`, así que no ve datos comerciales
de ningún cliente. El layout del CRM lo redirige a `/admin`. Un cliente suspendido corta el acceso de todos
sus usuarios en la siguiente consulta. Ver la [decisión 0009](./decisiones/0009-superadmin-sin-organizacion.md).

**Nota de alcance.** "Soporte para múltiples organizaciones" figura en la lista de **fuera de alcance** de
la consigna. Está construido de todos modos; ver [e](#e-estado-frente-a-la-consigna).

### b.11 Landing pública

| Aspecto | Detalle |
|---|---|
| Estado | Implementado |
| Dónde | `src/app/page.tsx`, `src/components/landing/`, `src/lib/contacto.ts` |
| Commits | `a72f794`, `74bbcce` (rediseño oscuro), `674e027` (partículas), `00860d5`, `e58b5cd` (links de mail abren Gmail) |

**Qué hace.** Página de marketing en `/`: presentación, funcionalidades, producto, cómo funciona,
nosotros, FAQ y contacto. Es siempre oscura, con un campo de partículas que arma el isotipo y formas
deportivas por sección, y un cursor con forma de pelota (solo con mouse). Los datos de contacto salen de
variables de entorno `CONTACTO_*` (`src/lib/contacto.ts`); si faltan, se ven placeholders visibles. Si
hay sesión, el botón cambia de "Ingresar" a "Ir al CRM". La estética se aparta a propósito del kit (ver
`docs/design-overrides.md`, divergencia 12).

### b.12 Identidad visual: cinco pases de diseño (2026-09-28)

| Estado | Implementado |
|---|---|
| Documentado en | `docs/design-overrides.md` (divergencias 13 a 15) y `design-system/tuco-y-nito/MASTER.md` |

El historial tiene cinco commits de diseño ese día (más dos correcciones). Ninguno cambia la
funcionalidad.

| # | Pase | Commit | Qué cambió |
|---|---|---|---|
| 1 | Tokens | `df44444` | Neutros con el tono de la marca, escala de radios y sombras tintadas, tipografía Plus Jakarta Sans en el CRM, primitivas rehechas (Card, Button, Input, Table, Pill), ítem activo del menú sin bloque verde. Arregla que los botones perdieran el cursor de mano en Tailwind v4 |
| 2 | Jerarquía y masthead | `bfa9c1a` | `PageHeader` compartido (título, cifras vivas, regla); en el tablero la cifra del embudo manda y los conteos pasan a una tira; JetBrains Mono para los números |
| 3 | Estados vacíos y microcopy | `03b01ee` | Escenas SVG de cancha en los vacíos (`cancha`, `afuera`, `al-dia`), textos con la voz de la landing en las ocho pantallas, contraste de textos a AA |
| 4 | "El CRM viste la cancha" | `51428ca` | Superficie `.cesped` en sidebar, header y marcadores; marcas de cancha en SVG; títulos en Varela Round; reloj del recambio en cada alerta; contraste medido en el punto más claro del césped (mínimo 5.7:1) |
| 5 | Iconografía del rubro y tablero con recambios | `aa0619c` | Íconos propios (arco, red, pelota, cono, pechera, banderín, escalera, valla) elegidos por `tipoEquipo`; barra de vida útil en Productos; tarjetas "Recambios que vienen" y "De la venta al recambio" en el tablero |
| — | Correcciones del ranking | `5e6a95c`, `dd50fe7` | Ver [b.6](#b6-tablero-inicio) |

Antes de esos pases hubo ajustes de color y modo oscuro (`a86ccf4`, `0c65a35`, `c136d71`, `4630a53`,
`b5e0a10`) y el cambio de nombre a Tuco & Nito (`3c3ce57`).

### b.13 Calidad: self-checks y pruebas SQL

| Estado | Implementado |
|---|---|
| Detalle | [docs/pruebas.md](./pruebas.md) |

- **25 archivos `*.check.ts`, 243 pruebas**, ejecutables con `node --test` y sin framework (el detalle por archivo está en [pruebas](./pruebas.md)). Algunos cuidan que el repositorio no se desarme: `permisos.check.ts` (el catálogo coincide con el CHECK de la 0007), `migraciones.check.ts` (el kit de migraciones coincide con las migraciones, no lleva `begin`/`commit` y tiene apagado el bloque de `pg_trgm`) y `manual.check.ts` verifica seis cosas: que cada capítulo declare id, número y título; que los id sean únicos y los capítulos se numeren sin saltos; que las figuras de los capítulos y las de `scripts/manual/figuras.mjs` sean las mismas; que **cada figura tenga su captura en `docs/manual/capturas/` o, si no, figure en `docs/manual/pendientes.json` (y nunca las dos cosas)**; que `pendientes.json` no nombre figuras que ya no existen; y que los scripts del manual no lleven contraseñas.
- `permisos.check.ts` **lee la migración `0007`** y falla si el CHECK de `roles.permisos` o los roles por
  defecto divergen del catálogo de `src/lib/permisos.ts`.
- **7 scripts SQL con rollback** (`supabase/tests/`; los de la 0007 y los que se sumaron con las migraciones siguientes): `0005_permisos.sql` (aislamiento y permisos),
  `0007_reglas.sql` (cartera propia, reglas del embudo, historial, auditoría, catálogos, logo) y
  `0007_reejecucion.sql` (que la migración se pueda correr dos veces). Los casos negativos verifican el
  código y el mensaje del error, no solo que falle. El usuario ejecutó la migración y estas pruebas el
  2026-10-04.

---

### b.14 Búsqueda, filtros y paginación en el servidor (F3)

| Aspecto | Detalle |
|---|---|
| Estado | **Implementado (F3)** |
| Dónde | `src/lib/paginacion.ts` (lógica pura, con `paginacion.check.ts`), `src/components/FiltrosUrl.tsx` (`useFiltrosUrl`, `CajaBusqueda`, `FiltroSelect`, `FiltroChip`, `FiltroFecha`, `BarraPendiente`), `src/components/Paginacion.tsx`, y el `page.tsx` + `*List.tsx`/`*View.tsx` de empresas, contactos, oportunidades, productos, ventas y usuarios. `src/app/(app)/error.tsx` avisa si la base no responde |
| Base | `supabase/migrations/0010_indices_busqueda.sql`: índices por organización y orden de cada lista, y un bloque **opcional** de trigramas (`pg_trgm`). **Pendiente de aplicar a mano en la base viva**; la app funciona igual sin ella |
| Commits | En `main` |

**Qué hace.**

- Cada lista pide al servidor solo la página que muestra (`.range()` con `count: "exact"`). Antes traía todo y
  PostgREST cortaba en silencio en 1000 filas.
- La URL es el estado: `?q=&page=&pageSize=&estado=&responsable=&origen=…`. Se puede compartir, sobrevive a un
  reload y "atrás/adelante" anda. Página por defecto 1, 20 por página (10, 20 o 50).
- **Qué filtra cada pantalla.** Empresas: búsqueda (también por sus contactos), estado, tipo de cliente,
  responsable (con `clientes.ver_todos`), origen y "Ver dadas de baja". Contactos: búsqueda, estado, empresa o
  individual, responsable, origen y "Ver bajas". Oportunidades: búsqueda (título, cliente, producto), estado
  (por defecto abierta), etapa, responsable (incluye "Sin asignar"), origen y vista (`?vista=lista`). Productos:
  búsqueda, categoría y estado (activos o de baja). Ventas: búsqueda (comprobante, cliente, producto), cliente
  y rango de fechas. Usuarios: búsqueda, rol y estado (activo, invitación pendiente, de baja), y la pestaña
  (`?tab=roles`).
- **Paginación accesible.** `nav` con `aria-label`, "Anterior/Siguiente" y números con "…", la página actual
  con `aria-current="page"`, extremos deshabilitados con `aria-disabled`, links reales (`?page=N`) que
  funcionan sin JavaScript, el texto visible "Mostrando 21–40 de 134" y una línea `sr-only` con
  `role="status"` (`AnuncioResultados`) que anuncia "N resultados" o "Sin resultados".
- **Estado "pendiente".** Mientras el servidor recalcula, la lista tiene `aria-busy` y una línea de progreso.
- **Después de una alta, edición, baja o cambio de etapa** la lista se vuelve a pedir (`router.refresh()`).
- **Sin resultados.** "afuera" con la búsqueda entre «», o el vacío "cancha" si de verdad no hay nada.

**Límites conocidos.**

- La búsqueda que cruza tablas (empresas por sus contactos, contactos por su empresa, oportunidades y ventas
  por cliente o producto) se hace en dos pasos con un tope de 100 ids por paso. Una búsqueda muy corta ("a")
  puede dejar afuera coincidencias que solo existen por la otra tabla. Está marcado con `ponytail:` en cada
  página; lo exacto sería una vista o RPC.
- El `*` que escribe la persona vale por un carácter cualquiera, no por "cualquier cosa" (PostgREST no tiene
  escape para el `*`). `%`, `_` y `\` se buscan literales.
- No se busca sin tildes ("perez" no encuentra "Pérez"), igual que antes.
- Los desplegables de empresas y contactos **dentro de los formularios** (oportunidad, contacto, venta)
  siguen trayendo la lista entera, con el tope de 1000 de PostgREST. Con más de 1000 empresas haría falta un
  buscador en el servidor dentro del select.
- El pie de totales de la lista de oportunidades ahora cuenta **la página**, no todo el filtro (se rotuló
  "En esta página" / "Valor de la página"); sumar todo el filtro pide una agregación en la base.
- La búsqueda de oportunidades ya no mira el nombre del responsable: para eso está el filtro de responsable.
- La pestaña "Roles" de `/usuarios` y los conteos de usuarios por rol traen una fila por usuario de la
  organización (con el tope de 1000).

---

## c. La base de datos de la entrega final (migración 0007)

Archivo: `supabase/migrations/0007_entrega_final.sql` (commit `a5c0135`). Aplicada en el proyecto
Supabase real el 2026-10-04. Requiere `0001` a `0006`. Sin `BEGIN`/`COMMIT` propios, a propósito, para
poder ensayarla dentro de una transacción con el test.

### c.1 Qué hace, sección por sección

| Sección | Objetos | Regla |
|---|---|---|
| 1. Permisos y roles | Constraint `roles_permisos_validos` (19 claves), función `crear_roles_iniciales(uuid)` | Cinco permisos nuevos: `clientes.ver_todos`, `clientes.asignar`, `oportunidades.asignar`, `oportunidades.reabrir`, `configuracion.gestionar`. "Ventas" pasa a "Vendedor" y "Corporativo" a "Responsable comercial", renombrados en el lugar (mismo `id`). Corre una sola vez: la marca es el CHECK que ya conoce `clientes.ver_todos` |
| 2. Catálogos | Tablas `origenes`, `motivos_perdida`, `tipos_actividad`; función `crear_catalogos_iniciales(uuid)` | Por organización, con `activo` (se dan de baja, no se borran). 7 orígenes, 7 motivos y 12 tipos de actividad iniciales |
| 3. Etapas con tipo | Columna `etapas.tipo` (`abierta`/`ganada`/`perdida`), trigger `etapas_validar_tipo` | Las etapas por defecto se renombran en el lugar al vocabulario del rubro. No se puede cambiar el tipo de una etapa con oportunidades adentro |
| 4. Alta de organización | Función/trigger `organizacion_inicial()` | Una organización nueva recibe roles, embudo del rubro (6 etapas) y catálogos |
| 5. Empresas y contactos | Columnas `estado`, `responsable_id`, `origen_id`, `tipo_cliente`, `sitio_web`, `documento` | Una empresa con ventas existentes pasa a `cliente` |
| 6. Oportunidades | Columnas `estado`, `fecha_estimada_cierre`, `fecha_cierre`, `origen_id`, `motivo_perdida_id`, `probabilidad`, `tipo`; CHECK `oportunidades_estado_coherente` | Backfill: lo que estaba en Entregado/Perdida queda cerrado con `updated_at::date` como fecha de cierre; las perdidas viejas reciben el motivo "Dato histórico sin motivo" |
| 7. Responsables | Bloque de datos de una sola vez | La empresa toma el responsable de su oportunidad más reciente; el contacto, el de su oportunidad o el de su empresa |
| 8. Asignación | Función/triggers `validar_responsable` | Alta sin responsable queda para el creador; asignar o reasignar exige permiso; el responsable tiene que ser de la misma organización |
| 9. Reglas, historial y auditoría | Triggers `oportunidades_reglas`, `oportunidades_registrar_etapa`, `oportunidades_auditar_cerrada`; tablas `oportunidad_etapas_historial` y `oportunidad_auditoria`; RPC `cambiar_etapa()` | Ver [reglas de negocio](./reglas-de-negocio.md) |
| 10. Actividades | Columnas `tipo_actividad_id`, `oportunidad_id`, `resultado`; `empresa_id` pasa a ser opcional; trigger `bitacora_defaults` | CHECK `empresa_id` o `contacto_id`. Se quita el CHECK viejo de 7 valores de `tipo` |
| 11. Datos del proveedor | Columnas de `organizaciones`; trigger `organizaciones_proteger_plataforma` | Los edita `configuracion.gestionar`; el nombre y el estado de la organización siguen siendo de la plataforma |
| 12. RLS | Políticas "ver/crear/editar/borrar" rearmadas | Cartera propia (ver [reglas](./reglas-de-negocio.md)); oportunidades **sin** política de borrar; historial y auditoría solo lectura |
| 13. Logo | Bucket `logos` y cuatro políticas en `storage.objects` | Privado, PNG/JPG/WebP, hasta 1 MB, ruta `{organizacion_id}/logo.{ext}`; SVG rechazado |

### c.2 Qué tiene interfaz y qué no

| Capacidad de la 0007 | Estado | Interfaz prevista |
|---|---|---|
| Catálogos `origenes`, `motivos_perdida`, `tipos_actividad`, etapas con tipo | **Implementado** en `/configuracion` (F1a) | — |
| Datos del proveedor y logo | **Implementado** en `/configuracion` (F1a) | — |
| Estado, responsable, origen, tipo de cliente en empresas y contactos | **Implementado** (F1b) | — |
| Estado, cierre, motivo, origen, probabilidad en oportunidades | **Implementado** (F2) | — |
| Historial de etapas y auditoría | **Implementado** (F2): línea de tiempo y "Cambios después del cierre" en el detalle | — |
| `cambiar_etapa()` | **Implementado** (F2): tablero, detalle y modal de cierre la usan; ninguna pantalla actualiza `etapa_id` directo | — |
| Actividades con tipo de catálogo, resultado y oportunidad | **Implementado** en las fichas de empresa y contacto (F1b); también desde el detalle de la oportunidad (F2) | — |
| Cartera propia por responsable | **Implementado** (la base filtra; la pantalla muestra lo que la base devuelve) | — |
| Roles Vendedor y Responsable comercial | **Implementado** | — |

### c.3 Orden de despliegue

Aplicar la migración y desplegar la app **inmediatamente después**. Entre un paso y otro no hay que
editar roles desde `/usuarios`: la app vieja no conoce los permisos nuevos y, al guardar un rol, los
descarta. La migración no es solo aditiva: renombra roles y etapas, cierra oportunidades y asigna
responsables. Se puede volver a correr sin efecto, pero no deshace nada. Procedimiento completo en
[deploy](./deploy.md).

---

## d. Cambios que alteran el comportamiento

Lo que cualquier persona del equipo, o quien evalúe el trabajo, tiene que saber antes de usar el sistema.

| # | Cambio | Qué pasa ahora | Dónde se aplica |
|---|---|---|---|
| 1 | Roles renombrados | "Ventas" es "Vendedor" y "Corporativo" es "Responsable comercial". Los usuarios conservan su rol (mismo `id`) | Migración 0007 sección 1 |
| 2 | **Cartera propia** | Un usuario sin `clientes.ver_todos` solo ve las empresas, contactos y oportunidades donde es el responsable, y lo que cuelga de ellos (ventas, ítems, alertas, actividades). Hoy solo el Vendedor está en ese caso | RLS, sección 12 |
| 3 | Lo que no tiene responsable | Queda visible solo para quienes tienen `clientes.ver_todos` hasta que un administrador lo asigne. Hoy no hay pantalla para asignar empresas ni contactos | Sección 7 |
| 4 | Roles propios de cada cliente | Los que ya veían clientes reciben `clientes.ver_todos` para no perder visibilidad. Si un administrador se lo quita después, volver a correr la migración no se lo devuelve | Sección 1 |
| 5 | **Las oportunidades no se borran** | No hay política de borrado para nadie, ni el administrador. Se marcan perdidas. El historial las referencia sin cascada | Sección 12, sección 9 |
| 6 | **Perdida exige motivo** | Una oportunidad no puede quedar perdida sin `motivo_perdida_id`. Desde F2 la interfaz pide el motivo en el modal de cierre | Trigger `oportunidades_reglas` |
| 7 | **Ganada exige fecha real** | Si no viene, el trigger pone hoy | Ídem |
| 8 | **Reabrir exige permiso** | Pasar una oportunidad cerrada a una etapa abierta (o cambiar su resultado) requiere `oportunidades.reabrir`. Sin usuario (scripts, `service_role`) no se exige | Ídem |
| 9 | Asignar exige permiso | Crear una empresa, contacto u oportunidad para otra persona, o reasignarla, requiere `clientes.asignar` / `oportunidades.asignar`. Lo propio se asigna solo | Triggers `validar_responsable` |
| 10 | Editar una oportunidad cerrada se audita | Cada modificación queda en `oportunidad_auditoria` con `{campo: {antes, despues}}` | Trigger `oportunidades_auditar_cerrada` |
| 11 | Cada cambio de etapa se registra | También el alta (etapa anterior nula). Se ve en el detalle de la oportunidad (F2) | Trigger `oportunidades_registrar_etapa` |
| 12 | Etapas con vocabulario del rubro | Consulta recibida, Relevamiento de cancha, Presupuesto enviado, Negociación, Entregado (ganada), Perdida. Renombradas en el lugar; solo las que conservaban el nombre por defecto | Sección 3 |
| 13 | Contactos con actividades no se borran | La clave foránea pasó de `set null` a `no action`. La baja es por estado | Sección 10 |
| 14 | Actividades | El autor es siempre quien escribe; el tipo viejo `consulta` se traduce a "Otro" | `bitacora_defaults` |
| 15 | Organización protegida | El administrador de un cliente no puede cambiar el nombre ni el estado (`activa`) de su organización | `organizaciones_proteger_plataforma` |
| 16 | Orden de despliegue | Aplicar la migración y desplegar enseguida | [deploy](./deploy.md) |

**Hoy desde la interfaz: qué sigue igual.** Las pantallas respetan las reglas nuevas de la base
(desde F2 las oportunidades cambian de etapa por `cambiar_etapa`; ver [b.8](#b8-oportunidades-y-embudo)).

---

## e. Estado frente a la consigna

Se usaron como vara los tres documentos del curso (`Entregas-CRM.pdf`, `Consigna_Trabajo_Practico.pdf`,
`Modulos_Principales.pdf`, que están fuera del repositorio). Estados: **I** Implementado · **B** Base
lista, sin interfaz · **P** Planificado.

### e.1 Primera entrega (24/9)

| Requisito | Estado | Evidencia |
|---|---|---|
| Inicio de sesión funcional | I | `src/app/login/` |
| Al menos un usuario habilitado | I | Cuentas del seed y altas desde `/usuarios` |
| Crear y modificar empresas | I | `EmpresaForm.tsx` |
| Crear y modificar contactos | I | `ContactoForm.tsx` |
| Consultar listados | I | `EmpresasList.tsx` |
| Consultar detalles | I (F1b, F5) | Fichas `/empresas/[id]` y `/contactos/[id]` (ficha 360) |
| Relacionar contactos con empresas | I | `contactos.empresa_id` |
| Productos o servicios | I | ABM completo en `/productos` |
| Crear y modificar oportunidades; empresa o contacto; responsable; producto | I | `OportunidadForm.tsx` |
| Listado de oportunidades | I | `OportunidadesView.tsx` |
| Detalle de oportunidad | I (F2) | `/oportunidades/[id]` |
| Embudo: oportunidades agrupadas por etapa | I | Columnas por etapa |
| Cambiar de etapa | I | Arrastre entre columnas |
| Conservar los cambios en la base | I | RPC `cambiar_etapa` (F2) |

### e.2 Entrega final (12/11)

| Requisito | Estado | Evidencia y salvedades |
|---|---|---|
| Gestión de usuarios | I parcial | Invitar, cambiar rol, baja, reactivar, reenviar. No se editan nombre ni email |
| Roles administrador, vendedor y responsable comercial | I | Roles por defecto en `src/lib/permisos.ts` y en la 0007, aplicados en producción |
| Permisos según el rol | I | 19 permisos; RLS por permiso; `0005_permisos.sql` |
| Gestión completa de empresas y contactos | I (F1b, F3) | Alta, edición, estado, responsable, origen, tipo de cliente (industria), sitio web, documento, baja lógica, listas con filtros y fichas |
| Gestión de productos o servicios | I | `/productos`. No distingue producto de servicio |
| Asignación de responsables comerciales | I (F1b, F2) | Empresas, contactos y oportunidades: se elige en el formulario (con `clientes.asignar` / `oportunidades.asignar`) y "Reasignar" en el detalle de la oportunidad |
| Gestión completa de oportunidades | I (F2, F4) | Alta, edición, estado, fechas, origen, motivo, probabilidad, detalle. El tipo licitación, con sus datos y la regla de la apertura, es de F4 (requiere la `0011`) |
| Embudo comercial configurable | I (F1a, F2) | Etapas en `/configuracion`; el tablero genera sus columnas con las etapas abiertas configuradas |
| Cambio de etapas con historial | I (F2) | `cambiar_etapa` con observación; el historial se ve en el detalle |
| Registro de actividades realizadas | I (F1b, F2) | Catálogo de tipos, resultado, oportunidad y cliente individual; también desde el detalle de la oportunidad |
| Historial comercial de empresas, contactos y oportunidades | I (F1b, F2, F5) | Empresa y contacto: actividades y, desde F5, "Historia de la cuenta" (actividades, etapas, ventas y avisos). Oportunidad: actividades y cambios de etapa unificados |
| Cierre de oportunidades ganadas o perdidas | I (F2) | `CierreModal`: fecha de cierre, motivo y observación; reabrir con permiso |
| Registro de motivos de pérdida | I (F1a, F2) | Catálogo en `/configuracion`; el modal de pérdida lo exige |
| Gestión de etapas, tipos de actividad, orígenes y motivos de pérdida | I (F1a) | `/configuracion` |
| Búsqueda, filtros y paginación | I (F3) | Las seis listas (empresas, contactos, oportunidades, productos, ventas, usuarios) buscan, filtran y paginan **en el servidor**, con el estado en la URL; 10, 20 o 50 por página. Filtros por responsable, estado, etapa y origen donde corresponde. Las alertas siguen filtrando en el navegador. Los índices de apoyo (`0010`) están en el repositorio, **pendientes de aplicar** |
| Adaptación real a la industria | I + B + P | Vida útil, snapshot, alertas de recambio, ventas por entrega: I. Embudo, orígenes, motivos y tipos del rubro, `tipo_cliente`: B. Parque instalado: I (F4, anda hoy). Canchas, equipamiento sugerido, licitaciones y recambio en un clic: I (F4) pero **requieren aplicar la `0011`** |
| Presupuesto imprimible | I (F6) | `/oportunidades/[id]/presupuesto`: encabezado del proveedor con su logo, cliente, líneas editables (catálogo o texto libre), IVA según la condición del proveedor, validez y condiciones, numeración por organización, «Imprimir / Guardar PDF» y registro de la actividad «Envío de propuesta». **Guardar y numerar requiere aplicar la `0012`**; sin ella se imprime como «Borrador» |
| Pruebas E2E y CI | I (F6), sin ejecutar | Playwright (`e2e/`, `npm run test:e2e`) contra una organización de pruebas dedicada (`supabase/seeds/e2e_tests.sql`) y GitHub Actions (`.github/workflows/ci.yml`: lint, tipos, self-checks y build). Escritas; **todavía sin ejecutar completas** (ver [pruebas](./pruebas.md)) |
| Manual de usuario | I (F8) | PDF de 89 páginas generado con un comando (`npm run manual`); 10 figuras de pantallas que dependen de las migraciones `0011` y `0012`, de la clave de IA o del superadmin salen como «Captura pendiente» hasta regenerarlo con la base migrada |
| Inteligencia artificial (opcional) | I (F7) | Aviso de recambio y resumen de cuenta, siempre revisados por una persona; se apaga quitando `ANTHROPIC_API_KEY`. Cumple las siete condiciones de la consigna (ver [ia](./ia.md)). **Probada contra un servidor simulado, no contra la API real** |

### e.3 Usuarios del sistema (consigna, pp. 5 y 6)

| Rol y capacidad | Estado | Nota |
|---|---|---|
| Administrador: crea y modifica usuarios, asigna roles | I | `/usuarios` |
| Administrador: configura etapas, tipos de actividad, motivos y orígenes | I (F1a) | `/configuracion`, con `configuracion.gestionar` |
| Administrador: accede a toda la información | I | Rol con todos los permisos |
| Administrador y Responsable comercial: asignan y reasignan oportunidades | I | Formulario y "Reasignar" en el detalle (F2) |
| Administrador y Responsable comercial: asignan y reasignan contactos | I (F1b) | Selector de responsable en el formulario del contacto (con `clientes.asignar`) |
| Vendedor: registra empresas y contactos; consulta los asignados; crea y actualiza oportunidades | I | Cartera propia aplicada por la base |
| Vendedor: cambia de etapa; registra actividades | I | Tablero, detalle y bitácora |
| Vendedor: consulta el historial comercial | I | Actividades en las fichas y, en el detalle de la oportunidad, actividades y cambios de etapa (F2) |
| Vendedor: marca ganadas o perdidas | I (F2) | Desde el menú de la tarjeta o el detalle |
| Responsable comercial: consulta todo el equipo, supervisa abiertas, ve el embudo | I | Filtro por responsable en empresas, contactos y oportunidades (F3), solo con `clientes.ver_todos`; tablero comercial y conversión del embudo (F5) |
| Responsable comercial: historial de cada negociación | I (F2) | Detalle de la oportunidad |
| Responsable comercial: revisa ganadas y perdidas | I (F2) | Lista con filtro por estado, motivo y fecha de cierre |

### e.4 Módulos principales

| Módulo | Estado | Observaciones |
|---|---|---|
| Módulo 1, empresa: datos mínimos | I (F1b: razón social, CUIT, tipo de cliente, email, teléfono, dirección, sitio web, estado, responsable, origen, observaciones) | |
| Módulo 1, contacto: datos mínimos | I (F1b: nombre, apellido, documento, cargo, email, teléfono, empresa opcional, estado, responsable, origen, observaciones) | |
| Estados potencial, cliente, inactivo, no contactar | I (F1b) | Pill con texto en listas y fichas; CHECK en la base |
| Baja lógica | I (F1b) | "Dar de baja" y "Reactivar" con confirmación; sin borrado en la interfaz. Con la 0008 aplicada la base tampoco deja borrar; ver [f](#f-seguridad-de-esta-versión) |
| Separación contacto / oportunidad | I | Entidades distintas |
| Módulo 2, datos mínimos de oportunidad | I (F2: título, empresa/contacto, responsable, producto, valor, etapa, probabilidad, fechas, origen, estado, motivo, observaciones) | |
| Estados abierta, ganada, perdida | I (F2) | Derivados del tipo de la etapa; Pill con texto |
| Vistas: lista, individual, tablero; filtros por responsable, etapa, estado y origen | I (F2, F3): lista, tablero e individual; filtros y paginación en el servidor | La lista se pagina; el tablero muestra hasta 500 abiertas con aviso |
| Cambio de etapa desde el detalle o el tablero | I (F2) | |
| Reglas del cambio de etapa (ocho condiciones) | I (F2) | Triggers y CHECK; probadas en `0007_reglas.sql`; la interfaz las pide y traduce los errores |
| Módulo 3, tipos mínimos de actividad (9) | I (F1b): 12 sembrados por organización, de los cuales 9 son los de la consigna; el formulario ofrece los activos del catálogo | Editables en `/configuracion` |
| Módulo 3, datos mínimos de la actividad | I (F1b: tipo de catálogo, fecha y hora, usuario, empresa o contacto, descripción, resultado, oportunidad opcional) | |
| Historial cronológico en contacto, empresa y oportunidad | I (F1b, F2) | |
| Historial de etapas (oportunidad, anterior, nueva, fecha, usuario, observación) | I (F2) | `oportunidad_etapas_historial`, visible en el detalle |

### e.5 Lo construido que la consigna lista como fuera de alcance

La consigna excluye gestión de tareas, agenda, recordatorios y notificaciones, indicadores y
estadísticas, exportación, integraciones, API pública, importación, facturación, pagos, contabilidad,
stock, campañas, **envío de correos desde el CRM**, **integración con WhatsApp** y **soporte para
múltiples organizaciones**. De esa lista, el proyecto tiene cuatro cosas: el multitenant, el envío de
mails (de alerta y de cuenta), los links de WhatsApp para los avisos y un tablero con indicadores. Las
demás exclusiones no existen en el producto. Estas cuatro no se pidieron y se conservan porque forman
parte del producto. Es una decisión del grupo si se presentan como extras.

---

## f. Seguridad de esta versión

Resumen; el modelo completo está en [seguridad](./seguridad.md).

- **Aislamiento y permisos en la base.** Cada política RLS pide la organización propia y el permiso. La
  0007 sumó cartera propia, política de solo lectura para historial y auditoría, y ninguna política de
  borrado para oportunidades.
- **Alta de usuarios.** La organización y el rol se leen de `raw_app_meta_data` (solo escribe el
  servidor), nunca de `raw_user_meta_data` (editable por el usuario). Probado en `0005_permisos.sql`.
- **Clave de servicio.** `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor; `src/lib/supabase/admin.ts`
  importa `server-only`, así que el build falla si se importa desde un componente de cliente.
- **Mails.** Todo sale por SMTP propio; los links usan `SITE_URL`; el destino `next` de `/auth/confirm`
  solo acepta rutas internas.
- **Logo.** Bucket privado, PNG/JPG/WebP hasta 1 MB, SVG rechazado a propósito, carpeta por organización.
- **Funciones internas.** `crear_roles_iniciales`, `crear_catalogos_iniciales` y `registrar_envio_auth`
  no son ejecutables por usuarios finales.

**Límites conocidos de esta versión.**

1. *(Resuelto por la `0008`, pendiente de aplicar.)* La política `borrar` de `empresas` y `contactos`
   seguía vigente para quien tiene `clientes.editar`; la `0008` la quita y la baja lógica pasa a ser una
   garantía de la base.
2. `src/lib/supabase/types.ts` **no se regeneró después de la 0007**: no incluye las tablas ni columnas
   nuevas. Hay que regenerarlo antes de construir la interfaz de F1.
3. `next.config.ts` no define cabeceras de seguridad (CSP y similares).
4. La contraseña de las cuentas de demostración es pública (está en el seed). Si el seed está cargado en
   el proyecto de producción, esas cuentas existen ahí.

---

## g. Pendiente y próximos pasos

Plan de trabajo vigente (hoy 2026-10-04, entrega 2026-11-12). Cada fase la implementa una persona con
revisión fresca antes de commitear y termina con `tsc`, `eslint`, `next build`, los self-checks y una
pasada en el navegador. Si falta tiempo, se recorta desde el final: F7, luego F5 (Ctrl+K y conversión) y
luego F4 (licitaciones); nunca F0 a F3.

| Fase | Contenido | Fecha objetivo | Estado |
|---|---|---|---|
| F0 | Migración `0007_entrega_final.sql` | 2026-10-08 | **Hecha** (aplicada el 2026-10-04) |
| F1 | `/configuracion` (datos de la empresa y logo, etapas, tipos de actividad, orígenes, motivos de pérdida) y empresas/contactos completos (estado, responsable, origen, tipo de cliente; `/contactos`; detalles) | 2026-10-13 | **Hecha** (F1a `/configuracion`, F1b empresas y contactos) |
| F2 | Oportunidades completas: detalle, cerrar ganada/perdida con modal de motivo, reabrir, reasignar, kanban dinámico con `cambiar_etapa`, línea de tiempo; actividades genéricas | 2026-10-18 | **Hecha** (`891d663`) |
| F3 | Búsqueda, filtros y paginación en el servidor en todas las listas | 2026-10-22 | **Hecha** (`1ccb553`; la migración `0010` de índices está pendiente de aplicar) |
| F4 | Rubro: recambio en un clic, parque instalado, ficha de canchas, licitaciones | 2026-10-28 | **Hecha** (la migración `0011` está pendiente de aplicar a mano y, hasta entonces, canchas, licitaciones y el botón de recambio no se muestran) |
| F5 | Ficha 360, tablero del responsable, conversión del embudo, búsqueda global Ctrl+K | 2026-11-02 | **Hecha** (no necesita migración) |
| F6 | Presupuesto imprimible; pruebas E2E con Playwright y CI en GitHub Actions | 2026-11-05 | **Hecha** (la migración `0012` está pendiente de aplicar a mano y, hasta entonces, el presupuesto se imprime como «Borrador» sin guardarse; la suite E2E y la CI **no se ejecutaron** contra una base real ni en GitHub, ver [pruebas](./pruebas.md)) |
| F7 | IA opcional: aviso de recambio y resumen de cuenta | 2026-11-08 | **Hecha** (sin migración; necesita `ANTHROPIC_API_KEY`, que alguien tiene que aportar, y no se probó contra la API real, ver [ia](./ia.md)) |
| F8 | Documentación y manual de usuario en PDF, con el kit de migraciones y las pruebas que los cuidan | 2026-11-11 | **Hecha** (adelantada al 2026-10-04; ver [b.19](#b19-manual-de-usuario-y-kit-de-migraciones-f8)) |

**Pendiente inmediato (no es una fase).**

1. **Aplicar `supabase/aplicar/aplicar_0008_a_0012.sql`** en el SQL Editor (pasos en [su LEEME](../supabase/aplicar/LEEME.md)) y correr las seis pruebas SQL.
2. Regenerar `src/lib/supabase/types.ts` contra el proyecto real y volver a correr `npm run typecheck`.
3. Cargar `supabase/seeds/demo_rubro.sql` (canchas, datos de licitación y un presupuesto guardado) y correr `npm run manual`: se completan las figuras pendientes (con `ANTHROPIC_API_KEY` y con las credenciales del superadmin, también las de IA y las del panel de plataforma).
4. Correr una vez la suite E2E y la CI en GitHub (hoy escritas pero sin ejecutar completas).
5. Decidir la licencia del repositorio.

**Pendiente de confirmar.**

- Qué commit se presentó el 2026-09-24 como primera entrega. El repositorio no tiene etiquetas (`git tag`
  está vacío); las etiquetas "primera" y "segunda entrega" de [CHANGELOG](../CHANGELOG.md) están
  inferidas del historial y de `CLAUDE.md`.
- Que el seed de demostración con la versión 0007 esté cargado en producción.
- Que `npm audit` esté limpio (no se ejecutó).

---

## h. Apéndices

### h.1 Commits, por tema

Los 45 commits de `main`, agrupados. Fechas en formato aaaa-mm-dd.

**Base y primera versión (2026-09-17).**

| Hash | Asunto |
|---|---|
| `65d5b4a` | Initial CRM scaffold: Next.js + Supabase |
| `d6af8af` | Trigger initial Vercel deployment |
| `cc75fbb` | Connect live Supabase project and use generated DB types |
| `e6ae917` | Redesign UI: dark mode, drawers, hamburger nav, merged pages |
| `984334e` | Update docs for the redesigned UI and known Vercel deploy issue |
| `80a1b18` | Fix production URL in docs: crmgads1.vercel.app (not crm-gads1) |
| `a7d6c4c` | chore(deps): add lucide-react, clsx, tailwind-merge and tw-animate-css |
| `8326161` | feat(ui): add Sumar UI Kit tokens, primitives and form fields |
| `4cc8aad` | feat(ui): add app logo and use it as the favicon |
| `4c71c4e` | refactor(shell): rebuild app shell, drawer and row menu on the UI kit |
| `4461b5f` | refactor(login): rebuild login as a split-screen layout |
| `ffc4d9e` | refactor(dashboard): rebuild dashboard with KPIs and funnel charts |
| `6a15472` | refactor(empresas): restyle the list and forms on the UI kit |
| `9aa5e7d` | refactor(oportunidades): restyle funnel and listing, fix stage contrast |
| `53ef1f1` | docs: vendor the UI kit and record the design divergences |
| `95f5273` | fix(oportunidades): track stage writes per row to stop a silent desync |
| `ff2fd02` | fix(ui): keep the primitives server-renderable so the dashboard loads |
| `4e270dc` | fix(shell): scroll main instead of the page so the sidebar stays put |
| `a86ccf4` | feat(ui): make the brand green the main colour, not just an accent |
| `3c3ce57` | refactor(brand): rename the app to Tuco & Nito |

**Producto del rubro: catálogo, ventas, alertas, bitácora, landing (2026-09-18 a 09-20).**

| Hash | Fecha | Asunto |
|---|---|---|
| `a72f794` | 09-18 | feat: add landing, product catalog, sales history, renewal alerts and client log |
| `74bbcce` | 09-18 | feat(landing): dark marketing redesign with particles and ball cursor |
| `674e027` | 09-18 | feat(landing): particle field morphs into a sports shape per section |
| `00860d5` | 09-18 | fix(landing): clip body overflow so scroll-driven reveals complete |
| `b9b2fe9` | 09-18 | feat(alertas): send renewal emails over SMTP from the brand Gmail |
| `e58b5cd` | 09-20 | fix: delivery dates follow the sale date, and landing mail links open Gmail compose |

**Multitenant, cuentas, roles y panel (2026-09-18 a 09-19).**

| Hash | Fecha | Asunto |
|---|---|---|
| `2908420` | 09-18 | feat: multitenancy, per-org roles with permissions, own auth emails and loaders |
| `929b63d` | 09-18 | test(db): look up the superadmin before switching to the authenticated role |
| `ecef8bf` | 09-19 | feat(admin): separate platform panel for the superadmin, outside the CRM |
| `7e8f775` | 09-19 | feat(oportunidades): drag cards between pipeline stages instead of a dropdown |
| `de6b9cd` | 09-19 | fix(oportunidades): scope contacts to the chosen company and hide inactive or platform users as assignees |

**Interfaz: ajustes (2026-09-18).**

| Hash | Asunto |
|---|---|
| `0c65a35` | feat(ui): colored pills for categories, roles, types and states |
| `c136d71` | fix(ui): keep the logo tile brand green in dark mode |
| `4630a53` | fix(ui): default borders to the theme border color |
| `b5e0a10` | fix(ui): pin drawer form actions to the bottom on short forms |

**Demo (2026-09-24).**

| Hash | Asunto |
|---|---|
| `fd0067d` | chore: seed de demostracion para la catedra con cuentas por rol |

**Identidad visual (2026-09-28).**

| Hash | Asunto |
|---|---|
| `df44444` | refactor(ui): lenguaje visual propio para el CRM |
| `bfa9c1a` | refactor(ui): jerarquia y masthead en todas las pantallas |
| `03b01ee` | feat(ui): identidad del rubro en estados vacios y microcopy |
| `51428ca` | feat(ui): el CRM viste la cancha |
| `aa0619c` | feat(ui): iconografia del rubro y tablero con recambios |
| `5e6a95c` | fix(dashboard): el ranking de empresas mide la barra por monto, no por cantidad |
| `dd50fe7` | fix(dashboard): el ranking de empresas excluye oportunidades sin empresa |

**Entrega final: base de datos (2026-10-04).**

| Hash | Asunto |
|---|---|
| `a5c0135` | feat(db): migracion 0007 para la entrega final |
| `cb7c251` | fix(tests): el test de la 0007 no borra de storage.objects, verifica la politica |

### h.2 Tablas y columnas nuevas de la 0007

| Objeto | Qué se agregó |
|---|---|
| `origenes`, `motivos_perdida` | Tablas nuevas: `id`, `organizacion_id`, `nombre`, `activo`, `orden`, `created_at` |
| `tipos_actividad` | Ídem más `codigo` (clave estable de los tipos de sistema) |
| `oportunidad_etapas_historial` | Tabla nueva: `oportunidad_id`, `etapa_anterior_id`, `etapa_nueva_id`, `usuario_id`, `observacion`, `cambiado_en` |
| `oportunidad_auditoria` | Tabla nueva: `oportunidad_id`, `usuario_id`, `cambios` (jsonb), `cambiado_en` |
| `etapas` | `tipo` |
| `empresas` | `estado`, `responsable_id`, `origen_id`, `tipo_cliente`, `sitio_web` |
| `contactos` | `estado`, `responsable_id`, `origen_id`, `documento` |
| `oportunidades` | `estado`, `fecha_estimada_cierre`, `fecha_cierre`, `origen_id`, `motivo_perdida_id`, `probabilidad`, `tipo` |
| `bitacora_entradas` | `tipo_actividad_id`, `oportunidad_id`, `resultado`; `empresa_id` pasa a admitir nulo |
| `organizaciones` | `razon_social`, `cuit`, `condicion_iva`, `direccion`, `telefono`, `email`, `sitio_web`, `logo_path`, `presupuesto_validez_dias`, `presupuesto_condiciones` |
| Funciones | `crear_catalogos_iniciales`, `etapas_validar_tipo`, `validar_responsable`, `oportunidad_reglas`, `oportunidad_registrar_etapa`, `oportunidad_auditar_cerrada`, `cambiar_etapa`, `bitacora_defaults`, `organizaciones_proteger_plataforma` |
| Storage | Bucket `logos` y 4 políticas en `storage.objects` |

El esquema completo está en [modelo de datos](./modelo-de-datos.md).

### h.3 Catálogo de permisos

Definido en `src/lib/permisos.ts` y repetido en el CHECK de `roles.permisos`. La columna "Requiere" son
las dependencias que se agregan solas al guardar un rol.

| Permiso | Grupo | Qué permite | Requiere | A | V | R | L |
|---|---|---|---|---|---|---|---|
| `tablero.ver` | Inicio | Ver el tablero | `oportunidades.ver` | sí | sí | sí | no |
| `clientes.ver` | Clientes | Ver empresas y contactos | | sí | sí | sí | sí |
| `clientes.ver_todos` | Clientes | Ver la cartera de todos (sin él, solo la propia) | `clientes.ver` | sí | no | sí | sí |
| `clientes.editar` | Clientes | Crear y editar empresas y contactos | `clientes.ver` | sí | sí | sí | no |
| `clientes.asignar` | Clientes | Elegir o cambiar el responsable de empresas y contactos | `clientes.editar` | sí | no | sí | no |
| `bitacora.ver` | Bitácora | Ver actividades | `clientes.ver` | sí | sí | sí | no |
| `bitacora.escribir` | Bitácora | Agregar actividades | `bitacora.ver` | sí | sí | sí | no |
| `oportunidades.ver` | Oportunidades | Ver el embudo | `clientes.ver`, `productos.ver` | sí | sí | sí | no |
| `oportunidades.editar` | Oportunidades | Crear, editar, mover de etapa y cerrar | `oportunidades.ver` | sí | sí | sí | no |
| `oportunidades.asignar` | Oportunidades | Elegir o cambiar el responsable | `oportunidades.editar`, `clientes.ver_todos` | sí | no | sí | no |
| `oportunidades.reabrir` | Oportunidades | Reabrir una cerrada o cambiar su resultado | `oportunidades.editar` | sí | no | sí | no |
| `productos.ver` | Productos | Ver el catálogo | | sí | sí | sí | sí |
| `productos.editar` | Productos | Alta, edición y baja de productos | `productos.ver` | sí | no | no | no |
| `ventas.ver` | Ventas | Ver el historial de entregas | `clientes.ver`, `productos.ver` | sí | sí | sí | no |
| `ventas.editar` | Ventas | Registrar ventas | `ventas.ver` | sí | sí | no | no |
| `alertas.ver` | Alertas | Ver equipos vencidos o por vencer | `ventas.ver` | sí | sí | sí | no |
| `alertas.enviar` | Alertas | Mandar avisos por mail y WhatsApp | `alertas.ver` | sí | sí | no | no |
| `configuracion.gestionar` | Administración | Etapas, catálogos y datos de la empresa | | sí | no | no | no |
| `usuarios.gestionar` | Administración | Invitar, dar de baja, asignar roles y crear roles | | sí | no | no | no |

Columnas A, V, R y L: Administrador (19 permisos), Vendedor (12), Responsable comercial (14) y Solo
lectura (3).

### h.4 Rutas

| Ruta | Acceso | Qué es |
|---|---|---|
| `/` | Pública | Landing de marketing |
| `/login` | Pública (con sesión redirige a `/dashboard`) | Ingreso, Server Action `login` |
| `/recuperar` | Pública (con sesión redirige a `/dashboard`) | Recuperación de contraseña |
| `/auth/confirm` | Pública, sin rebote | Canjea el token de los mails (GET) |
| `/definir-clave` | Con sesión | Elegir contraseña tras activar o recuperar |
| `/auth/signout` | Con sesión | Cierra sesión (POST) |
| `/dashboard` | `tablero.ver` | Tablero |
| `/empresas` | `clientes.ver` | Lista de empresas con filtros y baja lógica |
| `/empresas/[id]` | `clientes.ver` | Ficha 360 de la empresa: datos, resumen de la cuenta, contactos, oportunidades, ventas e historia (actividades, etapas, ventas, avisos) |
| `/contactos` | `clientes.ver` | Lista de contactos (de empresa e individuales) |
| `/contactos/[id]` | `clientes.ver` | Ficha 360 del contacto (resumen de la cuenta e historia) |
| `/oportunidades` | `oportunidades.ver` | Tablero (columnas por etapa abierta) y lista con filtros |
| `/oportunidades/[id]` | `oportunidades.ver` | Detalle: datos, acciones, línea de tiempo (actividades y cambios de etapa) y auditoría |
| `/productos` | `productos.ver` | Catálogo |
| `/ventas` | `ventas.ver` | Historial de ventas |
| `/alertas` | `alertas.ver` | Recambios vencidos o por vencer |
| `/tablero-comercial` | `clientes.ver_todos` y `oportunidades.ver` | Tablero del responsable: pipeline por responsable, oportunidades sin actividad (`?dias=7\|14\|30`), ganadas y perdidas del mes (`?mes=aaaa-mm`) y motivos de pérdida |
| `/embudo` | `oportunidades.ver` y `clientes.ver_todos` | Conversión del embudo por etapa (`?desde=&hasta=&origen=`) |
| `/usuarios` | `usuarios.gestionar` | Usuarios y roles del cliente |
| `/configuracion` | `configuracion.gestionar` | Datos de la empresa y logo, etapas, tipos de actividad, orígenes y motivos de pérdida |
| `/sin-permisos` | Con sesión | Destino cuando el rol no tiene secciones |
| `/admin` | Superadmin | Panel de plataforma |
| `/oportunidades/[id]/presupuesto` | `oportunidades.ver` (guardar: `oportunidades.editar`) | Presupuesto imprimible de la oportunidad (F6); 404 si no existe o la RLS la esconde |

Sin el permiso, `/tablero-comercial` y `/embudo` llevan a la primera pantalla que el rol puede ver (`rutaInicial`). La búsqueda global (`Ctrl+K`) no es una ruta: es un diálogo del menú que llama a la Server Action `buscarGlobal`.

---

## b.15 Rubro: recambio en un clic, parque instalado, canchas y licitaciones (F4)

| | |
|---|---|
| Estado | **Implementado (F4)**; la migración `0011_rubro.sql` está **pendiente de aplicar a mano** en Supabase |
| Qué anda hoy sin la 0011 | El **parque instalado** de la ficha de empresa (usa `ventas`, `venta_items` y `productos`) y el filtro **Tipo** de la lista de oportunidades (`tipo` es de la 0007) |
| Qué se activa al aplicarla | Ficha de **canchas** y equipamiento sugerido; **licitaciones** (tipo, datos, regla de la apertura); **recambio en un clic** |
| Si falta la 0011 | Ninguna pantalla se rompe: la sección no se dibuja y quien tiene `configuracion.gestionar` ve un aviso "Se activa al aplicar la migración 0011" |

- **Recambio en un clic** (`/alertas`). Cada alerta tiene "Crear oportunidad de recambio" (primera acción): crea la
  oportunidad directo, sin formulario, y avisa con un link ("Ver la oportunidad →"). Después la alerta muestra
  "Oportunidad abierta →". No duplica: la base lo garantiza con un índice único parcial (una abierta por equipo) y la
  pantalla chequea antes para enlazar la existente con un mensaje amable. Lógica pura y con
  self-check en `src/lib/recambio.ts`.
- **Parque instalado** (ficha de empresa). Lo entregado, agrupado en vencidos (o que vencen hoy), por vencer, vigentes y sin seguimiento,
  con el total de unidades y el mismo reloj de recambio que `/alertas` (`RelojRecambio`, ahora un componente
  compartido). Cuenta en `src/lib/parque.ts`.
- **Canchas** (ficha de empresa). Alta, edición y baja lógica en un panel lateral. El **equipamiento sugerido**
  (`src/lib/canchas.ts`) compara las medidas estándar con el parque y dice "Le faltan 4 arcos de 3 × 2 m (F5)" o
  "Equipamiento completo", con el botón "Crear oportunidad". Es una **sugerencia, no un diagnóstico**.
- **Licitaciones**. El formulario de oportunidad ofrece "Directa | Licitación municipal" y, para licitación, organismo,
  expediente, fecha de apertura, monto oficial y garantía. El detalle muestra el bloque y avisa cuánto falta para la
  apertura; "Marcar ganada" queda bloqueada hasta entonces (en pantalla y en la base). La lista filtra por tipo.
- **Cambios de interfaz compartidos**: el aviso (toast) admite un link; `RelojRecambio` salió de `AlertasView`;
  `diasEntre` y `origenPorNombre` viven en `src/lib/clientes.ts`.

**Límites conocidos.** El permiso para crear oportunidades de recambio es `oportunidades.editar` (no existe
`oportunidades.crear`). La sugerencia supone una red por arco y no reconoce la medida de un producto cuyo nombre no la
dice (lo trata como comodín). Cambiar la fecha de apertura de una licitación ya ganada no se controla. El parque usa la fecha de Argentina y la vista de
alertas el `current_date` de la base (UTC): entre las 21:00 y las 24:00 pueden diferir un día. Al pasar una licitación a directa
se conserva su fila de datos.

---

## b.16 Ficha 360, tablero del responsable, conversión del embudo y búsqueda global (F5)

| | |
|---|---|
| Estado | **Implementado (F5)** |
| Migraciones | **Ninguna.** Todo se calcula con tablas que ya existen (`0001` a `0007`); no hace falta aplicar nada para que ande |
| Qué se esconde sin la `0008` a `0011` | Nada de esto depende de ellas |

| Pieza | Estado | Dónde |
|---|---|---|
| **Ficha 360** de empresa y de contacto: "Resumen de la cuenta" e "Historia de la cuenta" | Implementado | `src/components/Cuenta360.tsx`, `src/lib/timeline360.ts`, `src/lib/cuenta360.ts` |
| **Tablero comercial** del responsable | Implementado | `/tablero-comercial`, `src/lib/tablero.ts` |
| **Conversión del embudo** | Implementado | `/embudo`, `src/lib/embudo.ts` |
| **Búsqueda global** (Ctrl/Cmd+K) | Implementado | `src/components/PaletaBusqueda.tsx`, Server Action `src/app/(app)/buscar/actions.ts`, `src/lib/paleta.ts` |
| Menú: grupo **Equipo** | Implementado | `src/lib/navegacion.ts` (la lista única de pantallas y permisos, que usan el menú y la búsqueda) |

- **Resumen de la cuenta.** Arriba de la ficha: primera compra (de toda la cuenta, aunque las ventas mostradas estén recortadas), total comprado, última compra,
  oportunidades abiertas (cantidad y valor) y días desde el último contacto. Todo sale de las filas que la pantalla ya
  tiene, sin estimaciones. El contacto se marca en ámbar con ícono y frase ("Hace 45 días: conviene retomar") desde los 31
  días, y "la cuenta se enfrió" desde los 91; el color nunca va solo. Si el rol no ve la bitácora, no se afirma nada sobre
  el contacto.
- **Historia de la cuenta.** Una sola línea de tiempo, mes por mes (horario argentino), con actividades, altas de
  oportunidades, cambios de etapa (con cierres y reaperturas), compras y avisos de recambio enviados. Chips
  "Todo / Actividades / Etapas / Ventas / Avisos" (`aria-pressed`, con su cantidad) y "Ver 30 más". Reemplaza la columna
  "Actividad" de las fichas (las actividades siguen estando, con el mismo dibujo y "Registrar"). Se trae como mucho lo más
  reciente de cada tipo (200) y, si una cuenta pasa el tope, la pantalla lo dice.
- **Tablero comercial** (`clientes.ver_todos` y `oportunidades.ver`). Valor en juego del equipo en el marcador; pipeline
  por responsable (barra = valor, número = cantidad); **abiertas sin actividad** hace 7, 14 o 30 días (`?dias=`, con el
  responsable, el cliente y de dónde sale la última actividad); **ganadas y perdidas del mes** (`?mes=aaaa-mm`, con
  flechas) y **por qué se pierde** (ranking de motivos). Es una página de servidor: las lecturas llevan tope (1000) y se avisa
  si lo tocan.
- **Conversión del embudo** (`oportunidades.ver` y `clientes.ver_todos`). Por etapa abierta: cuántas oportunidades
  entraron, cuántas avanzaron (y el porcentaje), la mediana de días en la etapa y cuántas siguen ahí; más la tasa de
  éxito (ganadas ÷ cerradas) y el ciclo promedio hasta ganar y hasta perder. Se filtra por período de alta
  (`?desde=&hasta=`) y por origen (`?origen=`). "Cómo se calcula" explica el método en pantalla.
- **Búsqueda global.** `Ctrl+K` / `⌘K` (o el botón "Buscar…" del menú y el ícono de la barra superior en pantallas chicas)
  abre un diálogo con campo de búsqueda y lista de resultados (patrón combobox + listbox): flechas, Enter, Escape, foco
  atrapado y devuelto. Desde 2 letras y con 200 ms de espera busca empresas, contactos, oportunidades y productos (hasta 5
  de cada uno), solo en lo que el rol puede ver. Con la caja vacía ofrece "Ir a …" las pantallas que el rol puede abrir.
  En pantallas chicas es una hoja a todo el ancho.

**Cómo probarlo.** Con el Administrador o el Responsable comercial del seed: `/tablero-comercial` y `/embudo`; la
ficha de "Complejo Fútbol 5 La Tablada" y la de "Club Atlético San Justo" (esta tiene avisos de recambio enviados). El
Vendedor no ve las dos pantallas del equipo en el menú y, si escribe la URL, vuelve a su primera pantalla; su `Ctrl+K`
devuelve solo su cartera.

**Límites conocidos.**

1. Los cambios de etapa de la historia salen de `oportunidad_etapas_historial`; una oportunidad anterior a la `0007`
   arranca en la etapa de ese momento (regla 3.4), y por eso su alta usa `created_at` y no el historial.
2. La "Primera compra" es la primera venta cargada, no la fecha de alta de la empresa (esa sigue en los datos). Los topes de la historia son por tipo (200 actividades, compras, cambios de etapa y avisos; 100 oportunidades) y se avisan con su número real; el parque instalado lee todos los equipos de la empresa (hasta 1000).
3. Las actividades del tablero se leen de los últimos 120 días (hasta 1000). Una oportunidad sin actividad en ese tramo (si la lectura se corta antes del umbral va aparte, como "No se pudo comprobar")
   figura con "más de" o "antes del"; nunca se inventa una fecha.
4. La conversión mide a la cohorte por fecha de alta y por el estado de hoy; una oportunidad que se reabrió cuenta con su
   cierre vigente. No hay series en el tiempo ni comparación entre períodos.
5. Los productos no tienen ficha: el resultado lleva a `/productos?q=<nombre>`.
6. El navegador no puede abrir un resultado en una pestaña nueva con clic del medio (las filas del diálogo no son links).

---

## b.17 Presupuesto imprimible, pruebas E2E y CI (F6)

| | |
|---|---|
| Estado | **Implementado (F6)**. La migración `0012_presupuestos.sql` está **pendiente de aplicar a mano** en Supabase |
| Qué anda hoy sin la 0012 | Armar el presupuesto (líneas, totales, validez, condiciones) e **imprimirlo o guardarlo como PDF**, siempre como «Borrador» |
| Qué se activa al aplicarla | **Guardar** el presupuesto con su número correlativo por organización, listar los anteriores, reabrirlos para reimprimir y registrar la actividad «Envío de propuesta» al imprimir |
| Si falta la 0012 | Nada se rompe: "Guardar presupuesto" explica que se activa al aplicar la migración, y quien tiene `configuracion.gestionar` ve el aviso "Se activa al aplicar la migración 0012" |

| Pieza | Estado | Dónde |
|---|---|---|
| **Presupuesto imprimible** | Implementado | `/oportunidades/[id]/presupuesto` (`page.tsx` y `PresupuestoView.tsx`); botón "Presupuesto" en el detalle de la oportunidad |
| Cuentas y reglas (centavos enteros, IVA, validez, numeración) | Implementado | `src/lib/presupuesto.ts` y su self-check (20 pruebas) |
| Migración `0012` y su prueba SQL | Escritas, **pendientes de aplicar** | `supabase/migrations/0012_presupuestos.sql`, `supabase/tests/0012_presupuestos.sql` |
| Estilos de impresión | Implementado | `@media print` en `src/app/globals.css`; el shell lleva `data-app-shell`, `data-app-chrome` y `data-app-main` |
| **Pruebas E2E** (Playwright) | Escritas, **sin ejecutar completas** | `e2e/`, `playwright.config.ts`, `supabase/seeds/e2e_tests.sql` |
| **CI** (GitHub Actions) | Escrita, **sin ejecutar en GitHub** | `.github/workflows/ci.yml` |
| Scripts de `package.json` | Implementado | `lint` (ahora `eslint src e2e playwright.config.ts --max-warnings=0`), `typecheck`, `test`, `test:e2e`; `engines.node >=22.18` |

- **La hoja es del proveedor.** Encabezado con el logo de la organización (URL firmada del bucket privado `logos`) y sus datos;
  sin logo, la razón social en texto; nunca la marca de Tuco & Nito. Cliente y contacto salen de la oportunidad.
- **IVA.** Responsable Inscripto: precios netos y se discrimina IVA 21 %; con otra condición no se discrimina y una leyenda
  lo dice. La regla es pura y está probada (`calcularTotales`).
- **Numeración sin duplicados.** La asigna un trigger con un contador por organización que bloquea la fila hasta el fin de la
  transacción; es correlativa (`N° 000042`), el cliente no la elige y un alta fallida no deja huecos. Un presupuesto emitido
  no se modifica ni se borra: corregirlo es armar otro («Usar como base de uno nuevo»).
- **Actividad.** Imprimir un presupuesto guardado registra «Envío de propuesta» en el historial, **una sola vez** por presupuesto.
- **Tests.** `npm test` pasa a 187 pruebas en 20 archivos. Las SQL (`0005`, `0007`, `0008`, `0009`, `0011` y `0012`) dan `TODO OK`
  en PGlite. Los E2E son 14 pruebas en 3 archivos; corren contra la organización "E2E Tuco & Nito", nunca contra la demo.

**Límites conocidos.**

1. El logo se muestra con una URL firmada de 1 hora que la pantalla renueva sola (al volver a la pestaña, cada 50 minutos y antes de imprimir con el botón). Imprimir con `Ctrl+P` en una pestaña que estuvo mucho rato en segundo plano puede mostrar el logo roto: usá el botón.
2. Un presupuesto emitido guarda una **foto del emisor** (condición frente al IVA, razón social, CUIT, dirección, teléfono, mail y
   web; no el logo) y se reimprime desde ella. El logo y los datos del cliente y del contacto sí se leen en vivo: si cambian después,
   el presupuesto reimpreso muestra los nuevos. La alícuota (21 %) es la del código, no se guarda.
3. El borrador no se guarda mientras se escribe: si se cierra la pestaña se pierde.
4. No hay alícuotas reducidas (10,5 %), ni descuento global, ni moneda distinta del peso.
5. En el celular la hoja se desplaza horizontalmente dentro de su caja (es un A4 en miniatura); se edita y se imprime bien, pero no se lee de corrido.
6. El demo de la cátedra trae la condición "Precios en pesos, IVA incluido" mientras el proveedor es Responsable Inscripto y la hoja
   discrimina IVA: la condición es un texto editable de Configuración y conviene corregirla a "más IVA".

## b.18 IA asistida (F7)

| | |
|---|---|
| Estado | **Implementado (F7)**. Sin migración. **Opcional: se enciende con `ANTHROPIC_API_KEY`** |
| Qué hace | "Redactar con IA" en `/alertas` (borrador editable del aviso de recambio) y "Resumir con IA" en la ficha 360 de empresa y de contacto (resumen de solo lectura) |
| Sin la clave | Nada: ningún botón, ninguna llamada, el CRM igual que antes. `/configuracion` dice "IA: desactivada" |
| Verificación | Self-checks, tipos, lint, build y navegador contra un **servidor simulado** de la API. **No se llamó a la API real**: la calidad de los textos y el costo medido están sin verificar |

| Pieza | Dónde |
|---|---|
| Capa de servidor (config, cliente, prompts, contexto, errores, límite, llamada) | `src/lib/ia/` y sus tres self-checks |
| Server Actions `redactarAvisoRecambio` y `resumirCuenta` | `src/app/(app)/ia/actions.ts` |
| Panel del aviso (con la plantilla como respaldo) y registro del envío | `src/app/(app)/alertas/BorradorIA.tsx`, `registrarEnvioConBorrador` en `alertas/actions.ts` |
| Panel del resumen | `src/components/ResumenIA.tsx`, integrado en `HistoriaCuenta` |
| Etiqueta de IA y "Cómo usamos la IA" | `src/components/IaAviso.tsx` |

- **La IA solo redacta.** No envía, no guarda, no cambia datos. El aviso se manda desde el WhatsApp o el correo de la persona.
- **Datos mínimos.** No se piden mails, teléfonos, CUIT, documentos ni notas (y en los textos libres se intentan tachar, sin garantía); de los contactos, el nombre de pila. El servidor relee con la sesión de
  quien pide (la RLS decide qué ve la IA).
- **Las siete condiciones de la consigna** y cómo se cumplen, qué datos salen, el costo estimado y los límites: [ia](./ia.md).
- **Límite por persona** de 10 borradores cada 10 minutos, en memoria y por instancia del servidor.
- **Pendiente.** Quién aporta la clave y el presupuesto; leer borradores reales y ajustar `prompts.ts`; fijar un tope de gasto en la consola de Anthropic.

## b.19 Manual de usuario y kit de migraciones (F8)

| | |
|---|---|
| Estado | **Implementado (F8)**. Sin migración nueva; el kit solo junta las existentes |
| Manual | `docs/Manual-de-usuario-Tuco-y-Nito.pdf`: A4, 89 páginas, 7,2 MB. Fuente en `docs/manual/` (`manual.html`, `manual.css`, `capitulos/`, `capturas/`, `fuentes/`) |
| Scripts | `scripts/manual/capturas.mjs` (Playwright, solo navegación), `generar.mjs` (PDF con Chromium) y `figuras.mjs` (la lista de figuras). `npm run manual:capturas`, `manual:pdf` y `manual` |
| Kit de migraciones | `supabase/aplicar/aplicar_0008_a_0012.sql` (generado por `scripts/migraciones/consolidar.mjs`) y `supabase/aplicar/LEEME.md`. `npm run migraciones:consolidar` |
| Demo del rubro | `supabase/seeds/demo_rubro.sql`: canchas, datos de la licitación y un presupuesto guardado, para completar el manual |

### Cómo regenerar el manual

```bash
MANUAL_BASE_URL=http://localhost:3000 \
MANUAL_EMAIL=… MANUAL_PASSWORD=… MANUAL_EMAIL_VENDEDOR=… MANUAL_PASSWORD_VENDEDOR=… \
npm run manual          # capturas + PDF
npm run manual:pdf      # solo el PDF (sin la app ni internet, salvo la primera vez por las fuentes)
```

- Las credenciales **solo por entorno** (el repositorio es público). Las de la demo están en el comentario de `demo_catedra.sql`.
- Cada figura tiene un `esperar`: si la pantalla no está (migración sin aplicar, IA sin clave, sin credenciales de superadmin), queda en
  `docs/manual/pendientes.json` y el PDF muestra «Captura pendiente»; la próxima corrida la llena sola.
- La matriz de permisos y la tabla de pantallas por rol se arman leyendo `src/lib/permisos.ts` y `src/lib/navegacion.ts`; el índice usa los
  números de página reales (se imprime cada capítulo por separado y se comprueba que la suma coincide con el PDF).
- Más detalle en [`docs/manual/LEEME.md`](./manual/LEEME.md).

### Cumplimiento final, verificado contra el código

Lo que sigue es la reverificación de la tabla de [e](#e-estado-frente-a-la-consigna) al cerrar la 1.0.0, con `rg` sobre `src/app` y los
comandos de `package.json`:

| Bloque | Estado real |
|---|---|
| Acceso, usuarios, roles y permisos | Implementado y en producción. No se editan nombre ni email de un usuario |
| Empresas, contactos, productos, ventas, alertas, actividades | Implementado y en producción |
| Oportunidades, embudo configurable, cierre y reapertura, historial y auditoría | Implementado y en producción; el filtro de fecha futura y "empresa o contacto" los exige la base solo con la `0009` |
| Baja lógica sin borrado | Interfaz: sí. Base: la `0008` quita las políticas de borrado (**pendiente en la base viva**) |
| Búsqueda, filtros y paginación en el servidor | Implementado; los índices de la `0010` están **pendientes** (la app anda igual) |
| Rubro: parque instalado | Implementado y en producción |
| Rubro: canchas, equipamiento sugerido, licitaciones, recambio en un clic | Implementado en la app; **se activa al aplicar la `0011`** |
| Presupuesto imprimible | Implementado; imprime como «Borrador» hasta aplicar la `0012` (que habilita guardar y numerar) |
| Ficha 360, tablero comercial, conversión del embudo, Ctrl+K | Implementado y en producción (sin migración) |
| IA opcional | Implementada; **probada solo contra un servidor simulado**, no contra la API real |
| E2E y CI | Escritas; **no se ejecutaron completas** |
| Manual de usuario | Hecho; 10 figuras pendientes de las migraciones, de la clave de IA y del superadmin |
