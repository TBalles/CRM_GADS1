# Notas de la versión: entrega final (en construcción)

Estas notas cuentan todo lo que se agregó al proyecto desde la primera versión funcional hasta el
commit `cb7c251` (2026-10-04), organizado por área. Cada punto dice qué hace, dónde vive, qué regla de
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

**Dónde está hoy.**

- La base de datos ya cumple casi todo el módulo comercial de la consigna (estados, cierre, motivos,
  historial, auditoría, cartera propia, catálogos). La migración `0007` está aplicada y probada.
- La interfaz de esas capacidades **todavía no está**: el plan la reparte en las fases F1 a F8 (hasta
  el 2026-11-11). Hasta entonces la aplicación en producción es la de la segunda entrega, que convive
  con la base nueva (ver [d](#d-cambios-que-alteran-el-comportamiento)).

**Números, calculados del repositorio al commit `cb7c251`.**

| Medida | Valor | Cómo se obtiene |
|---|---|---|
| Commits en `main` | 45 (del 2026-09-17 al 2026-10-04) | `git log --oneline` |
| Migraciones SQL | 7 (`0001` a `0007`) | `supabase/migrations/` |
| Seeds | 1 (`demo_catedra.sql`) | `supabase/seeds/` |
| Scripts de prueba SQL | 3 (`0005_permisos`, `0007_reglas`, `0007_reejecucion`) | `supabase/tests/` |
| Tablas en `public` | 18, más la vista `alertas_vida_util` y el bucket de Storage `logos` | migraciones |
| Funciones en `public` | 18 (de las cuales 3 revocadas a usuarios finales) | migraciones |
| Triggers vigentes | 13 | migraciones |
| Permisos del catálogo | 19, en 8 grupos | `src/lib/permisos.ts` |
| Roles por defecto por cliente | 4 | `ROLES_POR_DEFECTO` |
| Páginas (`page.tsx`) | 13 | `src/app` |
| Route handlers | 2 (`/auth/confirm`, `/auth/signout`) | `src/app/auth` |
| Server Actions (archivos) | 6 | `src/app/**/actions.ts` |
| Self-checks (`node --test`) | 8 archivos, 50 pruebas, todas pasan | ver [pruebas](./pruebas.md) |
| Verificación estática | `tsc --noEmit` y `eslint src --max-warnings=0` pasan al commit `cb7c251` | ejecutadas al escribir estas notas |

`next build` no se ejecutó al escribir estas notas.

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
  bloquean). No se avisa al crear oportunidades o ventas: esas pantallas llegan en F2.

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
- Las fichas de empresa y contacto existen desde F1b; la ficha 360 (indicadores, conversión) sigue
  planificada en F5. El título de cada oportunidad en la ficha es texto: el detalle llega en F2.
- Las listas siguen filtrando en el navegador sobre todo lo que devuelve la base (F3 las pasa al servidor).

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

**Límite conocido.** El tablero suma **todas** las oportunidades, también las ganadas y perdidas, y el
texto dice "abiertas". La consulta no filtra por `estado` porque la interfaz es anterior a la 0007.
Se corrige junto con F2.

### b.7 Bitácora de clientes

| Aspecto | Detalle |
|---|---|
| Estado | **Implementado (F1b)** desde las fichas de empresa y de contacto: tipo de catálogo, fecha y hora, descripción, resultado, vínculo a oportunidad y cliente individual. El alta desde la ficha de la oportunidad llega en F2 |
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
| Estado | Alta, edición, embudo con arrastre y listado: **implementado**. Estado, cierre, motivo, historial, auditoría, origen, probabilidad y tipo: **base lista, sin interfaz** |
| Dónde | `src/app/(app)/oportunidades/` (`OportunidadesView.tsx`, `OportunidadForm.tsx`) |
| Commits | `65d5b4a`, `9aa5e7d`, `95f5273`, `7e8f775` (arrastre), `de6b9cd`; base: `a5c0135` |

**Qué hace hoy.**

- Alta y edición con título, empresa y/o contacto, producto, responsable, etapa, monto y notas.
- **Embudo en columnas por etapa**, arriba del listado, con **arrastre entre etapas** (HTML5 nativo, sin
  dependencia). El cambio se guarda al instante; si falla, la tarjeta vuelve y aparece un aviso. Cada
  tarjeta en vuelo está bloqueada para evitar escrituras concurrentes (`95f5273`). El arrastre no
  funciona con touch: en el móvil la etapa se cambia desde el formulario de edición.
- Listado con búsqueda y filtro por etapa; tabla en escritorio y tarjetas en móvil.
- En el formulario, el contacto se acota a la empresa elegida (`de6b9cd`) y el responsable no incluye a
  usuarios inactivos ni al superadmin.

**Qué hace la base desde la 0007.** El estado de la oportunidad (`abierta`, `ganada`, `perdida`) sale del
**tipo de la etapa**; cerrar exige fecha real y, si es perdida, motivo; reabrir exige permiso; cada cambio
de etapa queda en `oportunidad_etapas_historial`; editar una cerrada queda en `oportunidad_auditoria`;
las oportunidades no se pueden borrar. Detalle en [c](#c-la-base-de-datos-de-la-entrega-final-migración-0007).

**Lo que hay que saber de la interfaz actual frente a esas reglas.**

| Acción en pantalla | Resultado hoy |
|---|---|
| Arrastrar a una etapa abierta | Funciona; se escribe una fila en el historial |
| Arrastrar a "Entregado" (ganada) | Funciona; queda ganada con fecha de cierre = hoy |
| Arrastrar a "Perdida" | **Falla** (la perdida exige motivo y el arrastre no lo pide): la tarjeta vuelve y aparece "No se pudo cambiar la etapa." La interfaz para pedir el motivo es F2 |
| Sacar del cierre a una etapa abierta sin `oportunidades.reabrir` | Falla con el mismo aviso |
| Un Vendedor asigna la oportunidad a otra persona | Falla con "No se pudo guardar la oportunidad" |
| Editar una oportunidad cerrada | Funciona y queda auditado |

El embudo reparte las columnas con `lg:grid-cols-6`: está pensado para las seis etapas por defecto y no
para un embudo configurable (F2).

**Cómo verlo.** Cuenta Administrador: arrastrá una tarjeta de "Negociación" a "Entregado" y refrescá. Para
ver el historial hay que mirar la tabla (SQL Editor): `oportunidad_etapas_historial`.

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

- **8 archivos `*.check.ts`, 50 pruebas**, ejecutables con `node --test` y sin framework:
  `money` (10), `equipo` (3), `permisos` (7), `email/layout` (8), `alertas/plantillas` (10), `cuit` (3),
  `sitioweb` (2) y `clientes` (7).
- `permisos.check.ts` **lee la migración `0007`** y falla si el CHECK de `roles.permisos` o los roles por
  defecto divergen del catálogo de `src/lib/permisos.ts`.
- **3 scripts SQL con rollback** (`supabase/tests/`): `0005_permisos.sql` (aislamiento y permisos),
  `0007_reglas.sql` (cartera propia, reglas del embudo, historial, auditoría, catálogos, logo) y
  `0007_reejecucion.sql` (que la migración se pueda correr dos veces). Los casos negativos verifican el
  código y el mensaje del error, no solo que falle. El usuario ejecutó la migración y estas pruebas el
  2026-10-04.

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
| Estado, cierre, motivo, origen, probabilidad en oportunidades | Base lista, sin interfaz | F2 (2026-10-18) |
| Historial de etapas y auditoría | Base lista; se escribe en cada arrastre | Mostrarlo: F2 |
| `cambiar_etapa()` | Base lista; la interfaz todavía actualiza `etapa_id` directo | F2 |
| Actividades con tipo de catálogo, resultado y oportunidad | **Implementado** en las fichas de empresa y contacto (F1b); falta ofrecerlo desde la oportunidad | F2 |
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
| 6 | **Perdida exige motivo** | Una oportunidad no puede quedar perdida sin `motivo_perdida_id`. Arrastrar una tarjeta a "Perdida" falla hasta que F2 agregue el modal de motivo | Trigger `oportunidades_reglas` |
| 7 | **Ganada exige fecha real** | Si no viene, el trigger pone hoy | Ídem |
| 8 | **Reabrir exige permiso** | Pasar una oportunidad cerrada a una etapa abierta (o cambiar su resultado) requiere `oportunidades.reabrir`. Sin usuario (scripts, `service_role`) no se exige | Ídem |
| 9 | Asignar exige permiso | Crear una empresa, contacto u oportunidad para otra persona, o reasignarla, requiere `clientes.asignar` / `oportunidades.asignar`. Lo propio se asigna solo | Triggers `validar_responsable` |
| 10 | Editar una oportunidad cerrada se audita | Cada modificación queda en `oportunidad_auditoria` con `{campo: {antes, despues}}` | Trigger `oportunidades_auditar_cerrada` |
| 11 | Cada cambio de etapa se registra | También el alta (etapa anterior nula). Hoy no se ve en pantalla | Trigger `oportunidades_registrar_etapa` |
| 12 | Etapas con vocabulario del rubro | Consulta recibida, Relevamiento de cancha, Presupuesto enviado, Negociación, Entregado (ganada), Perdida. Renombradas en el lugar; solo las que conservaban el nombre por defecto | Sección 3 |
| 13 | Contactos con actividades no se borran | La clave foránea pasó de `set null` a `no action`. La baja es por estado | Sección 10 |
| 14 | Actividades | El autor es siempre quien escribe; el tipo viejo `consulta` se traduce a "Otro" | `bitacora_defaults` |
| 15 | Organización protegida | El administrador de un cliente no puede cambiar el nombre ni el estado (`activa`) de su organización | `organizaciones_proteger_plataforma` |
| 16 | Orden de despliegue | Aplicar la migración y desplegar enseguida | [deploy](./deploy.md) |

**Hoy desde la interfaz: qué sigue igual.** Cualquier pantalla de la segunda entrega sigue andando con la
base nueva (altas de empresas, contactos, oportunidades, bitácora y movimiento de tarjetas por
`etapa_id`), excepto los casos de la tabla de [b.8](#b8-oportunidades-y-embudo).

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
| Consultar detalles | I parcial | Acordeón y panel de edición; sin página de detalle (F1) |
| Relacionar contactos con empresas | I | `contactos.empresa_id` |
| Productos o servicios | I | ABM completo en `/productos` |
| Crear y modificar oportunidades; empresa o contacto; responsable; producto | I | `OportunidadForm.tsx` |
| Listado de oportunidades | I | `OportunidadesView.tsx` |
| Detalle de oportunidad | I parcial | Panel de edición; sin página de detalle (F2) |
| Embudo: oportunidades agrupadas por etapa | I | Columnas por etapa |
| Cambiar de etapa | I | Arrastre entre columnas |
| Conservar los cambios en la base | I | Escritura directa a `oportunidades.etapa_id` |

### e.2 Entrega final (12/11)

| Requisito | Estado | Evidencia y salvedades |
|---|---|---|
| Gestión de usuarios | I parcial | Invitar, cambiar rol, baja, reactivar, reenviar. No se editan nombre ni email |
| Roles administrador, vendedor y responsable comercial | I | Roles por defecto en `src/lib/permisos.ts` y en la 0007, aplicados en producción |
| Permisos según el rol | I | 19 permisos; RLS por permiso; `0005_permisos.sql` |
| Gestión completa de empresas y contactos | I parcial + B | Alta y edición básicas: I. Estado, responsable, origen, industria, sitio web, documento: B (F1) |
| Gestión de productos o servicios | I | `/productos`. No distingue producto de servicio |
| Asignación de responsables comerciales | I parcial + B | Oportunidades: I (formulario). Empresas y contactos: B (se asignan al creador; sin pantalla para elegir o reasignar) |
| Gestión completa de oportunidades | I parcial + B | Alta y edición: I. Estado, fechas, origen, motivo, probabilidad, tipo: B. Detalle: P (F2) |
| Embudo comercial configurable | B | Etapas con tipo y políticas de escritura en la base; sin pantalla (F1); columnas fijas en 6 |
| Cambio de etapas con historial | B | Cada cambio se registra; no se muestra (F2) |
| Registro de actividades realizadas | I parcial + B | Bitácora por empresa con 7 tipos: I. Catálogo de 12 tipos, resultado, oportunidad, cliente individual: B (F2) |
| Historial comercial de empresas, contactos y oportunidades | I parcial + P | Bitácora de empresa: I. Línea de tiempo de contacto, oportunidad y empresa unificada: P (F2 y F5) |
| Cierre de oportunidades ganadas o perdidas | B | Reglas en la base. Arrastrar a Entregado cierra como ganada; perdida exige el modal de F2 |
| Registro de motivos de pérdida | B | Catálogo y regla en la base; sin pantalla |
| Gestión de etapas, tipos de actividad, orígenes y motivos de pérdida | I (F1a) | `/configuracion` |
| Búsqueda, filtros y paginación | I parcial + P | Búsqueda en pantalla (sobre lo ya cargado) y filtros de etapa y de alertas: I. Búsqueda en servidor, filtros por responsable, estado y origen, y paginación: P (F3) |
| Adaptación real a la industria | I + B + P | Vida útil, snapshot, alertas de recambio, ventas por entrega: I. Embudo, orígenes, motivos y tipos del rubro, `tipo_cliente`: B. Canchas, parque instalado, licitaciones: P (F4) |
| Inteligencia artificial (opcional) | P | F7 |

### e.3 Usuarios del sistema (consigna, pp. 5 y 6)

| Rol y capacidad | Estado | Nota |
|---|---|---|
| Administrador: crea y modifica usuarios, asigna roles | I | `/usuarios` |
| Administrador: configura etapas, tipos de actividad, motivos y orígenes | I (F1a) | `/configuracion`, con `configuracion.gestionar` |
| Administrador: accede a toda la información | I | Rol con todos los permisos |
| Administrador y Responsable comercial: asignan y reasignan oportunidades | I | Formulario de oportunidad |
| Administrador y Responsable comercial: asignan y reasignan contactos | B | Sin pantalla |
| Vendedor: registra empresas y contactos; consulta los asignados; crea y actualiza oportunidades | I | Cartera propia aplicada por la base |
| Vendedor: cambia de etapa; registra actividades | I | Arrastre y bitácora |
| Vendedor: consulta el historial comercial | I parcial | Actividades en la ficha de empresa y de contacto; el historial de etapas, en F2 |
| Vendedor: marca ganadas o perdidas | I parcial + B | Ganada por arrastre a Entregado; perdida con motivo: B |
| Responsable comercial: consulta todo el equipo, supervisa abiertas, ve el embudo | I | Sin filtros por responsable en pantalla (F3) |
| Responsable comercial: historial de cada negociación | B | Se registra; sin pantalla (F2) |
| Responsable comercial: revisa ganadas y perdidas | I parcial | Aparecen como columnas del embudo; sin filtro por estado |

### e.4 Módulos principales

| Módulo | Estado | Observaciones |
|---|---|---|
| Módulo 1, empresa: datos mínimos | I (F1b: razón social, CUIT, tipo de cliente, email, teléfono, dirección, sitio web, estado, responsable, origen, observaciones) | |
| Módulo 1, contacto: datos mínimos | I (F1b: nombre, apellido, documento, cargo, email, teléfono, empresa opcional, estado, responsable, origen, observaciones) | |
| Estados potencial, cliente, inactivo, no contactar | I (F1b) | Pill con texto en listas y fichas; CHECK en la base |
| Baja lógica | I (F1b) | "Dar de baja" y "Reactivar" con confirmación; sin borrado en la interfaz. Con la 0008 aplicada la base tampoco deja borrar; ver [f](#f-seguridad-de-esta-versión) |
| Separación contacto / oportunidad | I | Entidades distintas |
| Módulo 2, datos mínimos de oportunidad | I (título, empresa/contacto, responsable, producto, valor, etapa, observaciones) · B (probabilidad, fechas de cierre, origen, estado, motivo) | |
| Estados abierta, ganada, perdida | B | Derivados del tipo de la etapa |
| Vistas: lista, individual, tablero; filtros por responsable, etapa, estado y origen | Lista y tablero I; filtro por etapa I; individual y demás filtros P | F2 y F3 |
| Cambio de etapa desde el detalle o el tablero | Tablero I; detalle P | F2 |
| Reglas del cambio de etapa (ocho condiciones) | B | Triggers y CHECK; probadas en `0007_reglas.sql` |
| Módulo 3, tipos mínimos de actividad (9) | B (12 sembrados); la pantalla usa 7 tipos propios | F2 |
| Módulo 3, datos mínimos de la actividad | I (F1b: tipo de catálogo, fecha y hora, usuario, empresa o contacto, descripción, resultado, oportunidad opcional) | |
| Historial cronológico en contacto, empresa y oportunidad | Empresa y contacto I (F1b); oportunidad P | F2 |
| Historial de etapas (oportunidad, anterior, nueva, fecha, usuario, observación) | B | `oportunidad_etapas_historial` |

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
| F2 | Oportunidades completas: detalle, cerrar ganada/perdida con modal de motivo, reabrir, reasignar, kanban dinámico con `cambiar_etapa`, línea de tiempo; actividades genéricas | 2026-10-18 | Planificado |
| F3 | Búsqueda, filtros y paginación en el servidor en todas las listas | 2026-10-22 | Planificado |
| F4 | Rubro: recambio en un clic, parque instalado, ficha de canchas, licitaciones | 2026-10-28 | Planificado |
| F5 | Ficha 360, tablero del responsable, conversión del embudo, búsqueda global Ctrl+K | 2026-11-02 | Planificado |
| F6 | Presupuesto imprimible; pruebas E2E con Playwright y CI en GitHub Actions | 2026-11-05 | Planificado |
| F7 | IA opcional: aviso de recambio y resumen de cuenta | 2026-11-08 | Planificado |
| F8 | Documentación (este conjunto, ya escrito) y manual de usuario en PDF | 2026-11-11 | En curso |

**Pendiente inmediato (no es una fase).**

- Regenerar `src/lib/supabase/types.ts` contra el proyecto real.
- Volver a correr `supabase/seeds/demo_catedra.sql` si la demo de producción es anterior a la 0007.
- Corregir el tablero para que no cuente oportunidades cerradas como abiertas.
- Decidir la licencia del repositorio.

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
| `oportunidades.asignar` | Oportunidades | Elegir o cambiar el responsable | `oportunidades.editar` | sí | no | sí | no |
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
| `/empresas/[id]` | `clientes.ver` | Ficha de la empresa: datos, contactos, oportunidades, ventas, actividades |
| `/contactos` | `clientes.ver` | Lista de contactos (de empresa e individuales) |
| `/contactos/[id]` | `clientes.ver` | Ficha del contacto |
| `/oportunidades` | `oportunidades.ver` | Embudo y listado |
| `/productos` | `productos.ver` | Catálogo |
| `/ventas` | `ventas.ver` | Historial de ventas |
| `/alertas` | `alertas.ver` | Recambios vencidos o por vencer |
| `/usuarios` | `usuarios.gestionar` | Usuarios y roles del cliente |
| `/configuracion` | `configuracion.gestionar` | Datos de la empresa y logo, etapas, tipos de actividad, orígenes y motivos de pérdida |
| `/sin-permisos` | Con sesión | Destino cuando el rol no tiene secciones |
| `/admin` | Superadmin | Panel de plataforma |

Rutas planificadas, aún inexistentes: `/oportunidades/[id]`, `/oportunidades/[id]/presupuesto`, `/tablero-comercial`.
