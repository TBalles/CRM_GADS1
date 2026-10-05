# CLAUDE.md

Contexto del proyecto para trabajar de forma consistente entre sesiones/personas.

## Qué es esto

CRM simple dirigido a **proveedores y distribuidores de equipamiento deportivo** que venden a
canchas de fútbol, clubes, complejos deportivos y escuelas de fútbol. Productos típicos: arcos,
redes, conos, pecheras, pelotas y demás materiales para el funcionamiento y mantenimiento de una
cancha.

La **primera entrega** (2026-09-17) fue una versión funcional mínima para registrar clientes y
gestionar oportunidades comerciales. La **segunda entrega** (2026-09-18 a 09-24) sumó la landing
pública, catálogo con vida útil, historial de ventas, alertas de recambio, bitácora, multitenancy,
roles con permisos y cuentas. Se trabaja hacia la **entrega final (2026-11-12)**: la migración
`0007_entrega_final.sql` ya está aplicada (la base cumple casi todo el módulo comercial de la
consigna) y la interfaz de esas capacidades se construyó en las fases F1 a F8 (hechas; versión 1.0.0). La **versión 2.0.0 (CRM 2.0)** rediseñó toda la interfaz del CRM con el sistema "Ledger"
(ver "Diseño / UI") sin capacidades, datos ni permisos nuevos: es la misma aplicación con otra cara. El estado real,
requisito por requisito, está en [`docs/notas-de-version.md`](./docs/notas-de-version.md); el resto
de la documentación se indexa en [`docs/README.md`](./docs/README.md).

**Tres estados, siempre distintos:** *implementado* (anda en producción), *base lista, sin
interfaz* (la base ya lo aplica, la pantalla no) y *planificado*. No documentes como existente lo
que está en el segundo o tercer estado.

## Alcance actual

Incluido:

- **Acceso**: login con Supabase Auth, sin registro público. Los usuarios se invitan (superadmin y
  administradores), activan su cuenta definiendo una contraseña y pueden recuperarla (ver "Cuentas"
  más abajo).
- **Empresas y contactos** (F1b, F3): listas `/empresas` y `/contactos` con búsqueda, filtros (estado, responsable
  con `clientes.ver_todos`, origen, empresa/individual) y chip "Ver dadas de baja"; fichas
  `/empresas/[id]` y `/contactos/[id]` (datos, contactos, oportunidades, ventas, línea de tiempo de
  actividades). Estado, tipo de cliente, responsable (editable solo con `clientes.asignar`) y origen.
  **Baja lógica**: "Dar de baja" / "Reactivar" (`estado`), nunca borrar.
- **Landing pública** en `/` (sin sesión): presentación, funcionalidades, cómo funciona,
  nosotros, FAQ y contacto. Los datos de contacto salen de variables de entorno
  (`src/lib/contacto.ts`). Si hay sesión, el botón cambia de "Ingresar" a "Ir al CRM".
- **Productos**: ABM en `/productos` con **duración estimada de vida útil** (en meses). Ese dato
  es el que alimenta las alertas. Un producto no se borra, se da de baja (`activo = false`): la FK
  desde `venta_items` es `on delete restrict` para no romper el historial.
- **Ventas**: historial de compras en `/ventas`, con cabecera + ítems. Cada ítem guarda su propia
  fecha de entrega y una **copia** de la vida útil del catálogo al momento de vender.
- **Alertas de recambio** en `/alertas`: equipos entregados que vencieron o vencen en los próximos
  60 días, con mensaje prearmado para enviar por mail o WhatsApp. Se registra cada envío.
- **Actividades** (la antigua bitácora): "Registrar actividad" desde la ficha de la empresa o del
  contacto (`src/components/crm/cuenta/ActividadDrawer.tsx`), con tipo de catálogo, fecha y hora (no futura),
  descripción, resultado y oportunidad opcional; se listan en la línea de tiempo de la ficha.
- **Oportunidades** (F2): alta y edición (título, empresa o contacto, producto, valor estimado,
  probabilidad, fecha estimada de cierre, origen, responsable, observaciones). Estado, fecha real de
  cierre y motivo de pérdida son de solo lectura: los fija la base al cambiar de etapa o cerrar.
  Detalle en `/oportunidades/[id]`: datos, acciones según permisos (Editar, Cambiar etapa, Marcar
  ganada/perdida, Reabrir y Cambiar resultado con `oportunidades.reabrir`, Reasignar con `oportunidades.asignar`
  (que exige `clientes.ver_todos`),
  Registrar actividad), línea de tiempo unificada de actividades y cambios de etapa, y la auditoría de
  lo editado tras el cierre. 404 si no existe o la RLS la esconde. `tipo = licitacion` lleva sus datos
  (`licitaciones`) y la regla "no se gana antes de la apertura" desde F4 (migración `0011`, pendiente de aplicar).
- **Embudo comercial**: `/oportunidades` con conmutador **Tablero | Lista**. El tablero arma una
  columna por **etapa abierta** configurada (orden de `/configuracion`), con scroll horizontal e
  imán en pantallas chicas, y muestra solo oportunidades abiertas. Mover de etapa (arrastre HTML5
  nativo o "Cambiar etapa" del menú, que sirve en touch y pide observación) y cerrar/reabrir pasan
  **siempre por la RPC `cambiar_etapa`** (`src/lib/cambiarEtapa.ts`); nunca un `update` de
  `etapa_id`. La lista (`?vista=lista`) busca, filtra y pagina **en el servidor** (F3) por estado (por defecto
  abiertas), etapa, responsable (con `clientes.ver_todos`), origen y texto; el tablero carga solo las abiertas
  (hasta 500, con aviso).
- **Ficha 360 y pantallas del responsable (F5, sin migración)**: las fichas de empresa y contacto traen el "Resumen de
  la cuenta" y la "Historia de la cuenta" (actividades, altas y cambios de etapa, compras y avisos de recambio en una línea de
  tiempo por mes, `src/lib/timeline360.ts` y `src/lib/cuenta360.ts`). `/tablero-comercial` (pipeline por responsable,
  oportunidades sin actividad, cierres del mes y motivos de pérdida) y `/embudo` (conversión por etapa, mediana de días,
  tasa de éxito y ciclo) piden `clientes.ver_todos` y `oportunidades.ver`. `Ctrl/Cmd+K` abre la búsqueda global
  (`CommandPalette` del shell, Server Action `buscarGlobal` con la sesión de la persona: la RLS limita lo que aparece).
- **Listas en el servidor (F3)**: empresas, contactos, oportunidades (Lista), productos, ventas y usuarios
  piden solo la página que se ve. **La URL es el estado** (`?q=&page=&pageSize=&estado=...`); la página
  servidor lee `searchParams` (una Promise en Next 16), sanea cada parámetro con `src/lib/paginacion.ts` y
  consulta con `.range()`. Para sumar una lista nueva: `useFiltrosUrl` y `AnuncioResultados`, `SearchField` y los chips de
  `crm/Toolbar.tsx`, `crm/Pagination` y `ListFooter` (`crm/Lista.tsx`), y `filtroOr` para el texto (escapa `%`, `_` y las comas del `.or()`).
- **Etapas**: las crea el trigger al dar de alta una organización (embudo del rubro: Consulta
  recibida, Relevamiento de cancha, Presupuesto enviado, Negociación, Entregado, Perdida). La base
  se configuran en `/configuracion` (`configuracion.gestionar`, F1a).
