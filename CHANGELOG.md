# Changelog

Todos los cambios relevantes de Tuco & Nito se documentan acá. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto no usa números de versión
semánticos todavía (`package.json` está en `0.1.0` y no se modificó): las secciones se agrupan por hito y
fecha.

Las etiquetas de hito ("primera entrega", "segunda entrega") están inferidas del historial de git y de
`CLAUDE.md`, porque el repositorio no tiene etiquetas (`git tag` vacío). Cada línea cita el commit.
La versión larga, con explicación por área, está en [docs/notas-de-version.md](./docs/notas-de-version.md).

## Sin publicar - hacia la entrega final (2026-11-12)

Todo lo de esta sección ya está en `main`. Lo que no está es la interfaz de buena parte de la base nueva
(ver "Planificado" al final de la sección).

### Agregado

- F7, IA asistida opcional (sin commit todavía; sin migración; probada contra un servidor simulado, **no contra la API real**):
  - **Aviso de recambio con IA** en `/alertas` ("Redactar con IA"): borrador editable en un panel lateral, con la etiqueta de IA, "Volver a
    la plantilla", "Regenerar", "Copiar" y "Abrir en WhatsApp" / "Abrir en mail" (se abre el WhatsApp o el correo de la persona y se registra
    el aviso; la IA no envía nada). Si la IA falla, el cuadro queda con la plantilla fija de siempre.
  - **Resumen de cuenta con IA** en la ficha 360 de empresa y de contacto ("Resumir con IA"): panel de solo lectura (qué pasó,
    equipamiento instalado, qué ofrecerle) con "Copiar", "Regenerar" y "Cerrar"; no se guarda.
  - **Transparencia y control**: etiqueta de IA en todo texto generado, "Cómo usamos la IA" (qué se envía y qué no), contexto mínimo sin
    mails, teléfonos, CUIT ni documentos (`src/lib/ia/contexto.ts`), límite de 10 borradores cada 10 minutos por persona y la línea
    "IA: activa/desactivada" en `/configuracion`. **Se apaga quitando `ANTHROPIC_API_KEY`.**
  - SDK oficial `@anthropic-ai/sdk` (única dependencia nueva, solo en servidor), modelo `claude-opus-5-5` (`ANTHROPIC_MODEL`), esfuerzo
    bajo, reintento por rechazo de seguridad del lado del servidor y errores del proveedor traducidos a frases fijas.
  - Server Actions `redactarAvisoRecambio` y `resumirCuenta` (`src/app/(app)/ia/actions.ts`) y `registrarEnvioConBorrador`
    (`alertas/actions.ts`, solo registra). Excepción documentada a "mutaciones desde el cliente": hace falta un secreto.
  - 46 self-checks nuevos (`npm test`: 233 pruebas en 23 archivos). Docs: [`docs/ia.md`](./docs/ia.md) (las siete condiciones de la
    consigna, datos, costo estimado) y la [decisión 0013](./docs/decisiones/0013-ia-asistida.md).
