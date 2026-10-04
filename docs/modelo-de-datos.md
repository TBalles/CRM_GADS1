# Modelo de datos

Esquema `public` de Postgres (Supabase) tal como queda después de aplicar las migraciones `0001` a `0007`.
La fuente de verdad son los archivos de `supabase/migrations/`; este documento los resume.

**Estado de cada parte.** Las tablas, columnas y reglas de este documento existen en la base de producción
(la `0007` se aplicó el 2026-10-04). Las que la interfaz todavía no usa están marcadas como
**sin interfaz**. El archivo de tipos `src/lib/supabase/types.ts` **no se regeneró después de la 0007** y
refleja el esquema anterior (13 tablas): hay que regenerarlo antes de construir las pantallas nuevas.

Contenido: [Diagrama](#diagrama-entidad-relación) · [Convenciones](#convenciones-que-aplican-a-todo) ·
[Referencia por tabla](#referencia-por-tabla) · [Vista](#vista-alertas_vida_util) ·
[Funciones y triggers](#funciones-y-triggers) · [Storage](#storage-bucket-logos)

---

## Diagrama entidad-relación

Se muestran las columnas clave. Todas las tablas, salvo `organizaciones` y `envios_auth`, llevan además
`organizacion_id` (en `perfiles` es nulo solo para el superadmin), con clave foránea compuesta
`(organizacion_id, id)` hacia sus referenciadas (ver [convenciones](#convenciones-que-aplican-a-todo)).

```mermaid
erDiagram
    organizaciones ||--o{ perfiles : "tiene"
    organizaciones ||--o{ roles : "define"
    roles ||--o{ perfiles : "rol_id"

    empresas ||--o{ contactos : "empresa_id"
    empresas ||--o{ oportunidades : "empresa_id"
    contactos ||--o{ oportunidades : "contacto_id"
    productos ||--o{ oportunidades : "producto_id"
    etapas ||--o{ oportunidades : "etapa_id"
    perfiles ||--o{ oportunidades : "responsable_id"
    perfiles ||--o{ empresas : "responsable_id"
    perfiles ||--o{ contactos : "responsable_id"
    origenes ||--o{ empresas : "origen_id"
    origenes ||--o{ contactos : "origen_id"
    origenes ||--o{ oportunidades : "origen_id"
    motivos_perdida ||--o{ oportunidades : "motivo_perdida_id"

    empresas ||--o{ ventas : "empresa_id"
    contactos |o--o{ ventas : "contacto_id"
    oportunidades |o--o{ ventas : "oportunidad_id"
    ventas ||--|{ venta_items : "venta_id"
    productos ||--o{ venta_items : "producto_id"
    venta_items ||--o{ alertas_enviadas : "venta_item_id"

    empresas |o--o{ bitacora_entradas : "empresa_id"
    contactos |o--o{ bitacora_entradas : "contacto_id"
    oportunidades |o--o{ bitacora_entradas : "oportunidad_id"
    tipos_actividad ||--o{ bitacora_entradas : "tipo_actividad_id"

    oportunidades ||--o{ oportunidad_etapas_historial : "oportunidad_id"
    etapas ||--o{ oportunidad_etapas_historial : "etapa_nueva_id"
    oportunidades ||--o{ oportunidad_auditoria : "oportunidad_id"

    organizaciones {
        uuid id PK
        text nombre
        boolean activa
        text razon_social "datos fiscales, sin interfaz"
        text logo_path "sin interfaz"
    }
    perfiles {
        uuid id PK "igual a auth.users.id"
        uuid organizacion_id FK "nulo solo para el superadmin"
        uuid rol_id FK
        boolean es_superadmin
        boolean activo
        timestamptz activado_at
    }
    roles {
        uuid id PK
        uuid organizacion_id FK
        text nombre
        boolean es_admin
        text_array permisos "19 claves del catalogo"
    }
    empresas {
        uuid id PK
        text nombre
        text cuit
        text estado "potencial cliente inactivo no_contactar"
        uuid responsable_id FK
        uuid origen_id FK
        text tipo_cliente
    }
    contactos {
        uuid id PK
        uuid empresa_id FK "opcional"
        text nombre
        text estado
        uuid responsable_id FK
        text documento
    }
    productos {
        uuid id PK
        text nombre
        int vida_util_meses "nulo es sin seguimiento"
        boolean activo
    }
    etapas {
        uuid id PK
        text nombre
        int orden
        text tipo "abierta ganada perdida"
    }
    oportunidades {
        uuid id PK
        text titulo
        uuid etapa_id FK
        text estado "abierta ganada perdida"
        date fecha_cierre
        uuid motivo_perdida_id FK
        int probabilidad
        text tipo "directa licitacion"
    }
    ventas {
        uuid id PK
        uuid empresa_id FK
        date fecha
    }
    venta_items {
        uuid id PK
        uuid venta_id FK
        uuid producto_id FK
        date fecha_entrega
        int vida_util_meses "copia del catalogo"
    }
    bitacora_entradas {
        uuid id PK
        uuid tipo_actividad_id FK
        uuid autor_id FK
        timestamptz ocurrido_en
        text resultado
    }
    alertas_enviadas {
        uuid id PK
        uuid venta_item_id FK
        text canal "email whatsapp"
    }
    oportunidad_etapas_historial {
        uuid id PK
        uuid etapa_anterior_id FK "nulo en el alta"
        uuid usuario_id FK
        timestamptz cambiado_en
    }
    oportunidad_auditoria {
        uuid id PK
        jsonb cambios "campo: antes, despues"
    }
    origenes {
        uuid id PK
        text nombre
        boolean activo
    }
    motivos_perdida {
        uuid id PK
        text nombre
        boolean activo
    }
    tipos_actividad {
        uuid id PK
        text nombre
        text codigo
    }
```

La tabla `envios_auth` (registro de mails de cuenta, para el límite de envíos) no se dibuja: no se
relaciona con ninguna otra.

---

## Convenciones que aplican a todo

| Convención | Detalle |
|---|---|
| Organización | Cada tabla de datos tiene `organizacion_id uuid not null default org_actual()`. El `WITH CHECK` de la política rechaza cualquier valor que no sea la organización propia |
| FK compuestas | Toda referencia entre tablas de datos (salvo las que apuntan a `perfiles`: responsable, autor, usuario) es `(organizacion_id, x_id) → tabla (organizacion_id, id)`, con una restricción `unique (organizacion_id, id)` en el lado referenciado. La base impide así cruzar datos entre clientes |
| Unicidades por cliente | `productos (organizacion_id, nombre)`, `etapas (organizacion_id, orden)`, `roles (organizacion_id, nombre)`, `origenes`, `motivos_perdida` y `tipos_actividad` por `(organizacion_id, nombre)` |
| Baja lógica | `productos.activo`, catálogos con `activo`, empresas y contactos con `estado = 'inactivo'`, usuarios con `perfiles.activo`, organizaciones con `activa`. Las oportunidades no se borran (sin política de borrado) |
| Registros inmutables | `bitacora_entradas`, `alertas_enviadas`, `oportunidad_etapas_historial` y `oportunidad_auditoria` no tienen política de update ni delete |
| Nombres | Tablas, columnas, rutas y textos en español, consistente con el dominio |
| Identificadores | `uuid` generados con `gen_random_uuid()`; `envios_auth.id` es `bigint generated always as identity` |
| RLS | Habilitado en las 18 tablas. `envios_auth` no tiene políticas: solo la toca el servidor con `service_role` |
| Evaluación de funciones en RLS | Las políticas usan `(select public.org_actual())` y `(select public.tiene_permiso(...))` para que Postgres evalúe la función una vez por consulta y no una vez por fila |

**Cómo se lee "RLS" en las tablas de abajo.** "Cartera" significa: `clientes.ver_todos` o ser el responsable
de la fila (para lo que cuelga de una empresa, poder ver la empresa). "Org" significa
`organizacion_id = org_actual()`.

---

## Referencia por tabla

### Núcleo de plataforma

#### `organizaciones`

| | |
|---|---|
| Propósito | Un cliente del CRM (tenant). Guarda también los datos fiscales del proveedor para presupuestos |
| Columnas clave | `id`, `nombre`, `activa`, `created_at`. Desde la 0007 (**sin interfaz**): `razon_social`, `cuit`, `condicion_iva` (`responsable_inscripto`, `monotributo`, `exento`), `direccion`, `telefono`, `email`, `sitio_web`, `logo_path`, `presupuesto_validez_dias` (por defecto 15, mayor que 0), `presupuesto_condiciones` |
| Claves foráneas | Ninguna |
| RLS | Ver: la propia o superadmin. Superadmin: todo. Actualizar: `configuracion.gestionar` sobre la propia. El trigger `organizaciones_proteger_plataforma` impide que un usuario final cambie `id`, `nombre`, `activa` o `created_at` |
| Notas | Un trigger `organizaciones_inicial` crea al insertar: 4 roles, 6 etapas del rubro y los catálogos. La organización con id fijo `00000000-0000-0000-0000-000000000001` ("Tuco & Nito (demo)") es de la migración `0004` |

#### `perfiles`

| | |
|---|---|
| Propósito | Espejo liviano de `auth.users` y vínculo de cada usuario con su organización y su rol |
| Columnas clave | `id` (= `auth.users.id`), `nombre`, `email`, `organizacion_id`, `rol_id`, `es_superadmin`, `activo`, `activado_at` |
| Claves foráneas | `id → auth.users` (cascade); `organizacion_id → organizaciones` (cascade); `(organizacion_id, rol_id) → roles` (restrict) |
| Restricciones | `perfiles_org_o_superadmin`: sin organización solo si es superadmin |
| RLS | Ver: uno mismo, los de la organización o el superadmin. **Sin políticas de escritura**: ni el rol ni la organización los cambia un usuario; lo hace el servidor con `service_role` |
| Notas | `activado_at` nulo significa invitación pendiente. Se completa solo por el trigger `on_auth_user_created` (`handle_new_user`), que lee la organización y el rol de `raw_app_meta_data` |

#### `roles`

| | |
|---|---|
| Propósito | Conjunto de permisos con nombre, propio de cada organización |
| Columnas clave | `id`, `organizacion_id`, `nombre`, `descripcion`, `es_admin`, `permisos text[]` |
| Restricciones | `roles_permisos_validos`: `permisos` solo puede contener las 19 claves del catálogo. `unique (organizacion_id, nombre)` |
| RLS | Ver: la organización o el superadmin. Crear, editar, borrar: `usuarios.gestionar` y `not es_admin` (el rol Administrador no se toca) |
| Notas | El catálogo de claves está en `src/lib/permisos.ts` y debe coincidir con el CHECK; lo verifica `permisos.check.ts` |

#### `envios_auth`

| | |
|---|---|
| Propósito | Registro de los mails de cuenta enviados, para limitar la frecuencia |
| Columnas clave | `id`, `email`, `tipo` (`activacion`, `recuperacion`), `created_at` |
| RLS | Habilitado, sin políticas: solo `service_role`. `registrar_envio_auth()` está revocada a `public`, `anon` y `authenticated` |

### Clientes

#### `empresas`

| | |
|---|---|
| Propósito | Clubes, complejos, escuelas, colegios, predios municipales |
| Columnas de la 1ª versión | `nombre`, `cuit`, `telefono`, `email`, `direccion`, `notas` |
| Columnas de la 0007 (**sin interfaz**) | `estado` (`potencial`, `cliente`, `inactivo`, `no_contactar`; por defecto `potencial`), `responsable_id`, `origen_id`, `tipo_cliente` (`club`, `complejo_f5`, `escuela_futbol`, `predio_municipal`, `colegio`, `otro`), `sitio_web` |
| Claves foráneas | `responsable_id → perfiles` (set null); `(organizacion_id, origen_id) → origenes` |
| RLS | Ver, editar, borrar: Org y `clientes.ver`/`clientes.editar` y Cartera. Crear: Org y `clientes.editar` |
| Notas | Trigger `validar_responsable('clientes.asignar')`. La política de borrar sigue vigente (ver [seguridad](./seguridad.md)); la interfaz no borra |

#### `contactos`

| | |
|---|---|
| Propósito | Personas; pueden existir sin empresa (cliente individual) |
| Columnas | `empresa_id` (opcional), `nombre`, `apellido`, `email`, `telefono`, `cargo`, `notas`. Desde la 0007 (**sin interfaz**): `estado`, `responsable_id`, `origen_id`, `documento` |
| Claves foráneas | `(organizacion_id, empresa_id) → empresas` (set null en `empresa_id`); `responsable_id → perfiles` (set null); `(organizacion_id, origen_id) → origenes` |
| RLS | Igual que `empresas`, y además se ve si la empresa del contacto es visible |
| Notas | Un contacto con actividades no se puede borrar (la FK desde `bitacora_entradas` es `no action`) |

### Catálogo y comercial

#### `productos`

| | |
|---|---|
| Propósito | Catálogo de equipamiento con su vida útil |
| Columnas | `nombre`, `descripcion`, `marca`, `categoria`, `precio numeric(12,2)`, `activo`, `vida_util_meses` (mayor que 0 o nulo = sin seguimiento de recambio) |
| RLS | Ver: `productos.ver`. Crear, editar, borrar: `productos.editar` (siempre dentro de la organización) |
| Notas | Se da de baja con `activo = false`. `venta_items.producto_id` es `restrict` |

#### `etapas`

| | |
|---|---|
| Propósito | Etapas del embudo de cada organización |
| Columnas | `nombre`, `orden`, `color`, `tipo` (`abierta`, `ganada`, `perdida`; 0007) |
| RLS | Ver: cualquier usuario de la organización. Crear, editar, borrar: `configuracion.gestionar` (**sin interfaz**) |
| Notas | El `tipo` define el `estado` de las oportunidades que están en la etapa. El trigger `etapas_validar_tipo` impide cambiar el tipo de una etapa con oportunidades. Embudo por defecto: Consulta recibida, Relevamiento de cancha, Presupuesto enviado, Negociación, Entregado (ganada), Perdida |

#### `oportunidades`

| | |
|---|---|
| Propósito | Una negociación comercial concreta |
| Columnas de la 1ª versión | `titulo`, `empresa_id`, `contacto_id`, `producto_id`, `responsable_id`, `etapa_id`, `monto`, `notas`, `created_at`, `updated_at` |
| Columnas de la 0007 (**sin interfaz**) | `estado` (`abierta`, `ganada`, `perdida`), `fecha_estimada_cierre`, `fecha_cierre`, `origen_id`, `motivo_perdida_id`, `probabilidad` (0 a 100), `tipo` (`directa`, `licitacion`) |
| Claves foráneas | Compuestas a `empresas`, `contactos`, `productos` (las tres con set null de su columna), `etapas`, `origenes`, `motivos_perdida`; `responsable_id → perfiles` (set null) |
| Restricción | `oportunidades_estado_coherente`: abierta sin fecha ni motivo; ganada con fecha y sin motivo; perdida con ambos |
| RLS | Ver, editar: `oportunidades.ver`/`oportunidades.editar` y Cartera. Crear: `oportunidades.editar`. **Sin política de borrar** |
| Triggers | `oportunidades_reglas`, `oportunidades_validar_responsable`, `set_oportunidades_updated_at` (antes); `oportunidades_registrar_etapa`, `oportunidades_auditar_cerrada` (después) |

#### `ventas` y `venta_items`

| | |
|---|---|
| Propósito | El hecho consumado: qué se vendió y cuándo se entregó. Es distinto de la oportunidad (el embudo) |
| `ventas` | `empresa_id` (obligatoria, cascade), `contacto_id`, `oportunidad_id` (ambos set null), `fecha`, `comprobante`, `notas` |
| `venta_items` | `venta_id` (cascade), `producto_id` (**restrict**), `cantidad` (mayor que 0), `precio_unitario`, `fecha_entrega`, `vida_util_meses` |
| RLS | Ver y editar según `ventas.ver`/`ventas.editar`; Cartera por la empresa (los ítems, por su venta) |
| Notas | El trigger `set_venta_items_defaults` copia `vida_util_meses` del producto y toma `fecha_entrega` de la venta cuando vienen vacíos. La copia es un snapshot a propósito |

#### `alertas_enviadas`

| | |
|---|---|
| Propósito | Registro de cada aviso de recambio enviado. Solo se guarda lo enviado; las pendientes se calculan |
| Columnas | `venta_item_id` (cascade), `canal` (`email`, `whatsapp`), `destinatario`, `mensaje`, `enviado_por`, `enviado_at` |
| RLS | Ver: `alertas.ver` y Cartera. Crear: `alertas.enviar`. Sin update ni delete |

### Actividad e historial

#### `bitacora_entradas` (las "actividades")

| | |
|---|---|
| Propósito | Interacciones comerciales ya ocurridas. Es un log: se agrega, no se corrige |
| Columnas de la 1ª versión | `empresa_id`, `contacto_id`, `tipo` (texto), `titulo`, `detalle`, `autor_id`, `ocurrido_en` |
| Columnas de la 0007 | `tipo_actividad_id` (obligatoria), `oportunidad_id`, `resultado`; `empresa_id` pasa a ser opcional |
| Restricción | `bitacora_entradas_empresa_o_contacto`: al menos una de las dos |
| Claves foráneas | `(organizacion_id, empresa_id)` cascade; `contacto_id` **no action**; `oportunidad_id` set null; `tipo_actividad_id` |
| RLS | Ver: `bitacora.ver` y (todo, o empresa, contacto u oportunidad visibles). Crear: `bitacora.escribir` y cada referencia visible y coherente entre sí. Sin update ni delete |
| Notas | La columna `tipo` es la heredada de la primera versión (su CHECK se eliminó); el trigger `bitacora_defaults` la mantiene sincronizada con el tipo de catálogo y fuerza `autor_id = auth.uid()` |

#### `oportunidad_etapas_historial`

| | |
|---|---|
| Propósito | Cada cambio de etapa: de dónde, a dónde, cuándo, quién y por qué. El alta registra una fila con `etapa_anterior_id` nulo |
| Columnas | `oportunidad_id`, `etapa_anterior_id`, `etapa_nueva_id`, `usuario_id`, `observacion`, `cambiado_en` |
| Claves foráneas | A `oportunidades` y `etapas` con **no action** (una oportunidad con historial no se borra) |
| RLS | Ver: `oportunidades.ver` y poder ver la oportunidad. Sin políticas de escritura; la escribe el trigger `oportunidad_registrar_etapa` (`SECURITY DEFINER`) |
| Estado | Se escribe en cada alta y cambio de etapa. **Sin interfaz** para leerlo |

#### `oportunidad_auditoria`

| | |
|---|---|
| Propósito | Toda modificación de una oportunidad que ya estaba cerrada: `cambios = {campo: {antes, despues}}` |
| Columnas | `oportunidad_id`, `usuario_id`, `cambios jsonb`, `cambiado_en` |
| RLS | Igual que el historial. La escribe `oportunidad_auditar_cerrada` |
| Estado | **Sin interfaz** |

### Catálogos configurables (0007, **sin interfaz**)

| Tabla | Propósito | Columnas | Valores iniciales |
|---|---|---|---|
| `origenes` | De dónde vino el cliente u oportunidad | `nombre`, `activo`, `orden` | Recambio por vida útil, Referido de otro club, Licitación municipal, Redes sociales, Web, Visita a predio, Torneo / feria |
| `motivos_perdida` | Por qué se perdió una oportunidad | `nombre`, `activo`, `orden` | Precio, Eligió otro proveedor, Sin presupuesto del club, Licitación adjudicada a otro, Plazo de entrega, Pospone a la próxima temporada, Dato histórico sin motivo |
| `tipos_actividad` | Tipos de actividad | `nombre`, `codigo`, `activo`, `orden` | Llamada, Correo electrónico, Mensaje, Reunión presencial, Reunión virtual, Demostración, Envío de propuesta, Visita a cancha, Entrega de equipamiento, Reclamo, Nota interna, Otro |

RLS de los tres: ver, con la organización y alguno de los permisos de uso (`origenes`: `clientes.ver` u
`oportunidades.ver`; `motivos_perdida`: `oportunidades.ver`; `tipos_actividad`: `bitacora.ver`) o
`configuracion.gestionar`; crear, editar y borrar: `configuracion.gestionar`. Se dan de baja con
`activo = false` porque lo ya registrado los sigue referenciando (FK sin cascada). `tipos_actividad.codigo`
es la clave estable de los tipos de sistema y mapea los valores viejos de `bitacora_entradas.tipo`.

---

## Vista `alertas_vida_util`

| | |
|---|---|
| Propósito | Equipos entregados que vencieron o vencen en los próximos 60 días. Se calcula en vivo; no hay cron |
| Definición | `venta_items` ⨝ `ventas` ⨝ `empresas` ⨝ `productos`, con `contactos` y el último envío por ítem (`left join lateral` sobre `alertas_enviadas`) |
| Filtro | `vida_util_meses` y `fecha_entrega` no nulos, y `fecha_entrega + vida_util_meses meses <= current_date + 60` |
| Columnas calculadas | `vence_el`, `dias_restantes`, `estado` (`vencido` si `vence_el <= hoy`, si no `por_vencer`), `ultimo_envio`, `ultimo_canal` |
| Seguridad | `security_invoker = on`: respeta la RLS de quien consulta. Como hace join con `empresas`, un Vendedor solo ve las de su cartera sin tocarla |

---

## Funciones y triggers

| Función | Tipo | Para qué |
|---|---|---|
| `org_actual()`, `es_superadmin()`, `tiene_permiso(p)` | `SECURITY DEFINER`, `stable` | Contexto de las políticas RLS |
| `handle_new_user()` | Trigger sobre `auth.users` | Crea el `perfil` leyendo organización y rol de `raw_app_meta_data` |
| `organizacion_inicial()` | Trigger sobre `organizaciones` | Roles, embudo y catálogos de una organización nueva |
| `crear_roles_iniciales(uuid)`, `crear_catalogos_iniciales(uuid)` | Revocadas a usuarios finales | Siembra de roles y catálogos |
| `registrar_envio_auth(email, tipo)` | Revocada a usuarios finales | Límite de mails de cuenta con lock |
| `venta_items_defaults()` | Trigger | Snapshot de vida útil y fecha de entrega |
| `validar_responsable()` | Trigger (empresas, contactos, oportunidades) | Asignación y mismo cliente |
| `oportunidad_reglas()` | Trigger antes de insertar o actualizar | Estado desde la etapa, cierre, reapertura |
| `oportunidad_registrar_etapa()` | Trigger después, `SECURITY DEFINER` | Historial de etapas |
| `oportunidad_auditar_cerrada()` | Trigger después, `SECURITY DEFINER` | Auditoría de cerradas |
| `etapas_validar_tipo()` | Trigger, `SECURITY DEFINER` | No cambiar el tipo de una etapa con oportunidades |
| `bitacora_defaults()` | Trigger | Autor y tipo de catálogo |
| `organizaciones_proteger_plataforma()` | Trigger | Nombre y estado de la organización, solo de la plataforma |
| `set_updated_at()` | Trigger | `updated_at` de oportunidades |
| `cambiar_etapa(op, etapa, observacion, motivo, fecha)` | RPC, `SECURITY INVOKER` | Cambia de etapa con observación, motivo y fecha. Ejecutable por `authenticated` y `service_role` |

Detalle de cada regla en [reglas de negocio](./reglas-de-negocio.md).

## Storage: bucket `logos`

Privado (`public = false`), solo `image/png`, `image/jpeg` e `image/webp`, hasta 1.048.576 bytes. Ruta
`{organizacion_id}/logo.{png|jpg|jpeg|webp}`. Cuatro políticas sobre `storage.objects`: ver (cualquiera de
la organización) y subir, cambiar y borrar (`configuracion.gestionar`, solo en la carpeta de la propia
organización). SVG queda afuera a propósito. **Sin interfaz** todavía (F1).