- **Modo oscuro**: toggle manual (ícono sol/luna en la barra superior), respeta `prefers-color-scheme`
  la primera vez y después queda guardado en `localStorage`.

- **Multitenant**: cada cliente es una `organizacion`; RLS aísla sus datos. Un **superadmin**
  (nivel plataforma, sin organización) tiene su propia interfaz en `/admin` (`src/app/admin`,
  fuera del CRM): da de alta clientes, cada uno con su usuario Administrador, y los suspende. El
  layout del CRM lo redirige ahí; NO ve datos comerciales de ningún cliente.
- **Roles con permisos** por cliente (`roles.permisos`), administrados en `/usuarios`. El catálogo
  de permisos está en `src/lib/permisos.ts` y la base exige cada uno en las políticas RLS; la UI
  solo esconde lo que el rol no puede usar.
- **Cuentas**: invitación por mail, activación (definir contraseña), recuperación de contraseña y
  reenvío automático de la activación si alguien intenta ingresar con una cuenta sin activar.
  Todos los mails salen por nuestro SMTP (`src/lib/email/`), ninguno por Supabase.

**Entrega final: en la base sí, en la interfaz todavía no** (migración `0007`, aplicada el
2026-10-04). Son reglas que viven en la base y se cumplen por cualquier camino; ninguna pantalla las
usa aún, salvo donde se aclara:

- Estados (potencial, cliente, inactivo, no contactar), responsable y origen en empresas y contactos
  (baja lógica = `inactivo`); la interfaz los usa desde F1b. Un alta sin responsable queda para quien la crea.
- Oportunidades con estado (abierta, ganada, perdida), fecha de cierre, motivo de pérdida, origen,
  probabilidad y tipo. **Reglas del embudo en el trigger `oportunidades_reglas`**: el estado sale del
  tipo de la etapa, ganada pone fecha de cierre, perdida exige motivo, reabrir exige
  `oportunidades.reabrir`. La interfaz (F2) pide lo que la base va a exigir y traduce sus errores
  (`mensajeErrorOportunidad`); la fecha de cierre futura y la oportunidad sin empresa ni contacto las rechaza
  la UI y, desde la `0009` (si está aplicada), también la base.
- Historial de cambios de etapa (`oportunidad_etapas_historial`) y auditoría de las cerradas
  (`oportunidad_auditoria`): se escriben solos y desde F2 se leen en el detalle de la oportunidad.
- Catálogos configurables por organización (`origenes`, `motivos_perdida`, `tipos_actividad`) y datos
  fiscales del proveedor más el bucket privado `logos` (PNG/JPG/WebP, 1 MB, sin SVG).
- **Cartera propia**: sin `clientes.ver_todos` solo se ve lo asignado. Esto **sí rige en pantalla**
  (la base devuelve menos filas). Las oportunidades ya **no se borran** (sin política de borrar).
- Actividades (`bitacora_entradas`) con tipo de catálogo, oportunidad y resultado: desde F1b la
  interfaz usa `tipo_actividad_id` (el `tipo` viejo lo completa el trigger).

**Rubro (F4, migración `0011` pendiente de aplicar a mano)**: parque instalado y ficha de canchas con equipamiento
sugerido en la ficha de empresa, licitaciones en oportunidades y "Crear oportunidad de recambio" en `/alertas`. Mientras la
base no tenga la 0011 esas secciones se esconden (`src/lib/esquema.ts`); el parque anda igual.

**Presupuesto imprimible, E2E y CI (F6, migración `0012` pendiente de aplicar a mano)**: `/oportunidades/[id]/presupuesto` arma e imprime el
presupuesto con el logo y los datos del proveedor (nunca la marca de la plataforma), IVA según la condición del proveedor y numeración por
organización (`N° 000042`, la asigna un trigger con contador). Mientras la base no tenga la 0012 se imprime como «Borrador» sin guardarse.
Pruebas E2E con Playwright contra una organización dedicada (`supabase/seeds/e2e_tests.sql`) y CI en GitHub Actions.

**IA asistida opcional (F7, sin migración)**: "Redactar con IA" en `/alertas` (borrador editable del aviso de recambio, con la plantilla fija
como respaldo ante cualquier falla) y "Resumir con IA" en la ficha 360 de empresa y de contacto (resumen de solo lectura). La IA **solo
redacta**: no envía, no guarda, no cambia datos; una persona revisa todo. Se enciende con `ANTHROPIC_API_KEY` (sin ella no hay botones) y
se prueba solo contra un servidor simulado: **no se llamó a la API real**. Detalle, datos y costo en [`docs/ia.md`](./docs/ia.md).

**Manual de usuario y kit de entrega (F8; el manual acompaña la versión 2.0.0)**: `docs/Manual-de-usuario-Tuco-y-Nito.pdf` (A4, 93 páginas), fuente en `docs/manual/` y
scripts en `scripts/manual/`; `npm run manual` saca las capturas (Playwright, solo navegación, credenciales por entorno `MANUAL_*`, nunca en el
repo) y arma el PDF. Las figuras que no se pueden capturar todavía quedan en `docs/manual/pendientes.json` y salen como «Captura pendiente».
Las migraciones `0008` a `0012` se aplican con **un solo archivo**, `supabase/aplicar/aplicar_0008_a_0012.sql` (generado por
`npm run migraciones:consolidar`; `npm test` falla si quedó viejo). Si cambiás una pantalla, revisá su capítulo del manual.

**Fuera de alcance según la consigna** (no agregar sin que el usuario lo pida): tareas, agenda,
recordatorios, exportación, integraciones, API pública, importación, facturación, pagos,
contabilidad, stock y campañas. El proyecto igual tiene multitenancy, envío de mails, links de
WhatsApp y un tablero con indicadores, que la consigna lista como fuera de alcance: se conservan.
Además: no hay envío automático de alertas (lo confirma una persona), la bitácora no se edita ni se
borra, y la IA (F7) nunca envía ni decide: solo redacta borradores que una persona revisa.

### Demo esperada

1. Iniciar sesión.
2. Registrar una empresa (en `/empresas`) y, desplegándola, un contacto.
3. Crear una oportunidad (en `/oportunidades`).
4. Visualizarla en el embudo (arriba de la misma página).
5. Cambiarla de etapa (arrastrando la tarjeta), cerrarla como ganada o perdida y mirar su historial.
6. Refrescar y comprobar que la información permanece guardada.

## Stack técnico

Elegido priorizando: gratis para hostear, poco código de infraestructura, y fácil de repartir
entre el equipo.

- **Next.js 16** (App Router, TypeScript, React Server Components + Server Actions) en `src/app`.
- **Tailwind CSS v4** para estilos (sin librería de componentes, clases utilitarias directas).
- **Supabase** como backend: Postgres (base de datos), Auth (login) y Row Level Security.
- **Deploy**: Vercel (plan gratuito) para el frontend, Supabase (plan gratuito) para la base y el
  auth. Sin servidores propios que mantener.

### Por qué mutaciones client-side y no Server Actions para el CRUD