- F6, presupuesto imprimible, pruebas E2E y CI (sin commit todavía; la migración `0012` está pendiente de aplicar a mano):
  - **Presupuesto imprimible** en `/oportunidades/[id]/presupuesto` (botón "Presupuesto" en el detalle; `oportunidades.ver`, 404 si la
    RLS esconde la oportunidad): encabezado con el **logo y los datos del proveedor** (nunca la marca de la plataforma), cliente y
    contacto, líneas editables (agregar, quitar, reordenar; del catálogo con precio o texto libre; cantidad, precio, descuento %),
    totales en vivo, validez y condiciones editables por presupuesto, e «Imprimir / Guardar PDF» con estilos `@media print` (A4 vertical,
    el menú y los botones no salen, la hoja se parte en páginas con el encabezado de la tabla repetido).
  - **Regla de IVA**: Responsable Inscripto = precios netos con IVA 21 % discriminado; Monotributo, Exento o sin condición = sin
    discriminar. Todo en centavos enteros con redondeo medio hacia arriba. `src/lib/presupuesto.ts` (20 pruebas).
  - **Guardar y numerar** (migración `0012_presupuestos.sql`, prueba `supabase/tests/0012_presupuestos.sql`): tabla `presupuestos` con número
    correlativo por organización asignado por un trigger con contador (sin duplicados bajo concurrencia, sin huecos por altas fallidas),
    inmutable, sin borrado y con la cartera de la oportunidad. Lista los anteriores y permite reabrirlos para reimprimir o usarlos de base.
    Se imprime `N° 000042`; sin guardar, «Borrador».
  - Al imprimir un presupuesto guardado se registra **una sola vez** la actividad «Envío de propuesta» en el historial.
  - Mientras falte la `0012` el presupuesto se arma e imprime como borrador y un administrador ve el aviso (`src/lib/esquema.ts`).
  - **Pruebas E2E con Playwright** (`@playwright/test`, solo devDependency; `e2e/`, `playwright.config.ts`): acceso por rol, aislamiento del
    Vendedor, la demo (empresa, contacto, oportunidad, etapas, perdida con motivo e historial), paginación y filtros por URL, Ctrl+K y la hoja
    del presupuesto. Corren contra una organización dedicada (`supabase/seeds/e2e_tests.sql`) y se saltan sin credenciales.
  - **CI** (`.github/workflows/ci.yml`): lint, tipos, self-checks y build en cada push y pull request a `main` (Node 22, `npm ci`, caché,
    sin secretos); job E2E aparte, solo en `main` o a mano y solo con secretos.
  - Scripts `typecheck`, `test` y `test:e2e`; `lint` pasa a `eslint src e2e playwright.config.ts --max-warnings=0`. `e2e/` tiene su propio `tsconfig`. `engines.node` pide `>=22.18`.
  - **Foto del emisor**: el presupuesto guarda la condición frente al IVA y los datos del emisor (razón social, CUIT, dirección, teléfono, mail, web; no el logo). Reimprimir un presupuesto emitido calcula el IVA y muestra el encabezado desde esa foto, no desde lo que la organización tenga hoy; el logo y los datos del cliente se leen en vivo.
  - Endurecimiento de la `0012`: el trigger fuerza `creado_por` (el usuario que guarda) y deja `actividad_id` en nulo al alta; `numero` tiene `default 0` y `check (numero > 0)` (lo pisa el trigger); la fecha de emisión la pone la base; borrar la actividad vinculada suelta el vínculo.
  - Imprimir no se puede disparar dos veces a la vez (doble clic): una sola actividad «Envío de propuesta»; si falla el vínculo se avisa y no se repite. El logo se vuelve a firmar al volver a la pestaña, cada 50 minutos y antes de imprimir.
  - **Repositorio público**: `supabase/seeds/e2e_tests.sql` ya no trae contraseña (hay que elegirla antes de ejecutarlo; se corta si queda el valor de ejemplo, es corta o los correos no son `@e2e.tuconito.com.ar`). En CI las trazas, capturas y videos están apagados y solo se sube un `junit.xml` con los secretos tachados (nada de reporte HTML).
  - Se agregan `data-app-shell`, `data-app-chrome` y `data-app-main` al shell (para ocultarlo al imprimir).
