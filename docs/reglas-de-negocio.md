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
[9. Logo y datos del proveedor](#9-logo-y-datos-del-proveedor) · [10. Reglas de interfaz](#10-reglas-de-interfaz)

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
**Interfaz: sin interfaz** para casi todas (ver la columna final); lo que sí rige en pantalla hoy está
detallado en [las notas de versión](./notas-de-version.md#b8-oportunidades-y-embudo).

| # | Regla (consigna) | Cómo la cumple la base | Interfaz |
|---|---|---|---|
| 2.1 | Una única etapa actual | `oportunidades.etapa_id` es una columna, `not null` | Sí |
| 2.2 | El **estado sale del tipo de la etapa** (`abierta`, `ganada`, `perdida`). Pedir un estado distinto al de la etapa es un error ("La etapa elegida no es compatible con el estado...") | Trigger | Sin interfaz |
| 2.3 | Una oportunidad abierta no puede estar en una etapa ganada o perdida (y viceversa) | Trigger (el estado se fuerza al tipo de la etapa) y `oportunidades_estado_coherente` | Sin interfaz |
| 2.4 | Una abierta no tiene `fecha_cierre` ni motivo de pérdida: se limpian | Trigger | Sin interfaz |
| 2.5 | **Ganada exige fecha real de cierre.** Si no viene, el trigger pone la fecha de hoy. Se limpia el motivo | Trigger | Parcial: arrastrar a "Entregado" cierra con fecha de hoy |
| 2.6 | **Perdida exige fecha real y motivo de pérdida.** Sin motivo, error ("Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida.") | Trigger y CHECK | Sin interfaz: arrastrar a "Perdida" hoy falla |
| 2.7 | **Una cerrada no vuelve a una etapa abierta sin autorización**: pasar de ganada o perdida a otro estado exige `oportunidades.reabrir` ("La oportunidad está cerrada: reabrirla requiere autorización") | Trigger (`tiene_permiso('oportunidades.reabrir')`) | Sin interfaz |
| 2.8 | Reabrir limpia fecha de cierre y motivo | Trigger | Sin interfaz |
| 2.9 | Una cerrada que **sigue** cerrada no puede perder su fecha de cierre ("Una oportunidad cerrada tiene que tener fecha real de cierre.") | Trigger | Sin interfaz |
| 2.10 | Si se cambia el resultado (ganada a perdida o al revés), la fecha de cierre es la del **nuevo** cierre: la que mande quien cierra o, si no hay, hoy. La fecha del cierre anterior no cuenta | Trigger | Sin interfaz |
| 2.11 | Al **insertar**, el estado también se fuerza al tipo de la etapa: una oportunidad creada directamente en una etapa de cierre nace cerrada (y si es perdida exige motivo). Pedir un estado cerrado distinto al de la etapa es un error | Trigger (`tg_op = 'INSERT'`) | Sin interfaz |
| 2.12 | La probabilidad, si se usa, está entre 0 y 100 | Restricción | Sin interfaz |
| 2.13 | El tipo de la oportunidad es `directa` o `licitacion`. **No hay todavía ninguna regla propia de licitaciones** (la regla "no se puede ganar antes de la fecha de apertura" es de F4, planificada) | Restricción | Planificado |
| 2.14 | **No se puede cambiar el tipo de una etapa que tiene oportunidades**: primero hay que moverlas ("La etapa ... tiene oportunidades: movelas antes de cambiarle el tipo.") | Trigger `etapas_validar_tipo` | Sin interfaz |
| 2.15 | Sin usuario (scripts, `service_role`, SQL Editor) las reglas de estado y fecha **valen**, pero el permiso de reabrir no se exige: esos caminos son de confianza | Trigger (`auth.uid() is not null`) | n/a |

**Cómo se cambia de etapa.** Hay dos caminos con las mismas reglas porque las aplica el trigger:

1. Un `update` directo de `etapa_id` (lo que hace hoy el arrastre del embudo).
2. La RPC `cambiar_etapa(oportunidad, etapa, observacion, motivo_perdida, fecha_cierre)`, que además
   deja la observación en el historial. Corre con los permisos de quien llama (`SECURITY INVOKER`): si la RLS
   no le muestra la oportunidad, devuelve "No existe la oportunidad o no tenés permiso para modificarla".
   La interfaz todavía no la usa (F2).

**Etapas ganada y perdida.** La organización no puede quedarse sin ninguna etapa de tipo `ganada` ni sin
ninguna de tipo `perdida`: el trigger `etapas_conservar_cierres` (migración `0008`) rechaza borrar la última
de un tipo o cambiarle el tipo (error `23514`, "Tiene que quedar al menos una etapa de tipo…"). Borrar la
organización entera (cascada) no lo dispara. `/configuracion` lo avisa antes de intentarlo; el trigger es
la garantía de última línea. Prueba: `supabase/tests/0008_baja_logica.sql`.

---

## 3. Historial y auditoría

| # | Regla | Dónde | Fuente | Interfaz |
|---|---|---|---|---|
| 3.1 | **Cada cambio de etapa se conserva**: etapa anterior, etapa nueva, usuario (`auth.uid()`), fecha y hora, y observación | Trigger `oportunidades_registrar_etapa` (después de insertar o actualizar), `SECURITY DEFINER` | `0007` | Se escribe; **sin interfaz** para leerlo |
| 3.2 | El **alta** de una oportunidad registra su etapa inicial (`etapa_anterior_id` nulo). Así se puede responder "en qué etapa comenzó" | Trigger | `0007` | Ídem |
| 3.3 | La observación llega por `current_setting('crm.observacion')`, que pone `cambiar_etapa()` y limpia al terminar. Un `update` directo la deja vacía | Trigger y RPC | `0007` | Ídem |
| 3.4 | Las oportunidades que ya existían al aplicar la 0007 arrancan su historial con la etapa **de ese momento**: no se inventa el recorrido que no quedó registrado | Bloque de datos de la migración | `0007` | n/a |
| 3.5 | **Editar una oportunidad que ya estaba cerrada queda registrado**: solo los campos que cambiaron, como `{campo: {antes, despues}}`. `updated_at` no cuenta | Trigger `oportunidades_auditar_cerrada` | `0007` | Se escribe; **sin interfaz** |
| 3.6 | El historial y la auditoría solo se escriben por trigger: no hay políticas de insert, update ni delete | RLS | `0007` | n/a |
| 3.7 | Se pueden leer si se puede ver la oportunidad (`oportunidades.ver` y cartera) | RLS | `0007` | Sin interfaz |
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
| 4.6 | Crear algo para otra persona, o **reasignar**, exige `clientes.asignar` (empresas y contactos) u `oportunidades.asignar` (oportunidades) ("No tenés permiso para asignar o reasignar el responsable.") | Trigger | `0007` | Sí: los formularios de empresa y contacto ofrecen el selector solo con `clientes.asignar` (sin él, solo lectura); el de oportunidades ya lo hacía |
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
| Oportunidad | Se marca perdida (con motivo) | **No hay política de borrar para nadie.** Su historial y auditoría la referencian sin cascada | Marcar perdida con motivo: sin interfaz |
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
| 9.4 | Lo ve cualquiera de la organización (irá en los presupuestos); lo sube, cambia o borra `configuracion.gestionar` | Políticas | `0007` | Sin interfaz |
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