Las Server Actions se reservan para lo que no puede ir desde el navegador: escribir cookies de
sesión (`src/app/login/actions.ts`), usar la clave de servicio (`usuarios/actions.ts`,
`admin/actions.ts`, `recuperar/`, `definir-clave/`), enviar mails (`alertas/actions.ts`) y llamar a la API de Claude con
`ANTHROPIC_API_KEY` (`ia/actions.ts`, F7). Variables nuevas: `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` (opcionales, ver `docs/deploy.md`).
Pero el CRUD de empresas/contactos/oportunidades/productos/ventas (crear, editar, cambiar
etapa) se hace desde Client Components con el cliente de Supabase del navegador
(`src/lib/supabase/client.ts`), no con Server Actions. Motivo: la UI usa paneles laterales
(`Drawer`) para editar sin navegar a otra página, y `router.refresh()` después de una Server Action
no siempre volvía a pintar la lista con los datos nuevos en este proyecto (a veces quedaba
mostrando el estado viejo hasta un reload manual). La solución fue mover la escritura al cliente,
pedir la fila guardada de vuelta con `.select().single()`, y mezclarla a mano en el estado local de
React — así la UI se actualiza al instante sin depender del refresh del router. RLS sigue
protegiendo el acceso igual que si fuera server-side.

**Desde F3** las listas ya no copian sus filas a un `useState`: son del servidor y, después de mutar, llaman a
`router.refresh()`; sin esa copia el refresco sí repinta (verificado). El movimiento optimista de las tarjetas
del tablero se conserva. Ver `docs/arquitectura.md` §2.1.

## Estructura del proyecto