- F5, pantallas del responsable y búsqueda (sin commit todavía; **no necesita migración**):
  - **Ficha 360** en `/empresas/[id]` y `/contactos/[id]`: "Resumen de la cuenta" (primera compra de toda la cuenta, total comprado, última
    compra, oportunidades abiertas y días desde el último contacto, con ámbar + ícono + frase, nunca solo color) e
    "Historia de la cuenta": actividades, altas y cambios de etapa, compras y avisos de recambio enviados en una línea de
    tiempo por mes (horario argentino), con chips de filtro (`aria-pressed`) y "Ver 30 más" sobre lo más reciente de cada tipo
    (topes por tipo: 200, y 100 oportunidades; se avisan con su número real). Lógica pura en `src/lib/timeline360.ts` (14 pruebas) y lectura acotada en `src/lib/cuenta360.ts`.
  - **Tablero comercial** (`/tablero-comercial`, `clientes.ver_todos` y `oportunidades.ver`): valor en juego del equipo,
    pipeline por responsable, oportunidades abiertas sin actividad hace 7, 14 o 30 días (`?dias=`), ganadas y perdidas del mes
    (`?mes=`) y ranking de motivos de pérdida. `src/lib/tablero.ts` (15 pruebas).
  - **Conversión del embudo** (`/embudo`): por etapa, cuántas entraron, cuántas avanzaron, mediana de días (las que siguen
    ahí, aparte y "hasta hoy"), tasa de éxito y ciclo; filtros `?desde=&hasta=&origen=` y "Cómo se calcula".
    `src/lib/embudo.ts` (12 pruebas con fixtures a mano: salto de etapa, vuelta atrás y reapertura).
  - **Búsqueda global** con `Ctrl/Cmd+K` y un botón "Buscar…" en el menú y en la barra superior: diálogo combobox +
    listbox (flechas, Enter, Escape, foco atrapado y devuelto), desde 2 letras, 200 ms, resultados agrupados
    (empresas, contactos, oportunidades, productos) y "Ir a …" con la caja vacía. Una Server Action con la sesión de la
    persona (`src/app/(app)/buscar/actions.ts`); la RLS limita lo que aparece. `src/lib/paleta.ts` (10 pruebas).
  - Menú lateral con el grupo **Equipo** (tablero comercial y conversión) y la lista única de pantallas y permisos en
    `src/lib/navegacion.ts`.
- F4, funciones del rubro (sin commit todavía; la migración `0011` está pendiente de aplicar a mano):
  - **Recambio en un clic**: cada alerta de `/alertas` ofrece "Crear oportunidad de recambio" (título, empresa,
    contacto, producto, valor = precio × cantidad, origen "Recambio por vida útil", primera etapa abierta,
    responsable quien la crea y `venta_item_id`). Avisa con un link y no duplica: la base lo garantiza con un índice
    único parcial (una oportunidad abierta por equipo) y la pantalla enlaza la existente con un mensaje amable. La alerta
    pasa a mostrar "Oportunidad abierta →". Lógica pura en `src/lib/recambio.ts`.
  - **Parque instalado** en la ficha de empresa: lo entregado, agrupado en vencidos, por vencer, vigentes y sin
    seguimiento, con el total de unidades y el reloj de recambio (ahora el componente compartido `RelojRecambio`).
  - **Ficha de canchas** en la ficha de empresa (alta, edición y baja lógica) y **equipamiento sugerido** con medidas
    estándar por formato (`src/lib/canchas.ts`): "Le faltan 4 arcos de 3 × 2 m (F5)" o "Equipamiento completo", con
    "Crear oportunidad". Es una sugerencia, no un diagnóstico.
  - **Licitaciones**: tipo "Directa | Licitación municipal" en el formulario, con expediente, organismo, fecha de
    apertura, monto oficial y garantía; bloque en el detalle con aviso de la apertura; "Marcar ganada" bloqueada
    antes de la apertura (modal y base); filtro "Tipo" en la lista (`?tipo=`).
  - Migración `0011_rubro.sql` (tablas `canchas` y `licitaciones`, `oportunidades.venta_item_id` con su índice único
    parcial de una abierta por equipo, trigger `oportunidades_licitacion_regla`) y su prueba `supabase/tests/0011_rubro.sql`.
  - Las secciones que dependen de la 0011 se esconden mientras falte (`src/lib/esquema.ts`); un administrador ve el aviso.
  - El aviso (toast) admite un link y no se cierra mientras el mouse o el foco están encima.
