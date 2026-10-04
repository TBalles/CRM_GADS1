# Reglas de negocio

Cada regla del sistema, **dónde se hace cumplir** y en qué archivo está. El criterio de diseño es que las
reglas viven en la base de datos (triggers, restricciones y RLS) para que las cumplan todos los caminos:
el tablero, el formulario, la RPC y cualquier llamada directa. La interfaz solo esconde lo que no se puede
usar. Ver la [decisión 0004](./decisiones/0004-reglas-de-negocio-en-triggers.md).

**Cómo leer las columnas.**

- **Dónde**: `Trigger`, `Restricción` (CHECK, FK, UNIQUE), `RLS` (política de fila) o `UI` (solo
  pantalla; no es una garantía).
- **Interfaz**: **Sí** si la pantalla de hoy aplica o muestra la regla; **Sin interfaz** si la base ya la
  cumple pero ninguna pantalla la usa todavía; **Planificado** si no existe.

Contenido: [1. Vida útil y alertas](#1-vida-útil-y-alertas) · [2. Embudo y cierre](#2-embudo-y-cierre-de-oportunidades) ·
[3. Historial y auditoría](#3-historial-y-auditoría) · [4. Asignación y cartera propia](#4-asignación-y-cartera-propia) ·
[5. Baja lógica](#5-baja-lógica-y-lo-que-no-se-borra) · [6. Actividades](#6-actividades-bitácora) ·
[7. Permisos y roles](#7-permisos-y-roles) · [8. Usuarios y cuentas](#8-usuarios-organizaciones-y-cuentas) ·
[9. Logo y datos del proveedor](#9-logo-y-datos-del-proveedor) · [10. Reglas de interfaz](#10-reglas-de-interfaz) ·
[11. Reglas del rubro (F4)](#11-reglas-del-rubro-f4) · [12. Ficha 360, tablero y conversión (F5)](#12-ficha-360-tablero-del-responsable-y-conversión-f5)

---

## 1. Vida útil y alertas

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 1.1 | La vida útil de un producto es opcional, en meses y mayor que 0. Sin vida útil no hay seguimiento de recambio | Restricción (`check`) | `0003`, `productos.vida_util_meses` | Sí |
| 1.2 | **Snapshot.** Al insertar un ítem de venta sin vida útil, se **copia** la del producto. No se lee por join. Cambiar el catálogo después no mueve el vencimiento de lo ya entregado | Trigger `set_venta_items_defaults` (`venta_items_defaults()`) | `0003` | Sí |
| 1.3 | La fecha de entrega es propia de cada ítem (una venta puede entregarse en partes). Si no viene, hereda la fecha de la venta | Trigger `set_venta_items_defaults` | `0003`, commit `e58b5cd` | Sí |
| 1.4 | El vencimiento es `fecha_entrega + vida_util_meses`. El reloj arranca con la entrega, no con la factura | Vista `alertas_vida_util` | `0003` | Sí |
| 1.5 | **Ventana de alerta: 60 días.** Un equipo entra en la lista desde 60 días antes de vencer, y sigue mientras esté vencido | Vista `alertas_vida_util` (`<= current_date + 60`) | `0003` | Sí |
| 1.6 | Estado `vencido` si `vence_el <= hoy`; si no, `por_vencer` | Vista | `0003` | Sí |
| 1.7 | Las alertas pendientes **no se guardan**: se calculan en vivo. Solo se persiste lo enviado, y de ahí sale "último aviso" por ítem | Vista y tabla `alertas_enviadas` | `0003` | Sí |
| 1.8 | Un aviso solo se puede disparar sobre una alerta vigente: la acción lee la fila de la vista, no de las tablas | Servidor | `src/app/(app)/alertas/actions.ts`, `cargarAlerta()` | Sí |
| 1.9 | El destinatario y el texto del aviso **se derivan en el servidor** de la fila de la base; el navegador solo manda el id del ítem. Prefiere el mail y el teléfono del contacto; el de la empresa es el respaldo | Servidor | `actions.ts` | Sí |
| 1.10 | Enviar un aviso exige `alertas.enviar`, verificado antes de mandar. El registro en `alertas_enviadas` lo exige también la RLS | Servidor y RLS | `actions.ts`, `0005` | Sí |
| 1.11 | El envío lo confirma una persona. No hay envío automático | Diseño | FAQ de la landing | Sí |
| 1.12 | Si el mail salió pero no se pudo registrar, el mensaje dice explícitamente que no se vuelva a mandar | Servidor | `actions.ts` | Sí |

**Nota.** El valor 60 está repetido en la vista SQL, en el reloj de `AlertasView.tsx` y en textos de
pantalla. Cambiar la ventana exige tocar los tres.

---

## 2. Embudo y cierre de oportunidades

Reglas de `Módulos Principales` (módulo 2). Todas viven en el trigger `oportunidades_reglas`
(`oportunidad_reglas()`, migración `0007`) y en la restricción `oportunidades_estado_coherente`.
**Interfaz: desde F2** el tablero, la lista, el detalle y el modal de cierre piden lo que la base va a
exigir y traducen sus errores (columna final); lo que se ve en pantalla está detallado en
[las notas de versión](./notas-de-version.md#b8-oportunidades-y-embudo).

| # | Regla (consigna) | Cómo la cumple la base | Interfaz |
|---|---|---|---|
| 2.1 | Una única etapa actual | `oportunidades.etapa_id` es una columna, `not null` | Sí |
| 2.2 | El **estado sale del tipo de la etapa** (`abierta`, `ganada`, `perdida`). Pedir un estado distinto al de la etapa es un error ("La etapa elegida no es compatible con el estado...") | Trigger | Sí (F2): el estado se muestra con texto y no se edita a mano |
| 2.3 | Una oportunidad abierta no puede estar en una etapa ganada o perdida (y viceversa) | Trigger (el estado se fuerza al tipo de la etapa) y `oportunidades_estado_coherente` | Sí (F2): el estado no se edita; las columnas del tablero son solo las etapas abiertas |
| 2.4 | Una abierta no tiene `fecha_cierre` ni motivo de pérdida: se limpian | Trigger | Sí (F2): el formulario las muestra de solo lectura |
| 2.5 | **Ganada exige fecha real de cierre.** Si no viene, el trigger pone la fecha de hoy. Se limpia el motivo | Trigger | Sí (F2): el modal "Marcar ganada" propone hoy y no admite fecha futura |
| 2.6 | **Perdida exige fecha real y motivo de pérdida.** Sin motivo, error ("Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida.") | Trigger y CHECK | Sí (F2): el modal de cierre pide el motivo |
| 2.7 | **Una cerrada no vuelve a una etapa abierta sin autorización**: pasar de ganada o perdida a otro estado exige `oportunidades.reabrir` ("La oportunidad está cerrada: reabrirla requiere autorización") | Trigger (`tiene_permiso('oportunidades.reabrir')`) | Sí (F2): el tablero y el detalle solo ofrecen lo que el rol puede |
| 2.8 | Reabrir limpia fecha de cierre y motivo | Trigger | Sí (F2): "Reabrir" con la razón en el historial |
| 2.9 | Una cerrada que **sigue** cerrada no puede perder su fecha de cierre ("Una oportunidad cerrada tiene que tener fecha real de cierre.") | Trigger | Sí (F2) |
| 2.10 | Si se cambia el resultado (ganada a perdida o al revés), la fecha de cierre es la del **nuevo** cierre: la que mande quien cierra o, si no hay, hoy. La fecha del cierre anterior no cuenta | Trigger | Sí (F2): "Cambiar resultado" (ver 2.19) |
| 2.11 | Al **insertar**, el estado también se fuerza al tipo de la etapa: una oportunidad creada directamente en una etapa de cierre nace cerrada (y si es perdida exige motivo). Pedir un estado cerrado distinto al de la etapa es un error | Trigger (`tg_op = 'INSERT'`) | Sin interfaz |
| 2.12 | La probabilidad, si se usa, está entre 0 y 100 | Restricción | Sí (F2): el formulario valida el entero de 0 a 100 |
| 2.13 | El tipo de la oportunidad es `directa` o `licitacion`. Las reglas propias de las licitaciones (no ganar antes de la apertura) están en la [sección 11](#11-reglas-del-rubro-f4) | Restricción | Sí (F4) |
| 2.14 | **No se puede cambiar el tipo de una etapa que tiene oportunidades**: primero hay que moverlas ("La etapa ... tiene oportunidades: movelas antes de cambiarle el tipo.") | Trigger `etapas_validar_tipo` | Sin interfaz |
| 2.15 | Sin usuario (scripts, `service_role`, SQL Editor) las reglas de estado y fecha **valen**, pero el permiso de reabrir no se exige: esos caminos son de confianza | Trigger (`auth.uid() is not null`) | n/a |
| 2.16 | **La fecha real de cierre no puede ser futura** ("La fecha real de cierre no puede ser futura."). Se compara con la fecha de Argentina, no con la del servidor, y solo cuando la fecha cambia (o en un alta cerrada): editar otros campos de una cerrada ya guardada no la vuelve a juzgar | Trigger `oportunidad_reglas`, migración `0009` (pendiente de aplicar en la base viva) | Sí (F2): el modal no admite fecha futura y traduce el error |
| 2.17 | La fecha de cierre por defecto (cuando quien cierra no manda ninguna) es **hoy en Argentina**, no `current_date` del servidor | Trigger, `0009` | Sí (F2): el modal propone la de hoy |
| 2.18 | **Una oportunidad es de una empresa o de un contacto** ("La oportunidad tiene que ser de una empresa o de un contacto."). Se exige a los usuarios en el alta y cuando un cambio toca `empresa_id` o `contacto_id`; **no** a `service_role`, scripts ni al `on delete set null` de las claves foráneas, ni a una oportunidad vieja sin cliente mientras no se toque ese par | Trigger `oportunidades_requiere_cliente` (`auth.uid() is not null`), `0009` | Sí (F2): el formulario lo pide |
| 2.19 | Cambiar el resultado de una cerrada (ganada a perdida o al revés) toma la fecha del **nuevo** cierre: si se manda la misma fecha del cierre anterior, el trigger la entiende como "sin fecha" y pone la de hoy (regla 2.10) | Trigger | Sí (F2): "Cambiar resultado" exige la razón, el motivo si va a perdida y rechaza repetir la fecha anterior (salvo que sea hoy) |

Las reglas 2.16 a 2.18 llegan con la migración `0009`, que está en el repositorio y **todavía hay que
aplicarla a mano en Supabase** (junto con la `0008`). Hasta entonces las cumple la interfaz de F2 y la base no
las impone. Prueba: `supabase/tests/0009_reglas_oportunidades.sql`.

**Cómo se cambia de etapa.** Hay dos caminos con las mismas reglas porque las aplica el trigger:

1. Un `update` directo de `etapa_id` (ninguna pantalla lo usa desde F2; sigue valiendo para scripts).
2. La RPC `cambiar_etapa(oportunidad, etapa, observacion, motivo_perdida, fecha_cierre)`, que además
   deja la observación en el historial. Corre con los permisos de quien llama (`SECURITY INVOKER`): si la RLS
   no le muestra la oportunidad, devuelve "No existe la oportunidad o no tenés permiso para modificarla".
   **Es el único camino de la interfaz** (`src/lib/cambiarEtapa.ts`): arrastre del tablero, "Cambiar
   etapa", "Marcar ganada", "Marcar perdida" y "Reabrir".

**Etapas ganada y perdida.** La organización no puede quedarse sin ninguna etapa de tipo `ganada` ni sin
ninguna de tipo `perdida`: el trigger `etapas_conservar_cierres` (migración `0008`) rechaza borrar la última
de un tipo o cambiarle el tipo (error `23514`, "Tiene que quedar al menos una etapa de tipo…"). Borrar la
organización entera (cascada) no lo dispara. `/configuracion` lo avisa antes de intentarlo; el trigger es
la garantía de última línea. Prueba: `supabase/tests/0008_baja_logica.sql`.

---

## 3. Historial y auditoría

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 3.1 | **Cada cambio de etapa se conserva**: etapa anterior, etapa nueva, usuario (`auth.uid()`), fecha y hora, y observación | Trigger `oportunidades_registrar_etapa` (después de insertar o actualizar), `SECURITY DEFINER` | `0007` | Sí (F2): línea de tiempo del detalle de la oportunidad |
| 3.2 | El **alta** de una oportunidad registra su etapa inicial (`etapa_anterior_id` nulo). Así se puede responder "en qué etapa comenzó" | Trigger | `0007` | Sí (F2): se ve la etapa de alta |
| 3.3 | La observación llega por `current_setting('crm.observacion')`, que pone `cambiar_etapa()` y limpia al terminar. Un `update` directo la deja vacía | Trigger y RPC | `0007` | Sí (F2): el modal manda la observación; el arrastre del tablero no |
| 3.4 | Las oportunidades que ya existían al aplicar la 0007 arrancan su historial con la etapa **de ese momento**: no se inventa el recorrido que no quedó registrado | Bloque de datos de la migración | `0007` | n/a |
| 3.5 | **Editar una oportunidad que ya estaba cerrada queda registrado**: solo los campos que cambiaron, como `{campo: {antes, despues}}`. `updated_at` no cuenta | Trigger `oportunidades_auditar_cerrada` | `0007` | Sí (F2): sección "Cambios después del cierre" del detalle |
| 3.6 | El historial y la auditoría solo se escriben por trigger: no hay políticas de insert, update ni delete | RLS | `0007` | n/a |
| 3.7 | Se pueden leer si se puede ver la oportunidad (`oportunidades.ver` y cartera) | RLS | `0007` | Sí (F2) |
| 3.8 | Una oportunidad con historial no se puede borrar físicamente (clave foránea `no action`, a propósito y no `restrict`: así borrar una organización entera sigue funcionando porque su cascada borra todo en la misma sentencia) | Restricción | `0007` | n/a |

---

## 4. Asignación y cartera propia

La consigna pide que el vendedor vea solo los clientes asignados y que el responsable comercial y el
administrador vean todo. Ver la [decisión 0005](./decisiones/0005-cartera-propia-por-responsable.md).

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 4.1 | **Cartera propia.** Empresas, contactos y oportunidades se ven si el usuario tiene `clientes.ver_todos` o es el `responsable_id`. Vale para ver y editar (nadie borra: sin política de borrar en empresas, contactos ni oportunidades desde la `0008`) | RLS | `0007`, sección 12 | Sí: la pantalla muestra lo que la base devuelve |
| 4.2 | Un contacto también se ve si se ve su empresa | RLS | `0007` | Sí |
| 4.3 | Lo que **cuelga** de una empresa se ve si se ve la empresa: ventas, ítems, alertas enviadas, actividades (y la vista `alertas_vida_util`, que hereda por ser `security_invoker`) | RLS (subconsulta a `empresas` con la RLS de quien consulta) | `0007` | Sí |
| 4.4 | Las actividades también se ven si se ve su contacto o su oportunidad | RLS | `0007` | Sí |
| 4.5 | Alta sin responsable: queda asignada a **quien la crea** (la app vieja manda `null` explícito, por eso no alcanza con un `default`) | Trigger `validar_responsable` | `0007` | Sí (efecto automático) |
| 4.6 | **Asignar exige ver la cartera de todos**: en el catálogo, `clientes.asignar` y `oportunidades.asignar` requieren `clientes.ver_todos` (sin él, quien reasigna dejaría de ver el resultado y el selector no tendría a quién ofrecer). La pantalla de roles tilda la dependencia sola. Crear algo para otra persona, o **reasignar**, exige `clientes.asignar` (empresas y contactos) u `oportunidades.asignar` (oportunidades) ("No tenés permiso para asignar o reasignar el responsable.") | Trigger | `0007` | Sí: los formularios de empresa y contacto ofrecen el selector solo con `clientes.asignar` (sin él, solo lectura); el de oportunidades ya lo hacía |
| 4.7 | El responsable tiene que ser un usuario de la **misma organización** | Trigger | `0007` | Sí |
| 4.8 | Sin usuario (scripts, `service_role`) no se exige permiso de asignar | Trigger (`auth.uid() is null`) | `0007` | n/a |
| 4.9 | Los roles que ya veían clientes antes de la 0007 reciben `clientes.ver_todos` (para no quedar ciegos); los únicos con cartera propia son los vendedores (`Ventas`, `Vendedor`) | Bloque de datos, una sola vez | `0007`, sección 1 | n/a |
| 4.10 | Lo que no tiene responsable lo ven solo quienes tienen `clientes.ver_todos` | RLS | `0007` | Sí |
| 4.11 | **Escribir** una actividad exige más que ver una referencia: la empresa, el contacto y la oportunidad que vengan tienen que ser visibles para quien escribe y coherentes entre sí (el contacto, de esa empresa; la oportunidad, de esa empresa o sin empresa). Evita colgar una actividad en el cliente de otro usando la propia oportunidad como llave | RLS (`with check`) | `0007` | Sí |
| 4.12 | Reasignar la cartera existente: la empresa tomó el responsable de su oportunidad más reciente; el contacto, el de su oportunidad o el de su empresa. Una sola vez | Bloque de datos | `0007`, sección 7 | n/a |
| 4.13 | Asignar (`clientes.asignar`) **implica** ver la cartera de todos (`clientes.ver_todos`): el editor de roles lo tilda solo. Es una regla de la app (`conDependencias`), no del CHECK de la base | `src/lib/permisos.ts` | F1b | Sí |

---

## 5. Baja lógica y lo que no se borra

La consigna: los registros con información histórica no se eliminan; se cambia su estado.

| Entidad | Cómo se da de baja | Qué impide el borrado | Interfaz |
|---|---|---|---|
| Empresa, contacto | `estado = 'inactivo'` (también `no_contactar`) | La interfaz no ofrece borrar y, desde la `0008`, **la base tampoco lo permite** a un usuario (sin política `borrar`: el `DELETE` afecta 0 filas). Solo el borrado de una organización entera (superadmin) arrastra todo por `on delete cascade` | Sí (F1b): "Dar de baja" y "Reactivar" con confirmación; las dadas de baja se esconden tras el chip "Ver dadas de baja" |
| Oportunidad | Se marca perdida (con motivo) | **No hay política de borrar para nadie.** Su historial y auditoría la referencian sin cascada | Sí (F2): "Marcar perdida" con motivo |
| Producto | `activo = false` | `venta_items.producto_id` es `on delete restrict` | Sí (`/productos`, "Dar de baja") |
| Etapa, origen, motivo, tipo de actividad | `activo = false` (catálogos) | Las oportunidades y actividades viejas los referencian sin cascada | Sin interfaz |
| Usuario | `perfiles.activo = false` más ban en Auth | Se corta el acceso en la siguiente consulta aunque la sesión siga abierta | Sí (`/usuarios`) |
| Organización | `activa = false` (suspender) | Ningún usuario del cliente ve nada | Sí (`/admin`) |
| Rol | Reasignar a otro | No se borra un rol con usuarios (FK `restrict`); el Administrador no se borra | Sí |
| Bitácora, alertas enviadas | No se editan ni se borran (log) | Sin política de update ni delete | Sí |
| Venta | El único borrado que hace la interfaz es el deshacer interno de una venta cuyos ítems no se pudieron guardar | Política de borrar según `ventas.editar` | Parcial |

---

## 6. Actividades (bitácora)

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 6.1 | Una actividad es un hecho ya ocurrido. No hay tareas, agenda ni recordatorios | Diseño | consigna | Sí |
| 6.2 | Es un log: se agrega y no se corrige | RLS (sin update ni delete) | `0005`, `0007` | Sí |
| 6.3 | El autor es **siempre** quien la registra: se ignora un `autor_id` ajeno | Trigger `bitacora_defaults` | `0007` | Sí |
| 6.4 | Tiene que pertenecer a una empresa o a un contacto (o ambos) | Restricción `bitacora_entradas_empresa_o_contacto` | `0007` | Sí (F1b): desde la ficha del contacto, también el individual |
| 6.5 | Tipo de actividad de catálogo, obligatorio. La columna vieja `tipo` se traduce: si solo viene `tipo`, se busca el tipo por `codigo` (`consulta` pasa a "Otro"); si viene el tipo de catálogo, se completa el `tipo` viejo (los códigos fuera de los 6 históricos quedan como `nota`) | Trigger | `0007` | Sí (F1b): la pantalla manda `tipo_actividad_id`; `tipo` lo completa el trigger |
| 6.6 | Puede vincularse a una oportunidad y llevar un resultado | Columnas | `0007` | Sí (F1b): resultado y oportunidad en `ActividadForm` |
| 6.7 | Los 9 tipos mínimos de la consigna están sembrados, más 3 del rubro (Visita a cancha, Entrega de equipamiento, Reclamo) | `crear_catalogos_iniciales()` | `0007` | Sí (F1b): la pantalla ofrece los tipos activos del catálogo de la organización |

---

## 7. Permisos y roles

| # | Regla | Dónde | Fuente |
|---|---|---|---|
| 7.1 | La autorización real la hace la base: cada política RLS pide la organización propia **y** el permiso. Esconder un botón es comodidad | RLS | `0005`, `0007` |
| 7.2 | El catálogo es fijo en código (19 permisos) y cada cliente arma sus roles como conjuntos de esos permisos | `src/lib/permisos.ts` | |
| 7.3 | El CHECK de `roles.permisos` y los roles por defecto de SQL tienen que coincidir con el catálogo de TypeScript. El self-check lee `0007_entrega_final.sql` y falla si divergen | Restricción y `permisos.check.ts` | `0007` |
| 7.4 | **Dependencias entre permisos.** Al guardar un rol se agregan los que hacen falta (transitivamente): por ejemplo, `alertas.enviar` agrega `alertas.ver`, `ventas.ver`, `clientes.ver` y `productos.ver` | Servidor (`conDependencias`) | `guardarRol` en `usuarios/actions.ts` |
| 7.5 | El rol **Administrador** (`es_admin`) tiene todos los permisos, no se edita, no se borra y no se puede crear otro con esa marca | RLS | `0005` |
| 7.6 | Nadie puede cambiar su propio rol, darse de baja ni quitarle a su propio rol `usuarios.gestionar` (la organización nunca queda sin quien la administre) | Servidor | `usuarios/actions.ts` |
| 7.7 | Un rol no se borra si tiene usuarios asignados | Restricción (FK `restrict`) | `0005` |
| 7.8 | Al crear un usuario, el rol tiene que ser de la organización de quien lo crea (la verificación está en el servidor y la FK compuesta lo garantiza en la base) | Servidor y restricción | `usuarios/actions.ts`, `0005` |
| 7.9 | Un usuario dado de baja, o de una organización suspendida, no tiene ningún permiso: `org_actual()` es nulo y `tiene_permiso()` es falso | Funciones | `0004`, `0005` |
| 7.10 | Primera pantalla de un usuario: la primera que su rol permite, en el orden Inicio, Oportunidades, Empresas, Ventas, Alertas, Productos, Usuarios, Configuración; si no hay ninguna, `/sin-permisos` | `rutaInicial()` | `src/lib/permisos.ts` |

### Roles por defecto (Administrador, Vendedor, Responsable comercial, Solo lectura)

La matriz completa de los 19 permisos por rol está en las
[notas de versión](./notas-de-version.md#h3-catálogo-de-permisos). Resumen:

| Rol | Permisos | Cartera | Qué lo distingue |
|---|---|---|---|
| Administrador | 19 | Todo | Único con `usuarios.gestionar`, `configuracion.gestionar` y `productos.editar` |
| Vendedor | 12 | **Propia** | Edita clientes, oportunidades y ventas; escribe bitácora; envía alertas. No asigna ni reabre |
| Responsable comercial | 14 | Todo el equipo | Asigna clientes y oportunidades, reabre cerradas. No registra ventas ni envía alertas |
| Solo lectura | 3 | Todos los clientes | Ve clientes y catálogo; no ve oportunidades |

Los roles se renombraron en la 0007 (Ventas a Vendedor, Corporativo a Responsable comercial) en el lugar,
conservando el `id`.

---

## 8. Usuarios, organizaciones y cuentas

| # | Regla | Dónde | Fuente |
|---|---|---|---|
| 8.1 | No hay registro público: los usuarios los crean el superadmin y los administradores | Servidor y configuración de Supabase | `cuentas.ts` |
| 8.2 | La organización y el rol del alta salen de `raw_app_meta_data` (solo escribe el servidor), nunca de `raw_user_meta_data`. Si el rol no es de esa organización, el perfil queda sin rol, es decir sin permisos | Trigger `handle_new_user` | `0004`, `0005` |
| 8.3 | `es_superadmin` no se toma de ningún metadato: solo se asigna por SQL | Trigger | `0004` |
| 8.4 | El superadmin **no pertenece a ninguna organización**: no ve datos comerciales de ningún cliente | Datos y funciones | `0006` |
| 8.5 | Cada organización nueva arranca con 4 roles, 6 etapas del rubro y los catálogos | Trigger `organizaciones_inicial` | `0005`, `0007` |
| 8.6 | El administrador de un cliente no puede cambiar el nombre ni el estado (`activa`) de su organización | Trigger `organizaciones_proteger_plataforma` | `0007` |
| 8.7 | Las unicidades son por organización (nombre de producto, orden de etapa, nombre de rol, de origen, de motivo y de tipo) | Restricciones | `0004`, `0007` |
| 8.8 | Una cuenta se considera activada cuando la persona **definió su contraseña** (`activado_at`), no cuando tocó el link | Servidor | `definir-clave/actions.ts` |
| 8.9 | Mails de cuenta: 1 por minuto y 5 por hora por casilla y tipo | Función `registrar_envio_auth()` con lock | `0005` |
| 8.10 | `/recuperar` y el error de `/login` responden igual exista o no la cuenta (no se pueden enumerar emails ni invitaciones) | Servidor | `recuperar/actions.ts`, `login/actions.ts` |
| 8.11 | El destino `next` del link de un mail solo puede ser una ruta interna | Route handler | `auth/confirm/route.ts` |
| 8.12 | Los links de los mails se arman con `SITE_URL` (o el dominio de Vercel), nunca con el encabezado `Host` | Servidor | `sesion.ts`, `origenPublico()` |
| 8.13 | La contraseña tiene al menos 8 caracteres (la aplicación); Supabase puede ser más estricto | Servidor | `definir-clave/actions.ts` |

---

## 9. Logo y datos del proveedor

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 9.1 | El logo va en el bucket **privado** `logos`; solo `image/png`, `image/jpeg` o `image/webp`; hasta 1 MB (1.048.576 bytes) | Configuración del bucket (la aplica Storage al subir) | `0007`, sección 13 | Sin interfaz |
| 9.2 | **SVG rechazado a propósito**: un SVG subido por un usuario puede traer scripts. La ruta además se valida con una expresión regular que solo admite `png`, `jpg`, `jpeg` o `webp` | Política de `storage.objects` | `0007` | Sin interfaz |
| 9.3 | Ruta fija `{organizacion_id}/logo.{ext}`: un usuario solo ve y escribe en la carpeta de su organización | Políticas de `storage.objects` | `0007` | Sin interfaz |
| 9.4 | Lo ve cualquiera de la organización (va en los presupuestos, ver sección 13); lo sube, cambia o borra `configuracion.gestionar` | Políticas | `0007` | Sin interfaz |
| 9.5 | Los datos fiscales del proveedor (razón social, CUIT, condición de IVA, dirección, teléfono, email, sitio web, validez y condiciones de presupuesto) los edita `configuracion.gestionar` sobre su propia organización. La validez es mayor que 0 (por defecto 15 días); la condición de IVA es `responsable_inscripto`, `monotributo` o `exento` | RLS y restricciones | `0007` | Sin interfaz |

---

## 10. Reglas de interfaz

Estas no las garantiza la base; son convenciones de la aplicación.

| Regla | Dónde |
|---|---|
| Una actividad no puede tener fecha futura (es un hecho ya ocurrido); lo valida el formulario | `src/components/ActividadForm.tsx` |
| Los montos se ingresan con `MoneyInput` y se leen con `parseMoney` (máscara es-AR), nunca con `type="number"` | `src/lib/money.ts`, `src/components/ui/MoneyInput.tsx` |
| Cada pantalla se protege con `exigirPermiso()` y el menú solo muestra lo que el rol puede ver | `src/lib/sesion.ts`, `AppShell.tsx` |
| El mensaje de WhatsApp es más corto que el del mail; el verbo concuerda con la cantidad | `src/app/(app)/alertas/plantillas.ts` |
| El ícono de cada producto se elige por nombre y después por categoría | `src/lib/equipo.ts` |
| Tablas responsive en dos bloques (tarjetas en móvil, tabla en escritorio) | `docs/design-overrides.md` y regla #9 del kit |

---

## 11. Reglas del rubro (F4)

Las cargan los proveedores sobre **sus** clientes (clubes, complejos, escuelas, predios municipales); los
clientes no son usuarios del sistema. Todo lo de esta sección sale de la migración `0011`, que está en el
repositorio y **todavía hay que aplicarla a mano en Supabase** (`docs/deploy.md`). Mientras no esté, la
aplicación esconde estas secciones en vez de romperse: una lectura que falla porque falta la tabla o la columna
se reconoce con `esErrorDeEsquema` (`src/lib/esquema.ts`) y la sección simplemente no se dibuja; solo quien tiene
`configuracion.gestionar` ve un aviso "Se activa al aplicar la migración 0011". Prueba SQL:
`supabase/tests/0011_rubro.sql`.

| # | Regla | Dónde | Interfaz |
|---|---|---|---|
| 11.1 | **Ficha de canchas.** Una cancha pertenece a una empresa; tiene formato (`F5`, `F7`, `F9`, `F11`, `futsal`), superficie opcional (sintético, natural, cemento, parquet), cantidad (entero de 1 en adelante: una ficha puede representar varias canchas iguales) e iluminación | Tabla `canchas` y sus CHECK | Sí: sección "Canchas" de la ficha de empresa |
| 11.2 | **Las canchas siguen la empresa.** Ver exige `clientes.ver`; crear y editar, `clientes.editar`; la cartera propia se hereda de la empresa (un Vendedor ve y carga canchas solo de sus empresas). Las dos organizaciones no se ven entre sí | RLS (subconsulta a `empresas`) y clave foránea compuesta `(organizacion_id, empresa_id)` | Sí |
| 11.3 | **Las canchas no se borran**: se dan de baja con `activa = false` y se pueden reactivar. No hay política de borrar | RLS (sin `delete`) | Sí: "Dar de baja" y "Reactivar" |
| 11.4 | **Equipamiento sugerido.** Por cada cancha activa: 2 arcos y una red por arco (F5 y futsal 3 × 2 m; F7 6 × 2,10 m; F9 y F11 7,32 × 2,44 m), por la cantidad de canchas. Se compara con el parque instalado de la empresa por medida del arco (la medida se lee del nombre del producto) y se muestra "Le faltan 4 arcos de 3 × 2 m (F5)" o "Equipamiento completo". Las pelotas (2 por cancha) son una reserva opcional y no cuentan para decir "completo". Los equipos vencidos no se cuentan como cubiertos | Función pura `equipamientoSugerido` (`src/lib/canchas.ts`, con self-check) | Sí. **Es una sugerencia con medidas estándar, no un diagnóstico**: no sabe qué compró el cliente a otros proveedores ni el estado real de la cancha, y supone una red por arco |
| 11.5 | **Crear oportunidad desde la sugerencia**: título "Equipamiento para &lt;cancha&gt;" (o para la empresa si tiene varias fichas), origen "Visita a predio" si existe en el catálogo, responsable quien la crea, observaciones con lo que falta. Exige `oportunidades.editar` | UI + RLS de `oportunidades` | Sí |
| 11.6 | **Una licitación por oportunidad.** `licitaciones` guarda expediente, organismo, fecha de apertura (obligatoria), monto oficial y garantía (texto libre). `oportunidad_id` es único | Tabla `licitaciones`, restricción `unique` | Sí: bloque "Licitación municipal" del formulario y del detalle |
| 11.7 | **Las licitaciones siguen la oportunidad.** Ver: `oportunidades.ver`; crear y editar: `oportunidades.editar`; cartera propia heredada de la oportunidad. Sin política de borrar (se van con la organización) | RLS | Sí |
| 11.8 | **Una licitación no puede pasar a ganada antes de su fecha de apertura.** Se compara con la fecha de Argentina; el mismo día de la apertura ya se puede ("No se puede marcar ganada una licitación antes de su apertura (fecha de apertura: dd/mm/aaaa)"). Se juzga solo en la transición a ganada: una licitación ya ganada se sigue pudiendo editar. Rige para todos los caminos (usuario, RPC `cambiar_etapa`, script) | Trigger `oportunidades_licitacion_regla` (separado de `oportunidad_reglas`; calcula el tipo de la etapa por su cuenta) | Sí: el detalle avisa "Abre en N días", y el modal de cierre bloquea "Marcar ganada" con el mismo mensaje |
| 11.9 | **Una licitación sin datos tampoco se gana** ("Una licitación necesita sus datos (al menos la fecha de apertura)…"): no hay fecha contra la cual juzgarla. Vale también para una oportunidad que nace ya ganada | Trigger `oportunidades_licitacion_regla` | Sí: el detalle ofrece "Cargar datos" |
| 11.10 | El tipo (`directa` o `licitacion`) se elige en el formulario solo cuando la base tiene las tablas del rubro; al marcar licitación se propone el origen "Licitación municipal" si no hay otro. La lista filtra por tipo con `?tipo=` en el servidor | UI | Sí |
| 11.11 | **Recambio → oportunidad.** `oportunidades.venta_item_id` apunta al equipo entregado que origina la oportunidad (clave foránea compuesta a `venta_items`, `on delete set null`). Puede haber varias oportunidades por equipo a lo largo del tiempo, pero **una sola abierta**: lo garantiza la base con un índice único parcial (`oportunidades_venta_item_abierta_key` sobre `(organizacion_id, venta_item_id)` donde `estado = 'abierta'`, parte de la 0011); al cerrarse la primera se puede abrir otra. Error `23505` | Columna y FK | Sí |
| 11.12 | **Recambio en 1 clic.** Cada alerta ofrece "Crear oportunidad de recambio": título "Recambio: &lt;producto&gt; — &lt;empresa&gt;", empresa, contacto de la venta, producto, valor = precio × cantidad (sin precio cargado queda vacío), origen "Recambio por vida útil", primera etapa abierta, responsable quien la crea. Si ya hay una oportunidad **abierta** para ese equipo no se crea otra: **la base lo garantiza** (índice único de la regla 11.11) y la pantalla lo chequea antes solo para dar el camino amable ("Ya había una oportunidad abierta", con el link), también si la otra se creó entre el chequeo y el insert; la alerta muestra "Oportunidad abierta →" (una ganada o perdida no cuenta). Exige `oportunidades.editar` (el catálogo no tiene un permiso `oportunidades.crear`) | UI + RLS de `oportunidades` (`src/lib/recambio.ts`) | Sí. Se esconde si falta la columna `venta_item_id` |
| 11.13 | **Parque instalado.** La ficha de empresa lista lo que se le entregó (de `venta_items`), con el mismo reloj y la misma cuenta que `alertas_vida_util` (vence = entrega + vida útil; vencido si `vence <= hoy`; por vencer dentro de 60 días), agrupado en "Vencidos o que vencen hoy", por vencer, vigentes y sin seguimiento, con el total de unidades. Funciona con las tablas anteriores a la 0011. **Diferencia con la vista:** la vista usa `current_date` del servidor de la base (UTC en Supabase) y el parque, la fecha de Argentina; entre las 21:00 y las 24:00 un equipo que vence ese día puede figurar un día antes en `/alertas` que acá | Función pura `agruparParque` (`src/lib/parque.ts`) | Sí: exige `ventas.ver` |
| 11.14 | Al volver una oportunidad de licitación a **directa**, su fila de `licitaciones` **se conserva** (no se borra: así no se pierden el expediente y la apertura si se vuelve a marcar licitación). Mientras sea directa, la pantalla no la muestra y la regla de la apertura no la mira | Diseño | Sí |

**Límite conocido.** Si se cambia la fecha de apertura de una licitación que ya está ganada hacia el futuro, la base no
lo impide (la regla se juzga al ganar, no después).

---

## 12. Ficha 360, tablero del responsable y conversión (F5)

Son reglas de **interfaz y de cuenta**: ninguna escribe en la base ni agrega una tabla, así que la seguridad sigue
siendo la RLS (un Vendedor ve su cartera también acá). Los números salen de las filas que la pantalla recibe; las
funciones están en `src/lib/timeline360.ts`, `tablero.ts`, `embudo.ts` y `paleta.ts`, cada una con su self-check.

| # | Regla | Dónde | Interfaz |
|---|---|---|---|
| 12.1 | **Historia de la cuenta.** Junta, en una sola línea de tiempo y de más reciente a más viejo: actividades (`ocurrido_en`), altas de oportunidades (`created_at`), cambios de etapa (`cambiado_en`), compras (`ventas.fecha`, al mediodía argentino) y avisos de recambio enviados (`enviado_at`). A igual instante van primero el aviso, la compra, el cambio de etapa, el alta y la actividad; entre iguales, el orden de entrada. Se agrupa por **mes argentino**: un hecho de las 22:00 del 30 de septiembre no pasa a octubre | `src/lib/timeline360.ts` | Sí |
| 12.2 | **Qué cuenta como cambio de etapa en la historia.** La fila inicial del historial (sin etapa anterior) no es un cambio: el alta ya figura con su `created_at` real. Excepción: si esa fila ya cae en una etapa de cierre (oportunidad nacida o migrada cerrada) se muestra el cierre con la fecha de cierre de la oportunidad, no con la de la migración. El resto se titula como en el detalle (Cambio de etapa, Cierre, Reapertura, Cambio de resultado) | `armarEventos360` | Sí |
| 12.3 | **Qué empresa o contacto tiene cada hecho.** Empresa: actividades, oportunidades y ventas con su `empresa_id`; contacto: las de su `contacto_id`. Los avisos de recambio salen de los equipos de esas ventas (`alertas_enviadas` → `venta_items` → `ventas`) y solo los ve quien tiene `alertas.ver`. Cada parte se muestra solo si el rol puede verla (`bitacora.ver`, `oportunidades.ver`, `ventas.ver`, `alertas.ver`) | `src/lib/cuenta360.ts`, RLS | Sí |
| 12.4 | **Topes y recortes.** De cada tipo se trae lo más reciente hasta un tope **propio**: 200 actividades, 200 compras (con sus ítems y avisos), 200 cambios de etapa, 200 avisos y **100 oportunidades** (traen su historial incrustado). Se piden `tope + 1` filas para saber de verdad si hay más: una cuenta con exactamente el tope **no** se avisa como recortada. Si hay más, cada aviso nombra el tope real de ese tipo ("100 oportunidades", "200 compras"…), las secciones Oportunidades y Ventas muestran "100+" / "200+" y el resumen lo aclara ("entre las 100 más recientes"). "Ver 30 más" corta el trozo que ya se trajo; no vuelve a pedir nada. El **parque instalado** no usa estos topes: lee todos los equipos entregados a la empresa (hasta 1000 y, si hay más, lo avisa) | `TOPES` en `src/lib/cuenta360.ts` | Sí |
| 12.5 | **Resumen de la cuenta.** **Primera compra** = fecha de la primera venta de **toda** la cuenta, con una consulta aparte de una fila (`order fecha asc limit 1`), así es correcta aunque las ventas que se muestran estén recortadas; total comprado = suma de cantidad × precio de los ítems; oportunidades abiertas = las de estado `abierta` y la suma de sus montos; días desde el último contacto = días argentinos entre la última actividad y hoy. Tono: hasta 30 días "reciente", de 31 a 90 "conviene retomar" (ámbar), desde 91 "la cuenta se enfrió" (ámbar). Sin actividades se dice "Sin contactos registrados"; sin `bitacora.ver` no se afirma nada | `resumenCuenta` | Sí |
| 12.6 | **Acceso al tablero comercial y a la conversión.** Hacen falta `clientes.ver_todos` **y** `oportunidades.ver`: con cartera propia las cifras serían las de un solo vendedor, y sin oportunidades no hay qué contar. Quien no los tiene vuelve a su primera pantalla | `exigirPermiso` + `rutaInicial` | Sí |
| 12.7 | **Oportunidad sin actividad.** Una oportunidad **abierta** está quieta hace N días (7, 14 o 30; por defecto 14) si su última actividad —en la propia oportunidad o en su empresa o contacto— es de hace **N días o más** (el día N ya cuenta). Los cambios de etapa **no** cuentan como actividad. Si nunca hubo ninguna, se cuenta desde el alta. Las actividades se leen de los últimos 120 días (tope 1000): sin actividad en ese tramo la fila dice "más de" o "antes del" en vez de inventar una fecha. Si la lectura se cortó en el tope y no llega tan atrás como el umbral, la oportunidad **no se descarta**: va aparte, como "No se pudo comprobar" (`incierta`), y no cuenta en las cifras. Si hay más de 1000 abiertas se leen las **más antiguas** (las que más probablemente se enfriaron) y se avisa con la cantidad real. Se ordena por días y, a igual cantidad, por valor | `sinActividad`, `coberturaActividades` | Sí |
| 12.8 | **Ganadas y perdidas del mes.** Las oportunidades en estado `ganada` o `perdida` cuya **fecha real de cierre** (`fecha_cierre`) cae dentro del mes de `?mes=aaaa-mm` (por defecto el actual, en Argentina; un mes inválido vale el actual). Cantidad y monto; el ranking de motivos cuenta solo las perdidas | `rangoMes`, `resumenCierres`, `rankingMotivos` | Sí |
| 12.9 | **Conversión por etapa.** Se cuenta sobre la **cohorte**: las oportunidades dadas de alta (fecha argentina) entre `?desde` y `?hasta`, ambas inclusive, y del `?origen` elegido. *Entró* a una etapa abierta = tuvo al menos una fila del historial en ella (una que vuelve cuenta una vez; una que se la salteó no cuenta). *Avanzó* = después de la primera vez que entró, llegó a una etapa abierta de orden mayor o a una ganada; perder o volver atrás no es avanzar. Conversión = avanzaron ÷ entraron | `calcularEmbudo`, `filtrarCohorte` | Sí |
| 12.10 | **Tiempo en la etapa.** Cada estadía va de su fila del historial a la siguiente. La **mediana** usa las estadías terminadas (si la oportunidad se reabre y vuelve, son dos). Las que siguen ahí (oportunidad abierta, última fila) son *censuradas*: se cuentan aparte "hasta hoy" y nunca se mezclan con las terminadas en la cifra principal; son un piso, no un dato final | `calcularEmbudo` | Sí |
| 12.11 | **Tasa de éxito y ciclo.** Tasa = ganadas ÷ (ganadas + perdidas) por el estado actual (las abiertas no entran; sin cierres no hay tasa). Ciclo = días del alta a la fecha de cierre vigente, promedio por separado de las ganadas y las perdidas. Una oportunidad sin historial se supone en su etapa actual desde el alta y se avisa | `calcularEmbudo` | Sí |
| 12.12 | **Búsqueda global.** Una sola Server Action (`buscarGlobal`) con la sesión de la persona (no usa la clave de servicio): valida que el texto sea una cadena, lo limpia (controles, espacios, 100 caracteres) y exige 2 letras. Consulta solo las tablas que el rol puede ver (`clientes.ver`, `oportunidades.ver`, `productos.ver`), hasta 5 por grupo, con `filtroOr` (escapa `%`, `_`, `\`, comas y comillas) y cada palabra escrita tiene que aparecer en alguna columna. Lo que la RLS esconde no aparece. Una respuesta tardía de una búsqueda vieja se descarta | `src/app/(app)/buscar/actions.ts`, `src/lib/paleta.ts` | Sí |

---

## 13. Presupuesto imprimible (F6)

`/oportunidades/[id]/presupuesto` arma, numera, imprime y guarda como PDF el presupuesto de una oportunidad. Las cuentas
están en `src/lib/presupuesto.ts` (con self-check) y la persistencia en la migración `0012`, que está en el repositorio y
**todavía hay que aplicarla a mano** (`docs/deploy.md`). Mientras no esté, la pantalla funciona como borrador (se
reconoce con `esErrorDeEsquema`): se puede armar e imprimir, pero no se guarda ni se numera, y quien tiene
`configuracion.gestionar` ve el aviso "Se activa al aplicar la migración 0012". Prueba SQL:
`supabase/tests/0012_presupuestos.sql`.

| # | Regla | Dónde | Interfaz |
|---|---|---|---|
| 13.1 | **Acceso.** La pantalla pide `oportunidades.ver` y es un 404 si la oportunidad no existe o la RLS la esconde (la cartera de otra persona). Guardar pide `oportunidades.editar` | `exigirPermiso`, RLS | Sí: botón "Presupuesto" en el detalle de la oportunidad |
| 13.2 | **El documento es del proveedor, no de la plataforma.** El encabezado lleva el logo de la organización (URL firmada del bucket privado `logos`, `alt` = razón social) y sus datos: razón social, CUIT, condición frente al IVA, dirección, teléfono, mail y sitio web. Sin logo se imprime la razón social (o el nombre de la organización) en texto; **nunca** la marca de Tuco & Nito. Si no hay ningún dato, quien tiene `configuracion.gestionar` ve un aviso, que no se imprime, con el link a Configuración | `Hoja` en `PresupuestoView.tsx` | Sí |
| 13.3 | **Cliente.** Razón social, CUIT, dirección, teléfono y mail de la empresa de la oportunidad, y el contacto (nombre, cargo, mail, teléfono) como "Atención". Sin empresa se usa el contacto; sin ninguno, "A definir" | Lectura con la RLS de quien mira | Sí |
| 13.4 | **Líneas.** Cada línea tiene descripción (obligatoria), cantidad (mayor que 0), precio unitario (no negativo) y descuento de 0 a 100 %; se elige del catálogo (con el precio de lista de `productos.precio` ya cargado, editable) o es texto libre; se agregan, quitan y reordenan. Hasta 200 líneas. El borrador arranca con el producto de la oportunidad (o su valor estimado) | `validarLineas`, `problemaDelDocumento` | Sí |
| 13.5 | **Cuentas en centavos enteros.** Importe de la línea = cantidad × precio unitario (redondeado al centavo) − el descuento de esa línea; cada paso redondea al centavo **medio hacia arriba** (1,005 → 1,01). Ni `toFixed` ni sumas de flotantes | `importeLinea`, `aCentavos` | Sí |
| 13.6 | **Regla de IVA.** Si el proveedor es **Responsable Inscripto** los precios son **netos**: se muestra Subtotal, Descuentos, Neto gravado, **IVA 21 %** (sobre el neto total, redondeado una sola vez) y Total. Con **Monotributo**, **Exento** o sin condición cargada no se discrimina IVA: el total es el neto y la leyenda lo aclara ("Emisor Monotributista: no se discrimina IVA", "Emisor exento de IVA", "IVA según condición"). No se manejan alícuotas reducidas | `calcularTotales`, `leyendaIva` | Sí: el editor avisa "Cargá los precios sin IVA" para un Responsable Inscripto |
| 13.7 | **Validez y condiciones.** La validez arranca en `presupuesto_validez_dias` y las condiciones en `presupuesto_condiciones` de la organización (Configuración); ambas se pueden cambiar **solo para este presupuesto**. La validez es un entero de 1 a 365. "Válido hasta" = fecha de emisión + validez (aritmética de fechas sin zona horaria; la emisión es la fecha de Argentina **que pone la base**: el navegador no la manda) | `fechaVencimiento`, CHECK `validez_dias` | Sí |
| 13.8 | **Numeración.** Correlativa **por organización** (1, 2, 3…), asignada por la base al guardar: el trigger `presupuestos_numero` toma el número con `insert … on conflict do update … returning` sobre `presupuesto_contadores`, que bloquea esa fila hasta el fin de la transacción, así que dos altas simultáneas no reciben el mismo número; el `UNIQUE (organizacion_id, numero)` es la red de seguridad y el número que mande el cliente se ignora. Si el alta falla (CHECK, RLS, FK) el contador se revierte con ella: no deja huecos. En el mismo trigger la base fuerza `creado_por` al usuario que guarda (nadie figura como autor de otro) y deja `actividad_id` en nulo (el vínculo se completa después, nunca en el alta). `numero` tiene `default 0` y `check (numero > 0)`: el 0 solo existe para llegar al trigger. Se imprime **`N° 000042`** (seis cifras con ceros; más de un millón crece sin cortarse); sin número (borrador, o base sin la 0012) dice **«Borrador»**. No es una factura: no lleva punto de venta | Trigger y `formatearNumero` | Sí |
| 13.9 | **Un presupuesto emitido no se modifica ni se borra.** No hay política de borrar y el trigger `presupuestos_proteger` rechaza cualquier cambio salvo completar `actividad_id`, una sola vez (`23514`). Corregirlo es armar otro: "Usar como base de uno nuevo" copia sus líneas, validez y condiciones a un borrador. Si borran la actividad vinculada, el vínculo se suelta (no se traba el borrado). **Foto del emisor:** al guardar se copian `condicion_iva` y `emisor` (razón social, CUIT, dirección, teléfono, mail y web; no el logo). Reimprimir un presupuesto guardado calcula el IVA y muestra el encabezado **desde esa foto**, de modo que cambiar después la condición frente al IVA o el domicilio de la empresa no altera un presupuesto ya emitido (el total vuelve a coincidir con el guardado). El **logo** y los datos del **cliente y el contacto** se leen en vivo: no están en la foto | RLS, trigger | Sí |
| 13.10 | **Permisos de los presupuestos guardados.** Ver: `oportunidades.ver`; crear y editar (solo `actividad_id`): `oportunidades.editar`; cartera propia heredada de la oportunidad (un Vendedor ve solo los de sus oportunidades, salvo `clientes.ver_todos`). Dos organizaciones no se ven. `presupuesto_contadores` no se lee ni se escribe desde la API | RLS y privilegios | Sí |
| 13.11 | **Imprimir registra la actividad "Envío de propuesta"** en el historial de la oportunidad, la empresa y el contacto (tipo de `tipos_actividad` con código `propuesta`, o de nombre "Envío de propuesta"; si no existe o está inactivo, **se omite en silencio**). Solo para un presupuesto **guardado**, **una sola vez** (se anota en `actividad_id`: reimprimirlo, aunque sea otro día, no la repite; y el botón no se puede disparar dos veces a la vez: un doble clic registra una sola actividad) y solo si quien imprime puede escribir actividades (`bitacora.escribir`) y editar la oportunidad. Un borrador no registra nada. Si el registro falla, el PDF se genera igual y se avisa; si la actividad se inserta pero no se puede vincular al presupuesto, también se avisa («no se pudo vincular… no la cargues de nuevo») y esa pestaña no la vuelve a insertar | `registrarActividad` en `PresupuestoView.tsx` | Sí |
| 13.12 | **Papel.** El documento es blanco con texto oscuro en cualquier tema (representa papel; es la excepción documentada a "sin colores fijos"; no lleva color de acento porque el proveedor no tiene un color cargado). En `@media print` el menú, la barra móvil, los avisos, el editor y los botones no salen; la hoja se parte en páginas A4 vertical (márgenes de 14 mm), la fila de encabezado de la tabla se repite en cada página y una línea no se corta. El nombre sugerido del PDF es "Presupuesto N° … - cliente" | `globals.css` (`@media print`), `data-app-shell`/`data-app-chrome`/`data-app-main` en `AppShell` | Sí |