```
src/
  app/
    globals.css               Tokens del UI Kit (:root + .dark), @theme de Tailwind v4, keyframes y bloque LANDING (congelado: lo usan la landing y el acceso)
    layout.tsx                Raíz (congelado): fuentes de la landing y el acceso (Inter, Jakarta, JetBrains Mono, Varela Round), anti-flash, Toast + Tooltip.
                                 Las fuentes del CRM (IBM Plex) NO están acá: las carga `components/crm/CrmRoot.tsx`
    icon.svg                  Favicon (isotipo con el verde de marca horneado)
    login/                    Login (fuera del grupo protegido), Server Action en actions.ts
      page.tsx                 Split-screen: panel de marca (cancha en SVG) + panel de form
      LoginForm.tsx            Client: show/hide de contraseña, banner de error, useFormStatus
    recuperar/                "Olvidé mi contraseña" (pública; responde siempre igual)
    definir-clave/            Elegir contraseña tras activar o recuperar (Server Action)
    auth/signout/route.ts     Logout (POST, borra la sesión)
    auth/confirm/route.ts     Canjea el token de los mails con verifyOtp (solo rutas internas en `next`)
    admin/                    Panel del superadmin (alta/suspensión de clientes), fuera del CRM. CRM 2.0 (Lote F): el mismo
                                 AppFrame en variante `plataforma` (rail de una sola sección "Plataforma › Clientes", sin Ctrl+K);
                                 layout.tsx (guardas: sin sesión → /login, no superadmin → /dashboard), AdminView.tsx (tabla densa,
                                 drawers CRM, ConfirmDialog "Suspender cliente"), actions.ts (sin cambios), loading.tsx, error.tsx
    (app)/                    Grupo de rutas protegidas (layout valida sesión)
      layout.tsx               CrmRoot + AppFrame + guards: superadmin va a /admin; baja o suspensión = "Sin acceso". Importa crm.css
      crm.css                  Tokens `--crm-*` (claro y .dark) y solo selectores bajo `[data-crm]`; lo importan únicamente (app)/layout.tsx y admin/layout.tsx
      (crm2)/                  TODAS las pantallas del CRM (el grupo `(legacy)` ya no existe: se retiró en el Lote F); su layout no impone nada,
                                 cada pantalla arma su marco con los primitivos de `components/crm`
      (crm2)/loading.tsx / error.tsx   Carga (esqueleto + "Cargando…") y error ("Reintentar") de respaldo de CRM 2.0
      (crm2)/sin-permisos/       Destino cuando el rol no tiene ninguna sección (h1 + "Volver al inicio"; texto neutro si el rol sí tiene secciones)
      (crm2)/configuracion/      CRM 2.0 (Lote F): sub-navegación por `?s=empresa|etapas|tipos|origenes|motivos` (columna desde 1024,
                                   tabs debajo; cambia con history.pushState, sin ir al servidor), catálogos como tablas compactas
        page.tsx / loading.tsx   Server Component: organización, etapas, tipos, orígenes, motivos y el logo firmado (sin cambios)
        ConfiguracionView.tsx     Client: PageBar + Tabs vertical + las 5 secciones montadas (lo escrito no se pierde)
        DatosEmpresa.tsx          Formulario (mismos ids) + logo (bucket `logos`, mismas validaciones) + vista previa de la hoja
        EtapasTab.tsx / CatalogoTab.tsx / Mover.tsx   Tablas con reordenado en línea (flechas con aria-disabled) y drawers CRM
        logica.ts(+.check)        Pura: sección de `?s=` y su link, renumerado de un catálogo al subir/bajar
      (crm2)/dashboard/          CRM 2.0 (Lote E): Inicio. h1 "Inicio", franja de 4 cifras + "Recambios vencidos" con alertas.ver (StatStrip
                                   lg; Contactos sigue yendo a /empresas, bug conocido sin corregir) y tablas: recambios (alertas.ver,
                                   PRIMERO en el DOM), por etapa (sin barra), empresas con más valor (con barra)
        page.tsx / loading.tsx   Server Component: mismas lecturas y cuentas que antes del rediseño; carga con TableroSkeleton
      (crm2)/empresas/          CRM 2.0 (Etapa 3): lista + vista previa (master-detail, `?sel=`) y ficha con tabs (`?tab=`)
        page.tsx                 Server Component: searchParams → UNA página (.range) + catálogos; vista previa en <Suspense key={sel}>
        EmpresasList.tsx          Client: PageBar, toolbar (filtros por URL), DataTable, selección optimista ↑/↓/Esc, banda de pie; recibe el panel
        VistaPrevia.tsx           Server Component: panel ≥1280 con leerCuenta360 (RLS); nada si `sel` no es visible; <1280 la lista quita `sel`
        AccionesVistaPrevia.tsx / acciones.tsx   Acciones de empresa (nueva, editar, baja, reactivar) con drawers CRM
        EmpresaForm.tsx           Drawer de alta/edición de empresa (única implementación)
        [id]/page.tsx             Ficha (notFound si no existe o la RLS la esconde); arma las tabs según permisos
        [id]/EmpresaDetalle.tsx   Client: DetailHeader + Tabs (Resumen, Actividad, Oportunidades, Ventas, Contactos, Canchas y parque)
        [id]/CanchasSeccion.tsx / CanchaForm.tsx / ParqueInstalado.tsx   Canchas, equipamiento sugerido y parque (CRM 2.0)
      (crm2)/contactos/         CRM 2.0 (Lote A): lista + vista previa (`?sel=`, igual que Empresas) y ficha con tabs (`?tab=`)
        page.tsx                 Server Component: searchParams → UNA página + catálogos; vista previa en <Suspense key={sel}>
        ContactosList.tsx         Client: PageBar, toolbar (filtros por URL), DataTable, selección (`useSeleccionUrl`), banda de pie
        VistaPrevia.tsx / AccionesVistaPrevia.tsx   Panel ≥1280 (leerCuenta360 por contacto_id) y su acción + ⋮
        acciones.tsx / datos.tsx  Acciones de contacto (ContactoDrawer, BajaDialog) y sus datos como DefinitionList
        [id]/page.tsx / [id]/ContactoDetalle.tsx   Ficha: DetailHeader + Tabs (Resumen, Actividad, Oportunidades, Ventas)
      (crm2)/tablero-comercial/  CRM 2.0 (Lote E): tablero del responsable (F5): franja de 5 cifras, pipeline por responsable, sin actividad,
                                   cierres del mes y motivos, cada uno como tabla
        page.tsx / loading.tsx   Server Component: `?dias=7|14|30` y `?mes=aaaa-mm`; lecturas con tope y aviso (cuentas en lib/tablero.ts)
      (crm2)/embudo/             CRM 2.0 (Lote E): conversión del embudo (F5): franja de 3 cifras, tabla por etapa con la barra del embudo,
                                   «Cómo se calcula» en <details>
        page.tsx / EmbudoFiltros.tsx / loading.tsx   Server Component + toolbar CRM (FechaFiltro, Select) por URL (`?desde=&hasta=&origen=`)
      buscar/actions.ts          Server Action `buscarGlobal` de la búsqueda Ctrl+K (F5): con la sesión, la RLS manda
      (crm2)/productos/          CRM 2.0 (Lote A): catálogo con vida útil (sin ficha ni vista previa)
        page.tsx / ProductosList.tsx / ProductoForm.tsx   Lista densa + drawer de alta/edición (CRM 2.0)
      (crm2)/ventas/             CRM 2.0 (Lote B): historial de entregas con filas desplegables (el detalle de productos)
        page.tsx / VentasList.tsx Server: UNA página + ítems de esa página; Client: PageBar, toolbar (q, cliente, desde/hasta por URL), DataTable
        VentaForm.tsx             Drawer "Nueva venta" (640) con la grilla compacta de productos (DatePicker, MoneyInput)
        logica.ts(+.check)        Pura: ítems por venta, total, entrega que sigue a la fecha, validación de líneas
      ia/actions.ts              Server Actions de la IA (F7): redactarAvisoRecambio y resumirCuenta; solo redactan, con la sesión de la persona
      (crm2)/alertas/            CRM 2.0 (Lote B): recambios vencidos o por vencer, tabla densa con acciones a la vista
        page.tsx                 Lee la vista alertas_vida_util (+ datos del recambio en 1 clic si la 0011 está)
        AlertasView.tsx          Client: contadores en la PageBar, filtro (segmentado) y búsqueda en el cliente, "Crear oportunidad de recambio", mail/WhatsApp
        actions.ts               Server Actions: envío por SMTP/Gmail (o mailto) + registro
        BorradorIA.tsx           Client (F7): drawer CRM del aviso con IA (useBorradorIA), plantilla como respaldo
        plantillas.ts            Mensajes prearmados — funciones puras
        plantillas.check.ts      Self-check: node --test "src/app/(app)/(crm2)/alertas/plantillas.check.ts"
        logica.ts(+.check)        Pura: contadores, filtro + búsqueda, texto del vencimiento
      (crm2)/usuarios/           CRM 2.0 (Lote B): usuarios y roles (permiso usuarios.gestionar), tabs por URL (?tab=roles)
        page.tsx / UsuariosView.tsx   Lista de usuarios (filtros por URL) + roles (tabla y matriz de permisos); invitar / cambiar rol en drawers
        RolForm.tsx / actions.ts  Drawer de rol (permisos con dependencias) y Server Actions (clave de servicio)
        logica.ts(+.check)        Pura: estado del usuario, grupos de permisos, tildado con dependencias, validación del rol
      (crm2)/oportunidades/      CRM 2.0 (Lote C): tablero (columnas a todo el alto, sin caja) y lista (DataTable) por `?vista=`, y la ficha
        page.tsx                 Server Component: fetch de oportunidades + catálogos (tablero: abiertas hasta 500; lista: UNA página)
        datos.ts                 cargarOpciones(): etapas, clientes, productos, perfiles, orígenes, motivos
        OportunidadesView.tsx     Client: PageBar + segmentado Tablero|Lista, toolbar (filtros por URL, "Más filtros"), tarjetas `article`
                                   con ⋮ (Ver detalle, Presupuesto, Editar, acciones de etapa), arrastre HTML5 optimista, lista con pie de totales
        OportunidadForm.tsx       Drawer "Nueva/Editar oportunidad" (mismos ids; CampoFecha, MoneyInput); tipo y datos de licitación (F4)
        CierreDialog.tsx          Dialog CRM "Cambiar de etapa" / "Marcar como ganada/perdida" / Reabrir / Cambiar resultado, por `cambiar_etapa`
        [id]/page.tsx             Ficha (Server Component; notFound si no existe o la RLS la esconde)
        [id]/OportunidadDetalle.tsx  Client: DetailHeader (Registrar actividad + "Presupuesto" + ⋮), recorrido por el embudo con las
                                   acciones de etapa, historial (FilaHistoria), auditoría, riel "Datos"; drawers Editar/Reasignar/Actividad
        [id]/presupuesto/         CRM 2.0 (Lote D): presupuesto imprimible (F6). page.tsx (server: oportunidad, proveedor, logo firmado,
                                   catálogo, anteriores); PresupuestoView.tsx (client: encabezado, vista dividida desde 1280 — editor en
                                   grilla densa + totales + guardados | hoja escalada —, una columna debajo); Hoja.tsx (EL PAPEL, sin cambios
                                   respecto de la 1.0.0, fuera de UI_ROOT); usePresupuesto.ts (estado, guardar con sinTrabarse, imprimir y
                                   actividad); logica.ts(+.check) (pura: líneas, mover, foco tras quitar/mover); loading.tsx
  components/
    ui/                        Sumar UI Kit de la landing, el acceso y el layout raíz: ya no es la base del CRM, que usa `crm/` (congelados: UIComponents, Toast y Tooltip)
      UIComponents.tsx          cn, Card, Button, Input… (congelado: lo importan las pantallas de acceso)
      Toast.tsx / Tooltip.tsx   ToastProvider y TooltipHost del layout raíz (congelados)
      backdropClose.ts          Cierre a prueba de arrastre (lo usan los overlays CRM)
    landing/                    Solo para la landing pública (ver design-overrides.md §12)
      ParticleField.tsx         Canvas de partículas: isotipo, halo y cielo; reacciona al mouse
      BallCursor.tsx            Cursor pelota de fútbol + spotlight de las cards
      ProductShowcase.tsx       Ventanas simuladas del CRM (datos de ejemplo)
    AuthCard.tsx                Tarjeta de las pantallas de acceso (login, recuperar, sin acceso)
    Logo.tsx                    GoalMark: isotipo en currentColor (sidebar, login, loader)
    Cancha.tsx                  MarcasCancha: la cancha en SVG sobre la superficie .cesped
    Equipamiento.tsx            Íconos del rubro (arco, red, pelota…) + IconoEquipo
    FiltrosUrl.tsx              useFiltrosUrl (filtros en la URL con router.replace + useTransition), useBusquedaUrl (300 ms),
                                AnuncioResultados (FiltroFecha y BarraPendiente se borraron en el Lote E; CajaBusqueda y FiltroSelect, antes de la 2.0)
    crm/                        CRM 2.0 (design-system/crm-2/MASTER.md §10): primitivos, shell y composiciones. Se importan por archivo, sin barril
      Button / Field / Select / Menu / Popover / Tooltip / Tabs / Status / Panel / Feedback / Drawer / Dialog / Toast / Pagination / DataTable
                                Primitivos de la Etapa 1 (Button y Field, Status, Panel, Feedback y DataTable son server-safe); consumen solo `--crm-*`
      DatePicker.tsx / fecha.ts(+.check)   DatePicker y DateTimePicker propios: campo con máscara dd/mm/aaaa (+ hh:mm) que se tipea y calendario con
                                teclado en `#crm-portal`; mismo valor que el input nativo ("YYYY-MM-DD")
      PageBar.tsx / StatStrip.tsx   Barra de página (PageBar, DetailHeader, SectionBar) y franja de cifras, server-safe
      cx.ts / portal.tsx / overlay.ts / teclado.ts(+.check) / CrmRoot.tsx   Clases compartidas (UI_ROOT, TYPE, FOCUS…), `CrmPortal` → `#crm-portal`, pila de capas y
                                anclaje (`useLayer`, `useAnchor`), lógica pura del teclado, y el wrapper `[data-crm]` con las fuentes IBM Plex
      Del Lote A:
      Lista.tsx                 useSeleccionUrl (master-detail por `?sel=`), useFocoFilas, ListFooter, PanelVistaPrevia
      seleccion.ts(+.check)     Lógica pura: ↑/↓ (vecinoSel), tab válida, fila que recibe el foco tras una acción
      PreviewPanel.tsx / Skeletons.tsx / MoneyInput.tsx   Vista previa, cargas (lista, ficha y tablero), monto con máscara
      barra.ts(+.check)         Lote E: ancho de la barra de dato (anchoBarra) y % del total (porcentajeDe); DataTable → CellBar y TFoot
      Toolbar.tsx               SearchField / SearchInput, FechaFiltro, ToggleChip y "Más filtros" (MasFiltros: los filtros secundarios con poco ancho)
      FilaCompleta.tsx          Fila que ocupa las columnas VISIBLES: ajusta su `colSpan` a las cabeceras que el contenedor no esconde (vacíos de toda lista y el detalle de Ventas)
      cuenta/SeccionesCuenta.tsx  Secciones de ficha 360 y vista previa compartidas por empresa y contacto
      cuenta/HistoriaCuenta.tsx   Historia de la cuenta; exporta FilaHistoria / FilaActividad (también la usa la ficha de oportunidad)
      cuenta/FormDrawer.tsx       FormDrawer (Cancelar / Guardar → "Guardando…"), CampoTexto/Fecha/Area/Opciones, Par, useApertura
      LinkManual.tsx            Lote F: link de activación sin SMTP ("Copiar" / "Cerrar"), de Usuarios y del panel de plataforma
      shell/                    AppFrame (variante `plataforma` para /admin), Rail, Topbar, Crumbs, CommandPalette, logica.ts(+.check)
    ActividadesTimeline.tsx     ICONO_POR_CODIGO: ícono de cada tipo de actividad (las filas las dibuja crm/cuenta/HistoriaCuenta)
    ResumenIA.tsx               useResumenIA: estado de "Resumir con IA" (F7; lo dibuja crm/cuenta); IaAviso.tsx: "Cómo usamos la IA"
    BajaCliente.tsx             Baja lógica y reactivación de empresas y contactos, sin UI (la dibuja crm/cuenta/BajaDialog)
  lib/
    utils.ts                   cn() — merge de clases Tailwind
    brand.ts                   APP_NAME — única fuente del nombre de la app
    contacto.ts                Datos de contacto y remitente SMTP, leídos de variables de entorno
    sesion.ts                  getSesion(), exigirPermiso() y origenPublico() (SITE_URL para los links de mails)
    permisos.ts                Catálogo de 19 permisos, ROLES_POR_DEFECTO, rutaInicial()
    permisos.check.ts          Self-check: el catálogo coincide con el CHECK de la 0007
    cuentas.ts                 Alta, activación, recuperación y límite de mails (solo servidor)
    email/                     enviar.ts (único punto de salida SMTP), layout.ts (HTML de mails), plantillas.ts
    clientes.ts                Estados, tipos de cliente, errores de la base en palabras, fechas (horario AR)
    clientes.check.ts          Self-check: node --test src/lib/clientes.check.ts
    paginacion.ts              Paginación y búsqueda por URL: leer parámetros sin confiar en ellos, rango, escape de ILIKE/.or(), leerPagina
    paginacion.check.ts        Self-check: node --test src/lib/paginacion.check.ts
    oportunidades.ts           Etapas válidas por acción, validaciones, errores en palabras, línea de tiempo, auditoría
    oportunidades.check.ts     Self-check: node --test src/lib/oportunidades.check.ts
    timeline360.ts             Ficha 360 (F5): línea de tiempo unificada, meses argentinos, resumen de la cuenta
    cuenta360.ts               Ficha 360 (F5): lectura acotada (200 por tipo) de oportunidades, historial, ventas, avisos y actividades
    tablero.ts                 Tablero del responsable (F5): sin actividad, pipeline por responsable, cierres del mes, motivos
    embudo.ts                  Conversión del embudo (F5): entraron, avanzaron, mediana de estadías, tasa de éxito, ciclo
    navegacion.ts              Pantallas del CRM y sus permisos: la lista única del menú y de las acciones de Ctrl+K
    paleta.ts                  Búsqueda global (F5): grupos permitidos, consulta limpia, acciones rápidas, navegación con flechas
    cambiarEtapa.ts            Único camino del navegador para cambiar de etapa: la RPC `cambiar_etapa`
    guardar.ts                 `sinTrabarse(guardar, liberar)`: corre un guardado y, si TIRA (red caída, Server Action abortada), llama a `liberar` con
                               "No se pudo completar la acción. Intentá de nuevo." y devuelve false; sin eso un drawer queda en "Guardando…" para siempre
    contrasteCrm.ts            Lee `crm.css` y mide el contraste de los pares de `PARES` (lo corre `contrasteCrm.check.ts`)
    money.ts                   Máscara/parseo es-AR + formatters de display
    money.check.ts             Self-check: node --test src/lib/money.check.ts
    equipo.ts                  tipoEquipo(): qué equipo es un producto, para su ícono
    equipo.check.ts            Self-check: node --test src/lib/equipo.check.ts
    esquema.ts                 esErrorDeEsquema(): reconoce "falta la tabla o la columna" (migración sin aplicar)
    licitaciones.ts            Tipo de oportunidad, validación del formulario y la regla "no ganada antes de la apertura"
    parque.ts                  Parque instalado: vence, días, estado y grupos (misma cuenta que la vista de alertas)
    canchas.ts                 Formatos, medidas y equipamiento sugerido (función pura)
    recambio.ts                Recambio en 1 clic: título, valor, origen, duplicados (función pura)
    ia/                        IA asistida (F7): config (clave y modelo), cliente y generar (SDK, `server-only`), prompts, contexto (mínimo,
                               sin datos personales), errores, limite; self-checks contexto, errores y limite
    presupuesto.ts             Presupuesto (F6): cuentas en centavos, regla de IVA, validez, número `N° 000042`, validación (función pura)
    (cada uno con su .check.ts)
    supabase/
      client.ts                Cliente Supabase para Client Components (drawers, mutaciones)
      server.ts                Cliente Supabase para Server Components/Actions (usa cookies())
      admin.ts                  Cliente con service_role (`server-only`); solo tras verificar permisos
      middleware.ts             Lógica de refresco de sesión + redirects, usada por proxy.ts
      types.ts                  Tipos Database generados. OJO: anteriores a la 0007 (13 tablas); regenerar
  proxy.ts                      Proxy raíz de Next.js (exige login; públicas: /, /login, /recuperar, /auth/confirm)