- F3, búsqueda, filtros y paginación en el servidor (`1ccb553`):
  - Empresas, contactos, oportunidades (vista Lista), productos, ventas y usuarios piden al servidor solo la
    página que se ve (`.range()` y `count: "exact"`), en lugar de traer todo y filtrar en el navegador
    (PostgREST cortaba en silencio en 1000 filas).
  - La URL es el estado de cada lista: `?q=&page=&pageSize=&estado=&responsable=&origen=...` (y `?vista=` en
    oportunidades, `?tab=` en usuarios). Se comparte, sobrevive al reload y "atrás/adelante" anda. Los
    parámetros inválidos se descartan; una página fuera de rango redirige a la última.
  - Tamaños de página 10, 20 (por defecto) y 50. Componente `Paginacion` accesible (`nav` con
    `aria-label`, `aria-current`, links reales que andan sin JavaScript) y texto "Mostrando 21-40 de 134".
  - Búsqueda de texto con el texto del usuario escapado para `ILIKE` y para el `.or()` de PostgREST
    (`%`, `_`, comas, paréntesis y comillas no rompen ni ensanchan la consulta). Empresas se buscan también
    por sus contactos; contactos por nombre y apellido juntos y por el nombre de su empresa.
  - Filtros nuevos: tipo de cliente (empresas), origen (contactos), categoría y estado (productos), cliente y
    rango de fechas (ventas), rol y estado (usuarios). "Sin asignar" en el responsable de oportunidades.
  - El tablero de oportunidades sigue cargando solo las abiertas, con un techo de 500 y un aviso visible.
  - Estado "pendiente": `aria-busy` y una línea de progreso mientras el servidor recalcula.
  - `src/lib/paginacion.ts` con `paginacion.check.ts` (14 pruebas), `src/components/FiltrosUrl.tsx`,
    `src/components/Paginacion.tsx` y `src/app/(app)/error.tsx` (aviso si la base no responde).
  - Migración `0010_indices_busqueda.sql` (índices por organización y orden de cada lista, y un bloque
    opcional de trigramas `pg_trgm`); **pendiente de aplicar a mano en la base viva**.
- F2, oportunidades completas en la interfaz (`891d663`):
  - Tablero con una columna por **etapa abierta** configurada (scroll horizontal con imán en pantallas
    chicas); mover una tarjeta usa la RPC `cambiar_etapa`, con actualización optimista, vuelta atrás y aviso
    claro si la base lo rechaza.
  - Lista con conmutador Tablero | Lista y filtros por estado (por defecto abiertas), etapa, responsable
    (con `clientes.ver_todos`), origen y búsqueda; las cerradas muestran estado, fecha de cierre y motivo.
  - `CierreModal`: "Marcar ganada", "Marcar perdida" (motivo obligatorio del catálogo), "Reabrir" (con
    `oportunidades.reabrir`, pide la razón), "Cambiar resultado" (ganada a perdida y al revés sin reabrir,
    con razón, motivo si va a perdida y una fecha distinta a la del cierre anterior) y "Cambiar etapa" con
    observación. Foco atrapado dentro del modal, que devuelve el foco al cerrar; el fondo, Escape y Cancelar no
    cierran mientras se guarda.
  - Detalle `/oportunidades/[id]`: datos, acciones según permisos, línea de tiempo unificada de
    actividades y cambios de etapa, sección "Cambios después del cierre" (auditoría), "Reasignar" con
    `oportunidades.asignar` y "Registrar actividad" con la oportunidad ya elegida.
  - Formulario completo: probabilidad, fecha estimada de cierre, origen, responsable (solo con
    `oportunidades.asignar`), empresa o contacto obligatorio; estado, fecha real de cierre y motivo son de
    solo lectura. Insignia "Licitación" para las de tipo licitación.
  - Las fichas de empresa y de contacto enlazan cada oportunidad a su detalle.
  - `src/lib/oportunidades.ts` (etapas válidas por acción, validaciones, errores de la base en palabras,
    línea de tiempo, auditoría) con su self-check `oportunidades.check.ts`.
- Migración `0009_reglas_oportunidades.sql` (**pendiente de aplicar a mano en Supabase, junto con la
  `0008`**), con su prueba `supabase/tests/0009_reglas_oportunidades.sql`: la fecha real de cierre no puede
  ser futura (fecha de Argentina), la fecha de cierre por defecto es la de Argentina y una oportunidad tiene
  que ser de una empresa o de un contacto (solo para usuarios: no para scripts, `service_role` ni
  `on delete set null`).
- F1b, empresas y contactos completos en la interfaz (`ed5b149`):
  - `/empresas` con estado, tipo de cliente, responsable y origen; filtros por estado, responsable (con
    `clientes.ver_todos`) y origen; chip "Ver dadas de baja".
  - `/contactos` nueva (contactos de empresa y clientes individuales) con sus filtros, alta, edición y baja.
  - Fichas `/empresas/[id]` y `/contactos/[id]`: datos, contactos de la empresa, oportunidades, ventas y
    línea de tiempo de actividades. 404 si el id no existe o la RLS lo esconde.
  - Baja lógica en la interfaz: "Dar de baja" y "Reactivar" con confirmación; ya no hay "Eliminar".
  - `ActividadForm` y `ActividadesTimeline` reutilizables (tipo de catálogo, fecha y hora, descripción,
    resultado, oportunidad). Reemplazan a `BitacoraPanel`.
  - Responsable editable solo con `clientes.asignar`; sin él, de solo lectura. Errores de la base
    traducidos a mensajes claros. `src/lib/clientes.ts` con su self-check.
- Migración `0007_entrega_final.sql` (aplicada en Supabase el 2026-10-04) (`a5c0135`):
  - Catálogos configurables por organización: `origenes`, `motivos_perdida`, `tipos_actividad`.
  - Etapas con tipo (`abierta`, `ganada`, `perdida`) y embudo del rubro: Consulta recibida, Relevamiento de
    cancha, Presupuesto enviado, Negociación, Entregado, Perdida.
  - Empresas y contactos con `estado` (potencial, cliente, inactivo, no contactar), `responsable_id` y
    `origen_id`; empresas con `tipo_cliente` y `sitio_web`; contactos con `documento`.
  - Oportunidades con `estado`, `fecha_estimada_cierre`, `fecha_cierre`, `origen_id`,
    `motivo_perdida_id`, `probabilidad` y `tipo` (directa o licitación).
  - Reglas del embudo en la base (trigger `oportunidad_reglas`), historial de cambios de etapa
    (`oportunidad_etapas_historial`), auditoría de oportunidades cerradas (`oportunidad_auditoria`) y RPC
    `cambiar_etapa`.
  - Actividades con tipo de catálogo, oportunidad relacionada y resultado; pueden ser solo de un contacto.
  - Cartera propia: un usuario sin `clientes.ver_todos` solo ve lo que tiene asignado.
  - Permisos nuevos: `clientes.ver_todos`, `clientes.asignar`, `oportunidades.asignar`,
    `oportunidades.reabrir`, `configuracion.gestionar` (19 en total).
  - Datos fiscales del proveedor en `organizaciones` y bucket privado `logos` (PNG, JPG o WebP, hasta 1 MB).
- Pruebas SQL con rollback: `supabase/tests/0007_reglas.sql` y `supabase/tests/0007_reejecucion.sql`
  (`a5c0135`).
- Seed de demostración actualizado a la 0007: responsables, estados, orígenes, cierres e historial de
  etapas (`a5c0135`).
- Identidad visual del rubro (2026-09-28), sin cambios de funcionalidad:
  - Tokens propios, escala de radios y sombras tintadas (`df44444`).
  - `PageHeader` compartido y tablero con la cifra "en juego" como protagonista (`bfa9c1a`).
  - Estados vacíos con escenas de cancha y microcopy con la voz de la landing (`03b01ee`).
  - Sidebar, header y marcadores sobre la superficie de cancha; reloj del recambio por alerta (`51428ca`).
  - Íconos del equipo (arco, red, pelota, cono, pechera, banderín, escalera, valla), barra de vida útil
    y tarjeta "Recambios que vienen" en el tablero (`aa0619c`).