docs/
  DESIGN.md                     Sumar UI Kit canónico (vendoreado, READ-ONLY, no editar)
  design-overrides.md           Dónde esta app se desvía del kit a propósito, y por qué
  README.md                     Índice de la documentación
  notas-de-version.md           Todo lo agregado desde la primera entrega + estado frente a la consigna
  arquitectura.md, modelo-de-datos.md, reglas-de-negocio.md, seguridad.md, deploy.md, pruebas.md
  decisiones/                   ADR: por qué se decidió cada cosa de peso
CHANGELOG.md, CONTRIBUTING.md, SECURITY.md     En la raíz
supabase/
  migrations/
    0001_init_schema.sql        Tablas, índices, triggers, RLS
    0002_seed_data.sql          Etapas y productos precargados
    0003_productos_ventas_alertas_bitacora.sql
                                Vida útil, ventas, bitácora, alertas enviadas y vista de alertas
    0004_multitenant.sql        Organizaciones, organizacion_id en todo, FKs compuestas, RLS por org
    0005_roles_permisos.sql     Roles con permisos por organización y RLS por permiso
    0006_superadmin_sin_organizacion.sql  El superadmin sale de la org demo (solo plataforma)
    0007_entrega_final.sql      Catálogos, estados, reglas del embudo, historial, cartera propia, logo
    0008_baja_logica.sql        Sin DELETE en empresas/contactos; siempre una etapa ganada y una perdida (pendiente en la base viva)
    0009_reglas_oportunidades.sql  Fecha de cierre no futura (hora de Argentina), empresa o contacto obligatorio (pendiente en la base viva)
    0010_indices_busqueda.sql   Índices para la búsqueda y la paginación del servidor, con un bloque opcional pg_trgm (pendiente en la base viva)
    0011_rubro.sql              Canchas, licitaciones, oportunidades.venta_item_id y la regla de la apertura (pendiente en la base viva)
    0012_presupuestos.sql       Presupuestos numerados por organización (trigger + contador), inmutables y sin borrado (pendiente en la base viva)
  tests/                        SQL con rollback; devuelven "TODO OK" o fallan con "FALLA:"
    0005_permisos.sql           Aislamiento y permisos (correr DESPUÉS de la 0007)
    0007_reglas.sql             Reglas de la 0007 (correr después de aplicarla)
    0008_baja_logica.sql        Baja lógica y etapas de cierre (correr después de aplicar la 0008)
    0009_reglas_oportunidades.sql  Reglas de la 0009 (correr después de aplicarla)
    0011_rubro.sql              Canchas, licitaciones y la regla de la apertura (correr después de aplicar la 0011)
    0012_presupuestos.sql       Numeración, aislamiento, inmutabilidad y sin borrado de presupuestos (correr después de aplicar la 0012)
    0007_reejecucion.sql        Re-ejecución de la 0007 (SOLO en una base sin la 0007)
    (src/lib/migraciones.check.ts y manual.check.ts: el kit está al día y las figuras del manual existen)
  aplicar/                      Kit: aplicar_0008_a_0012.sql (las cinco migraciones pendientes en un archivo, con select de verificación) y LEEME.md
  seeds/demo_catedra.sql        Organización "Cátedra UNLaM (demo)" con una cuenta por rol y datos
  seeds/demo_rubro.sql          Complemento de la demo (0011 y 0012): canchas, datos de la licitación y un presupuesto guardado
  seeds/e2e_tests.sql           Organización "E2E Tuco & Nito" (admin y vendedor) para las pruebas E2E; nunca la demo