### Cambiado

- Las listas ya no copian sus filas a un estado local: después de una alta, edición, baja o cambio de etapa
  piden la página de nuevo al servidor (`router.refresh()`).
- El pie de totales de la lista de oportunidades cuenta la página, no todo el filtro ("En esta página").
- La búsqueda de oportunidades ya no mira el nombre del responsable (para eso está el filtro).
- `oportunidades.asignar` ahora requiere `clientes.ver_todos` en el catálogo de permisos (como
  `clientes.asignar`): la pantalla de roles lo tilda sola.
- Los textos de "sin acceso" de la interfaz son neutros: "De otra cartera" / "Sin acceso" en vez de afirmar
  que algo "ya no existe" o está "fuera de tu cartera".
- El tablero de `/oportunidades` ya no tiene seis columnas fijas: se arma con las etapas abiertas del
  cliente. Las etapas de cierre dejaron de ser columnas; se cierra desde la tarjeta o el detalle.
- Cambiar de etapa deja de escribir `etapa_id` directo: todo pasa por `cambiar_etapa`, así queda la
  observación en el historial.
- Los roles por defecto pasan a llamarse **Vendedor** (antes Ventas) y **Responsable comercial** (antes
  Corporativo); se renombran en el lugar, sin perder la asignación de los usuarios (`a5c0135`).
- Un Vendedor ve solo su cartera (empresas, contactos, oportunidades y lo que cuelga de ellos) (`a5c0135`).
- Las oportunidades ya no se pueden borrar: se marcan perdidas (`a5c0135`).
- Una oportunidad perdida exige motivo; una ganada, fecha real de cierre; reabrir una cerrada exige el
  permiso `oportunidades.reabrir` (`a5c0135`).
- Las etapas por defecto se renombran al vocabulario del rubro (`a5c0135`).
- La clave foránea de actividades a contactos pasa de `set null` a `no action`: un contacto con
  actividades no se borra (`a5c0135`).
- El nombre y el estado de una organización solo los cambia la plataforma, no el administrador del cliente
  (`a5c0135`).

### Corregido

- El ranking de empresas del tablero mide la barra por monto y no por cantidad (`5e6a95c`).
- El ranking de empresas excluye las oportunidades sin empresa (`dd50fe7`).
- El test de la 0007 no borra de `storage.objects` (Supabase lo prohíbe); verifica la definición de la
  política en `pg_policies` (`cb7c251`).

### Planificado (no implementado)