scripts/manual/                 Manual de usuario: figuras.mjs (lista de figuras), capturas.mjs (Playwright) y generar.mjs (PDF con Chromium); fuentes.mjs
scripts/migraciones/consolidar.mjs  Arma el kit de migraciones
scripts/guard/                  Guardas de CRM 2.0: frozen-files.mjs (hashes), landing.spec.ts + landing.css (pixel diff), compare-png.mjs, baseline-crm.mjs
playwright.guard.config.ts      Config de Playwright de `guard:landing` (baselines en design-system/crm-2/guard/landing/)
design-system/crm-2/            CRM 2.0: README.md (contrato de aislamiento), MASTER.md (fuente de verdad visual), guard/ (frozen-files.json y baselines)
design-system/tuco-y-nito/      MASTER.md de la marca: SUPERSEDED para el CRM, vigente para la landing y el acceso
docs/manual/                    Fuente del manual: manual.html, manual.css, capitulos/, capturas/, fuentes/, pendientes.json y LEEME.md
e2e/                            Pruebas E2E de Playwright (F6): acceso.spec.ts, demo.spec.ts, navegacion.spec.ts, helpers.ts y su tsconfig
playwright.config.ts            Config de Playwright (chromium, E2E_BASE_URL, se saltan sin E2E_EMAIL/E2E_PASSWORD)
.github/workflows/ci.yml        CI: lint, tipos, self-checks y build en cada push/PR a main; job E2E aparte con secretos
```

No hay rutas separadas para "nueva empresa": todo alta/edición pasa por el `Drawer`, desde la lista o
desde la ficha. Las fichas (`/empresas/[id]`, `/contactos/[id]`) son de F1b y el detalle
`/oportunidades/[id]` de F2.

### Modelo de datos (Postgres, esquema `public`)

Resumen. El detalle completo (diagrama ER, columnas, FKs, RLS por tabla) está en
[`docs/modelo-de-datos.md`](./docs/modelo-de-datos.md). 18 tablas (20 con la 0011, 22 con la 0012: `presupuestos` y `presupuesto_contadores`) más la vista `alertas_vida_util`.

- **Plataforma**: `organizaciones` (un cliente = una fila; desde la 0007 también datos fiscales y
  `logo_path`), `perfiles` (espejo de `auth.users`: organización, rol, `activo`, `activado_at`,
  `es_superadmin`; solo el servidor lo escribe), `roles` (por organización; `permisos text[]` con
  CHECK de 19 claves), `envios_auth` (límite de mails de cuenta).
- **Clientes**: `empresas` y `contactos` (contacto → empresa opcional). Con `estado`
  (potencial/cliente/inactivo/no_contactar), `responsable_id`, `origen_id`; empresas con
  `tipo_cliente` y `sitio_web`, contactos con `documento`.
- **Comercial**: `productos` (`vida_util_meses`, null = sin seguimiento; se dan de baja con
  `activo`), `etapas` (con `tipo` abierta/ganada/perdida), `oportunidades` (con `estado`,
  `fecha_cierre`, `motivo_perdida_id`, `origen_id`, `probabilidad`, `tipo` directa/licitacion;
  **no se borran**).
- **Rubro (0011)**: `canchas` (de una empresa; baja lógica con `activa`) y `licitaciones` (una por oportunidad);
  `oportunidades.venta_item_id` liga una oportunidad de recambio con el equipo entregado.
- **Ventas y recambio**: `ventas` (hecho consumado, distinto de la oportunidad) y `venta_items`
  (`fecha_entrega` propia y `vida_util_meses` **copiada** del producto por trigger: snapshot).
  `alertas_enviadas` guarda solo lo enviado; las pendientes las calcula la vista
  `alertas_vida_util` (`security_invoker`, ventana de 60 días, sin cron).
- **Actividad e historial**: `bitacora_entradas` (las "actividades": log inmutable, con
  `tipo_actividad_id`, `oportunidad_id`, `resultado`; empresa o contacto), `oportunidad_etapas_historial`
  y `oportunidad_auditoria` (las escriben triggers).
- **Catálogos**: `origenes`, `motivos_perdida`, `tipos_actividad` (por organización, con `activo`).

**Seguridad (importante):** todas las tablas tienen RLS. Cada política pide la organización propia
(`organizacion_id = org_actual()`) **y** el permiso (`tiene_permiso(...)`); las FKs entre tablas de
datos son compuestas `(organizacion_id, id)`. Desde la 0007, empresas, contactos y oportunidades
además se limitan a la cartera propia salvo `clientes.ver_todos`. Un Vendedor ve solo lo asignado;
Responsable comercial y Solo lectura ven todos los clientes; el Administrador tiene los 19 permisos.
El superadmin no tiene organización ni ve datos comerciales. Las reglas de negocio (embudo, cierre,
asignación, vida útil) viven en triggers, no en la UI.

## Supabase

Ya hay un proyecto de Supabase conectado y provisionado (organización `dgmoqhihtjjbetuedaad`,
proyecto `pdseuwdifzywpdgawbrl`, región `us-west-2`). Se armó vía el MCP de Supabase:

- Las migraciones `0001` a `0007` están aplicadas (la `0007` el 2026-10-04, con sus pruebas SQL). La `0008`, la
  `0009`, la `0010` (índices de F3, sin cambios de reglas), la `0011` (rubro, F4) y la `0012` (presupuestos, F6) están en el repositorio pero **falta aplicarlas a mano** en el SQL Editor (en un solo archivo: `supabase/aplicar/aplicar_0008_a_0012.sql`); hasta entonces
  la base no impone "fecha de cierre no futura" ni "empresa o contacto" (la interfaz de F2 sí las valida).
  Se aplican a mano en el SQL Editor, en orden; **aplicar y desplegar enseguida**, ver
  [`docs/deploy.md`](./docs/deploy.md).
- El seed `supabase/seeds/demo_catedra.sql` crea la organización de demostración con una cuenta por
  rol (credenciales en el README).
- `.env.local` tiene las variables de Supabase (archivo gitignoreado, no se commitea). La lista
  completa de variables está en `docs/deploy.md`.
- `src/lib/supabase/types.ts` está generado contra este proyecto real pero **es anterior a la
  0007**: regenerarlo antes de construir pantallas que usen las tablas y columnas nuevas.

Si en algún momento hace falta reconectar a otro proyecto o recrearlo desde cero, el
[README](./README.md) y [`docs/deploy.md`](./docs/deploy.md) tienen los pasos.

## Vercel

**Producción: [crmgads1.vercel.app](https://crmgads1.vercel.app)** — proyecto `crmgads1` (sin
guion; los intentos previos con `crm-gads1` fueron un nombre distinto que quedó descartado),
team `tomasballesteros12-8080`, conectado al repo de GitHub `TBalles/CRM_GADS1`: cada push a
`main` dispara un build y deploy de producción automático. Las env vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) están cargadas en Project
Settings → Environment Variables; también `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` y `SMTP_*` (tabla
completa en `docs/deploy.md`). Verificado andando en producción (login + datos de Supabase + UI
rediseñada) el 2026-09-17.

Nota para el futuro: el MCP de Vercel de esta sesión nunca pudo leer el proyecto vía API
(`list_projects` devolvía `[]` con el proyecto andando perfecto desde el dashboard) — si hace
falta automatizar algo de Vercel de nuevo, probar primero si ese problema se repite antes de
asumir que el proyecto no existe.

## Diseño / UI

Desde la 2.0.0 el CRM (todas las pantallas de `(app)/(crm2)`, `/admin` y el marco `components/crm/shell/`) sigue el sistema **"Ledger"**:
[`design-system/crm-2/MASTER.md`](./design-system/crm-2/MASTER.md) (§10.1–§10.25) es la fuente de verdad visual y
[`design-system/crm-2/README.md`](./design-system/crm-2/README.md) el contrato de aislamiento. Antes de crear o modificar UI del CRM, leé los dos.

- **Primitivos:** solo `src/components/crm/` (importados por archivo, sin barril). No uses `components/ui/*` ni inventes variantes de
  Button, Drawer o Select. Una pantalla nueva va en `(app)/(crm2)/`, aplica `UI_ROOT` en su raíz y cumple la definición de terminado de MASTER §15
  (cero capacidades nuevas: mismos datos, permisos, filtros y mensajes).
- **Tokens:** solo `--crm-*`, definidos en `src/app/(app)/crm.css` bajo `[data-crm]` (claro y `.dark`) y consumidos con utilidades de
  Tailwind v4 (`bg-(--crm-panel)`, `text-(--crm-text)`…). Ningún color, radio, sombra ni z-index literal en un primitivo. Un token nuevo va en los dos
  temas y, si es un par texto/fondo, se suma a `PARES` en `src/lib/contrasteCrm.ts`: `npm test` mide el contraste (piso AA, 4.5:1).
- **`crm.css`:** solo selectores que cuelgan de `[data-crm]` y ningún at-rule global (nada de `@theme`, `@layer`, `@font-face`; `@keyframes crm-*` sí). Lo
  importan solo `(app)/layout.tsx` y `admin/layout.tsx`, nunca el layout raíz. `npm run guard:frozen` lo verifica.
- **Fuentes:** IBM Plex Sans y Mono, cargadas únicamente en `CrmRoot` (la landing y el acceso no las descargan).
- **Portales:** lo flotante va a `#crm-portal` con `CrmPortal` (`position: fixed`, `UI_ROOT`, su `--crm-z-*`). Escape y clic afuera, con `useLayer`.
- **Reglas de campo:** montos con `crm/MoneyInput` + `parseMoney`, nunca `type="number"`; fechas con `DatePicker` (ya no queda `type="date"`); un botón de solo
  ícono es un `IconButton` con `label`; **nunca `title="…"`** (el `TooltipHost` del layout raíz lo reescribe y rompe la hidratación): usá `Tooltip` o `label`.
- **Landing y acceso: no se tocan.** `/`, `/login`, `/recuperar` y `/definir-clave`, y todo lo que importan (lista en `design-system/crm-2/guard/frozen-files.json`),
  están congelados. `docs/DESIGN.md` (kit, solo lectura), `docs/design-overrides.md` y `design-system/tuco-y-nito/MASTER.md` quedaron como historia y para esas
  pantallas: **para el CRM mandan MASTER y README de crm-2**. Si un cambio exige tocar un archivo congelado, se frena y se pide la decisión (procedimiento en el README de crm-2).

### Técnicas de CRM 2.0 que conviene conocer

- **Master-detail por URL, sin rutas paralelas.** Empresas y Contactos: la fila elegida es `?sel=<id>` (`useSeleccionUrl` en `crm/Lista.tsx`, lógica pura en
  `crm/seleccion.ts`: ↑/↓ con `vecinoSel`, Esc cierra). La página servidor dibuja la `VistaPrevia` (`PreviewPanel`) en un `<Suspense key={sel}>`, así que la
  selección es compartible y atrás/adelante anda; el panel existe desde 1280 px (debajo, la fila abre la ficha y un `?sel=` se quita de la URL). La selección se
  marca al instante (optimista) y se suelta cuando el servidor contesta con ese mismo `sel`.
- **Más estado en la URL.** Las fichas llevan su tab en `?tab=` (`tabValida`: una tab inexistente o sin permiso cae en Resumen); Oportunidades alterna `?vista=`;
  Usuarios usa `?tab=roles`; **Configuración** usa `?s=empresa|etapas|tipos|origenes|motivos` y cambia de sección con `history.pushState`, sin ir al servidor.
- **`sinTrabarse`** (`src/lib/guardar.ts`). Los guardados manejan sus errores esperados (`{ error }` de Supabase, `{ ok: false }` de una Server Action); lo que no manejan
  es que la llamada **tire** (red caída, despliegue en curso). `sinTrabarse(guardar, liberar)` corre el guardado dentro de un `try`: si termina, devuelve `true`; si tira,
  lo registra en consola, llama a `liberar` con "No se pudo completar la acción. Intentá de nuevo." y devuelve `false`. Quien llama apaga su `saving` y muestra el
  mensaje en el banner; sin esto el drawer queda en "Guardando…" con Cancelar, Escape y la X deshabilitados. Lo usan los formularios y confirmaciones del CRM.
- **`DatePicker` propio** (`crm/DatePicker.tsx`, lógica en `fecha.ts`). Se tipea dd/mm/aaaa (más hh:mm con `time`) y se confirma al salir o con Enter; "Abrir calendario"
  o Alt+↓ abre un calendario no modal (semana de lunes, es-AR) con el teclado del patrón APG; Escape lo cierra solo a él. El valor es el mismo que el del input nativo
  ("YYYY-MM-DD" o "YYYY-MM-DDTHH:mm" en hora local).
- **`FilaCompleta`** (`crm/FilaCompleta.tsx`). Una fila de `DataTable` que ocupa las columnas VISIBLES: el contenedor esconde columnas con `hideBelow`
  (`display: none`) y un `colSpan` fijo dejaría columnas fantasma; la fila lo ajusta en el navegador a las cabeceras que se ven.
- **Guardas del aislamiento.** `npm run guard` = `guard:frozen` (`scripts/guard/frozen-files.mjs` + `design-system/crm-2/guard/frozen-files.json`: hashes de los archivos
  congelados, chequeo de la carpeta `landing/`, `git diff` contra la base y reglas de `crm.css`) + `guard:landing` (`playwright.guard.config.ts` + `scripts/guard/landing.spec.ts`:
  pixel diff, tolerancia cero, de `/`, `/login` y `/recuperar` contra `design-system/crm-2/guard/landing/`). Detalle, variables y límites: README de crm-2 y [`docs/pruebas.md`](./docs/pruebas.md).
  Un cambio aprobado de un archivo congelado se commitea y recién después se regeneran las baselines (`npx playwright test -c playwright.guard.config.ts --update-snapshots`)
  y el manifiesto (`GUARD_BASE=<commit> node scripts/guard/frozen-files.mjs --update`).

## Convenciones de código

- Nombres de tablas, columnas, rutas y textos de UI **en español**, consistente con el dominio
  del negocio (empresas, contactos, oportunidades, embudo, etapas).
- Identificadores de código (variables, funciones, tipos TS) en inglés/español mixto está bien,
  pero seguí el patrón ya usado en cada archivo en vez de mezclar convenciones nuevas.
- Las Server Actions son solo para lo privilegiado (login/cookies, clave de servicio, mails, la clave de la IA). Cada una
  verifica sesión y permiso con `getSesion()` y valida tipo y forma de sus argumentos. El CRUD
  (empresas, contactos, oportunidades, productos, ventas) muta la base directo desde Client
  Components — ver "Por qué mutaciones client-side" más arriba antes de agregar un Server Action
  nuevo para alguna de esas pantallas.
- Las reglas de negocio van en la base (triggers, CHECK, RLS), no en la UI. Un permiso nuevo se
  agrega en `src/lib/permisos.ts` **y** en la migración (CHECK + roles por defecto):
  `permisos.check.ts` lee `0007_entrega_final.sql` y falla si divergen.
- Migraciones: aditivas si se puede, idempotentes, probadas dentro de `begin ... rollback`, con su
  prueba en `supabase/tests/`. Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Commits: Conventional Commits y **sin líneas de atribución de IA** (nada de `Co-Authored-By`).
- Los formularios usan los primitivos de CRM 2.0 (`src/components/crm/Field.tsx` y `crm/cuenta/FormDrawer.tsx`:
  FormDrawer, CampoTexto, CampoOpciones…) en vez de reinventar inputs estilizados en cada página.
- Los tipos de la base (`src/lib/supabase/types.ts`) están generados contra el proyecto real de
  Supabase (`generate_typescript_types` del MCP de Supabase, equivalente a
  `supabase gen types typescript`). Si se agrega o modifica una tabla/columna en las migraciones
  SQL, hay que volver a generar este archivo en el mismo cambio — si no, los embeds
  (`etapa:etapas(...)`, `empresa:empresas(...)`, etc.) pueden perder el tipado correcto.

## Comandos

```bash
npm run dev      # servidor de desarrollo (http://localhost:3000)
npm run build    # build de producción
npm run lint     # eslint src e2e playwright.config.ts scripts/guard playwright.guard.config.ts --max-warnings=0 (sin advertencias)
npm run typecheck  # next typegen + tsc --noEmit sobre src, sobre e2e y sobre scripts/guard (cada uno con su tsconfig)

# Self-checks (sin framework, runner de Node): money, equipo, permisos, email/layout, alertas/plantillas, clientes, oportunidades, presupuesto, ia, migraciones, manual...
npm test                             # node --test "src/**/*.check.ts": 37 archivos, 442 pruebas (123 son los pares de contraste de contrasteCrm.check.ts)
node --test src/lib/money.check.ts   # o uno solo