Funciones del rubro (canchas, parque instalado,
licitaciones), presupuesto imprimible, E2E y CI, IA opcional y manual de usuario (las del rubro, el presupuesto, E2E/CI y la IA ya están
arriba en "Agregado"). Fases F1 a F8, del
2026-10-13 al 2026-11-11, en [docs/notas-de-version.md](./docs/notas-de-version.md#g-pendiente-y-próximos-pasos).

## Segunda entrega - 2026-09-18 a 2026-09-24

Catálogo con vida útil, ventas, alertas de recambio, bitácora, landing pública, multitenancy y roles.

### Agregado

- Landing pública en `/` con presentación, funcionalidades, cómo funciona, equipo, FAQ y contacto
  (`a72f794`); rediseño oscuro con partículas y cursor pelota (`74bbcce`); las partículas se transforman
  en una forma deportiva por sección (`674e027`).
- Catálogo de productos con vida útil en meses; los productos se dan de baja, no se borran (`a72f794`).
- Historial de ventas con cabecera e ítems; cada ítem copia la vida útil del catálogo (`a72f794`).
- Alertas de recambio en `/alertas`, calculadas en vivo por la vista `alertas_vida_util`, con mensajes por
  mail y WhatsApp y registro de envíos (`a72f794`).
- Bitácora de clientes desde el menú de cada empresa (`a72f794`).
- Envío de mails de alerta por SMTP desde la casilla de la marca (`b9b2fe9`).
- Multitenancy: organizaciones, aislamiento por RLS y claves foráneas compuestas (migración `0004`)
  (`2908420`).
- Roles con permisos por organización (migración `0005`): Administrador, Ventas, Corporativo y Solo
  lectura, con un catálogo de 14 permisos (`2908420`).
- Cuentas: invitación por mail, activación, recuperación de contraseña, reenvío automático de la
  activación, límite de envíos y mails HTML propios (`2908420`).
- Pantallas de carga por módulo (`2908420`).
- Panel de plataforma `/admin` para el superadmin, fuera del CRM (`ecef8bf`); el superadmin deja de
  pertenecer a una organización (migración `0006`).
- Arrastre de tarjetas entre etapas del embudo, en lugar de un desplegable (`7e8f775`).
- Pills de color para categorías, roles, tipos y estados (`0c65a35`).
- Prueba SQL de aislamiento y permisos con rollback (`2908420`).
- Seed de demostración para la cátedra, con una cuenta por rol (`fd0067d`).

### Cambiado

- El envío de mails de alerta pasa de una API de proveedor (Resend) a SMTP con nodemailer, que permite usar
  una casilla de Gmail (`b9b2fe9`).

### Corregido

- Los contactos de una oportunidad se acotan a la empresa elegida, y los usuarios inactivos o de
  plataforma no aparecen como responsables (`de6b9cd`).
- La fecha de entrega de un ítem sigue a la fecha de la venta; los links de mail de la landing abren
  Gmail (`e58b5cd`).
- La landing recorta el desborde del cuerpo para que las animaciones por scroll completen (`00860d5`).
- Bordes con el color del tema por defecto (`4630a53`); el logo conserva el verde de marca en modo oscuro
  (`c136d71`); las acciones del formulario quedan fijas abajo en el panel lateral (`b5e0a10`).
- La prueba SQL busca al superadmin antes de cambiar al rol `authenticated` (`929b63d`).

## Primera entrega - 2026-09-17

Versión funcional mínima: login, empresas con contactos, oportunidades y embudo.

### Agregado

- Esqueleto de la aplicación con Next.js y Supabase: login, empresas, contactos, oportunidades, etapas
  precargadas y productos precargados (`65d5b4a`, migraciones `0001` y `0002`).
- Conexión al proyecto real de Supabase y tipos generados (`cc75fbb`); primer despliegue en Vercel
  (`d6af8af`).
- Modo oscuro, paneles laterales para editar y menú hamburguesa (`e6ae917`).
- Sumar UI Kit: tokens, primitivas y campos de formulario (`8326161`), con sus dependencias (`a7d6c4c`) y
  el isotipo como favicon (`4cc8aad`). Documentación del kit y de las divergencias (`53ef1f1`).
- Pantallas reconstruidas sobre el kit: shell (`4c71c4e`), login (`4461b5f`), tablero con KPIs y gráficos
  del embudo (`ffc4d9e`), empresas (`6a15472`) y oportunidades (`9aa5e7d`).

### Cambiado

- El verde de marca pasa a ser el color principal de la interfaz (`a86ccf4`).
- La aplicación se renombra a Tuco & Nito (`3c3ce57`).

### Corregido

- Las escrituras de etapa se rastrean por fila para evitar desincronización silenciosa; el campo de dinero
  conserva el cursor mientras se escribe (`95f5273`).
- Las primitivas vuelven a poder renderizarse en el servidor y el tablero carga (`ff2fd02`).
- El contenido principal hace el scroll y el sidebar queda fijo (`4e270dc`).
- URL de producción corregida en la documentación: `crmgads1.vercel.app` (`80a1b18`, `984334e`).