npm run manual              # manual de usuario: capturas (app + MANUAL_EMAIL…) y PDF; `manual:capturas` y `manual:pdf` por separado
npm run migraciones:consolidar   # regenera supabase/aplicar/aplicar_0008_a_0012.sql

npm run guard           # guardas de CRM 2.0 = guard:frozen (hashes, git diff, reglas de crm.css; no necesita app) + guard:landing (pixel diff; build + start, necesita .env)
npm run guard:frozen    # solo la mitad rápida; es la que conviene correr siempre
npm run guard:baseline-crm   # fotos del CRM (necesita la app en producción y MANUAL_EMAIL/MANUAL_PASSWORD) para comparar antes/después

npm run test:e2e   # Playwright (e2e/); necesita E2E_EMAIL, E2E_PASSWORD, E2E_EMAIL_VENDEDOR, E2E_PASSWORD_VENDEDOR y E2E_BASE_URL; sin credenciales se saltan
```

Antes de pushear pasan `lint`, `typecheck`, `test` y `next build` (la CI de `.github/workflows/ci.yml` corre lo mismo) y `npm run guard:frozen` (la CI todavía no corre las guardas). Las pruebas SQL de
`supabase/tests/` se pegan en el SQL Editor (hacen rollback); `0005_permisos.sql` y `0007_reglas.sql`
se corren después de la 0007, y `0007_reejecucion.sql` solo en una base que no la tiene. Detalle en
[`docs/pruebas.md`](./docs/pruebas.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
