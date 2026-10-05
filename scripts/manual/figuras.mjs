/**
 * Las figuras del manual: qué pantalla es, con qué cuenta se mira, cómo se llega y qué tiene que haber en
 * pantalla para darla por buena. `capturas.mjs` recorre esta lista; `generar.mjs` la usa para saber el
 * tamaño de cada figura pendiente.
 *
 * REGLAS (las lee quien agregue una figura)
 *  - Solo NAVEGACIÓN. Abrir un formulario y sacarle la foto está bien; guardar, crear, enviar o confirmar una baja, no.
 *    Todo lo que se abre se cierra con Escape (o "Cancelar") antes de seguir.
 *  - `esperar` es lo que prueba que la pantalla está de verdad (no la versión degradada de una migración sin
 *    aplicar). Si no aparece, la figura queda en `pendientes.json` con su `pendiente` como motivo y el manual muestra
 *    el recuadro «Captura pendiente». La próxima corrida, con la pantalla disponible, la llena sola.
 *  - Cada `id` tiene que estar también en un `<figure data-fig="id">` de algún capítulo (`generar.mjs` lo verifica).
 *
 * Campos de cada figura
 *   id, cap, titulo   identificación (`cap` es el número de capítulo, para el informe de pendientes)
 *   rol               "publico" | "admin" | "vendedor" | "superadmin"
 *   ruta | ir(page,h) a dónde se va
 *   esperar(page,h)   lanza un error si lo esperado no está
 *   preparar(page,h)  acciones previas a la foto (abrir un panel, tipear en una caja…)
 *   modo              "pantalla" (todo el viewport) | "main" (solo el área de contenido, alto adaptado) | "elemento"
 *   elemento(page,h)  el locator a fotografiar (modo "elemento")
 *   margen            (modo "elemento") píxeles de aire alrededor del recorte
 *   zoom              (solo para el PDF) multiplica el tamaño en papel de una captura chica (formularios, modales) para que se lea
 *   recorteAlto       (modo "elemento") si el elemento es más alto que esto (px), se recorta la parte de arriba
 *   ancho, alto       viewport (por defecto 1440 × 900); `alto: "auto"` lo ajusta al contenido (hasta `altoMax`)
 *   movil             true: 390 de ancho, escala 2
 *   aspecto           relación ancho/alto aproximada de la foto, para el recuadro de pendiente
 *   pendiente         motivo que se muestra si no se puede capturar
 */

const MIGRACION_0011 = "Se activa al aplicar la migración 0011";
const MIGRACION_0012 = "Se activa al aplicar la migración 0012";
const SIN_IA = "Se activa al cargar ANTHROPIC_API_KEY en el servidor";

/** Espera un texto visible; si no está en 15 s, lanza (la figura queda pendiente). */
const texto = (t, opts = {}) => async (page) => {
  await page.getByText(t, { exact: false, ...opts }).filter({ visible: true }).first().waitFor({ state: "visible", timeout: 15_000 });
};
const rol = (nombre, opts = {}) => async (page) => {
  await page.getByRole(nombre, opts).first().waitFor({ state: "visible", timeout: 15_000 });
};
export const dialogo = (page) => page.locator('[role="dialog"]:visible').last();

/** La tarjeta de las pantallas de acceso (AuthCard: recuperar, definir clave). */
const tarjetaAuth = (page) => page.locator("div.max-w-md.rounded-2xl").first();

/** La tarjeta (Card) que contiene un título: sube desde el texto hasta el primer ancestro con aspecto de tarjeta. */
const tarjetaDe = (titulo) => (page) =>
  page
    .getByText(titulo, { exact: true })
    .first()
    .locator('xpath=ancestor::*[contains(@class,"bg-card") and contains(@class,"shadow-sm")][1]');

export const FIGURAS = [
  // ───────────────────────── 2. Primeros pasos
  { id: "login", cap: 2, titulo: "Pantalla de ingreso", rol: "publico", ruta: "/login", modo: "elemento", elemento: (page) => page.locator("form").first().locator("xpath=ancestor::div[contains(@class,'max-w-sm')][1]"), margen: 28, zoom: 1.6, esperar: texto("Ingresar", { exact: true }), aspecto: "420/470" },
  { id: "recuperar", cap: 2, titulo: "Recuperar la contraseña", rol: "publico", ruta: "/recuperar", modo: "elemento", elemento: tarjetaAuth, margen: 24, zoom: 1.6, esperar: rol("button", { name: /enlace|recuper|enviar/i }), aspecto: "450/430" },
  { id: "definir-clave", cap: 2, titulo: "Elegir la contraseña", rol: "admin", ruta: "/definir-clave", modo: "elemento", elemento: tarjetaAuth, margen: 24, zoom: 1.6, esperar: async (page) => { await page.locator('input[type="password"]').first().waitFor({ timeout: 15_000 }); }, aspecto: "450/470" },
  { id: "interfaz", cap: 2, titulo: "La interfaz: menú, búsqueda y modo claro/oscuro", rol: "admin", ruta: "/dashboard", modo: "pantalla", esperar: texto("en juego"), aspecto: "1440/900" },
  { id: "modo-oscuro", cap: 2, titulo: "El mismo tablero en modo oscuro", rol: "admin", ruta: "/dashboard", modo: "pantalla", esperar: texto("en juego"), preparar: async (page) => { await page.getByRole("button", { name: /Modo claro/ }).first().click(); await page.waitForTimeout(500); }, aspecto: "1440/900" },
  { id: "movil-menu", cap: 2, titulo: "El menú en el celular", rol: "admin", ruta: "/dashboard", movil: true, modo: "pantalla", esperar: texto("en juego"), preparar: async (page) => { await page.getByRole("button", { name: "Abrir menú" }).click(); await page.waitForTimeout(500); }, aspecto: "390/844" },
  { id: "movil-tablero", cap: 2, titulo: "El tablero en el celular", rol: "admin", ruta: "/dashboard", movil: true, modo: "pantalla", esperar: texto("en juego"), aspecto: "390/844" },
  { id: "paleta-inicio", cap: 19, titulo: "Ctrl+K con la caja vacía", rol: "admin", ruta: "/ventas", modo: "pantalla", esperar: rol("heading", { level: 1 }), preparar: async (page) => { await page.keyboard.press("Control+k"); await page.getByRole("dialog").waitFor({ timeout: 10_000 }); await page.waitForTimeout(400); }, aspecto: "1440/900" },

  // ───────────────────────── 4. Tablero
  { id: "tablero", cap: 4, titulo: "El tablero (Inicio)", rol: "admin", ruta: "/dashboard", modo: "main", alto: "auto", altoMax: 1500, esperar: texto("en juego"), aspecto: "1184/1250" },

  // ───────────────────────── 5. Empresas
  { id: "empresas-lista", cap: 5, titulo: "Lista de empresas", rol: "admin", ruta: "/empresas", modo: "main", alto: "auto", altoMax: 1100, esperar: texto("Nueva empresa"), aspecto: "1184/820" },
  { id: "empresa-form", cap: 5, titulo: "Alta de una empresa", rol: "admin", ruta: "/empresas", modo: "elemento", elemento: dialogo, alto: 1500, esperar: texto("Nueva empresa"), preparar: async (page) => { await page.getByRole("button", { name: "Nueva empresa" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/1100" },
  { id: "empresas-vendedor", cap: 5, titulo: "La lista de empresas de un Vendedor: solo su cartera", rol: "vendedor", ruta: "/empresas", modo: "main", alto: "auto", altoMax: 1000, esperar: texto("Mostrando"), aspecto: "1184/700" },
  { id: "empresas-filtros-baja", cap: 5, titulo: "Empresas dadas de baja", rol: "admin", ruta: "/empresas", modo: "main", alto: "auto", altoMax: 1100, esperar: texto("Ver dadas de baja"), preparar: async (page) => { await page.getByRole("button", { name: /Ver dadas de baja/ }).first().click(); await page.waitForTimeout(1500); }, aspecto: "1184/820" },

  // ───────────────────────── 6. Contactos
  { id: "contactos-lista", cap: 6, titulo: "Lista de contactos", rol: "admin", ruta: "/contactos", modo: "main", alto: "auto", altoMax: 1100, esperar: texto("Nuevo contacto"), aspecto: "1184/820" },
  { id: "contacto-form", cap: 6, titulo: "Alta de un contacto", rol: "admin", ruta: "/contactos", modo: "elemento", elemento: dialogo, alto: 1500, esperar: texto("Nuevo contacto"), preparar: async (page) => { await page.getByRole("button", { name: "Nuevo contacto" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/1100" },
  { id: "contacto-ficha", cap: 6, titulo: "Ficha de un contacto", rol: "admin", ir: async (page, h) => h.abrirFicha("/contactos", /Martín Gutiérrez|Gutiérrez/), modo: "main", alto: "auto", altoMax: 575, esperar: rol("tab", { name: /^Resumen/, selected: true }), aspecto: "1184/575" },

  // ───────────────────────── 7. Ficha 360
  { id: "ficha-resumen", cap: 7, titulo: "Ficha 360: datos, resumen y contactos de la cuenta", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Club Atlético San Justo"), modo: "main", alto: "auto", altoMax: 598, esperar: rol("tab", { name: /^Resumen/, selected: true }), aspecto: "1184/598" },
  { id: "ficha-historia", cap: 7, titulo: "Historia de la cuenta: todo lo que pasó, mes por mes", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Club Atlético San Justo"), modo: "elemento", elemento: tarjetaDe("Historia de la cuenta"), recorteAlto: 820, alto: 2600, esperar: texto("Historia de la cuenta"), aspecto: "549/820" },
  { id: "ficha-parque", cap: 7, titulo: "Parque instalado: lo entregado, ordenado por urgencia", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Club Atlético San Justo"), modo: "elemento", elemento: tarjetaDe("Parque instalado"), alto: 2600, esperar: texto("Parque instalado"), aspecto: "760/520" },
  { id: "ficha-canchas", cap: 7, titulo: "Canchas del cliente y equipamiento sugerido", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Complejo Fútbol 5 La Tablada"), modo: "elemento", elemento: tarjetaDe("Canchas"), alto: 2600, esperar: texto("Canchas", { exact: true }), pendiente: MIGRACION_0011, aspecto: "760/520" },
  { id: "cancha-form", cap: 7, titulo: "Alta de una cancha", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Complejo Fútbol 5 La Tablada"), modo: "elemento", elemento: dialogo, alto: 1500, esperar: async (page) => { await page.getByRole("button", { name: /Agregar cancha|Agregar/ }).first().waitFor({ timeout: 8_000 }); await page.getByText("Canchas", { exact: true }).first().waitFor({ timeout: 8_000 }); }, preparar: async (page) => { const sec = page.getByText("Canchas", { exact: true }).first().locator('xpath=ancestor::*[contains(@class,"bg-card")][1]'); await sec.getByRole("button", { name: /Agregar/ }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(400); }, pendiente: MIGRACION_0011, zoom: 1.2, aspecto: "520/760" },
  { id: "ia-resumen", cap: 7, titulo: "El botón «Resumir con IA» en la historia de la cuenta", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Club Atlético San Justo"), modo: "elemento", elemento: tarjetaDe("Historia de la cuenta"), recorteAlto: 700, alto: 2600, esperar: rol("button", { name: /Resumir con IA/ }), pendiente: SIN_IA, aspecto: "549/700" },

  // ───────────────────────── 8. Oportunidades
  { id: "opp-tablero", cap: 8, titulo: "El tablero de oportunidades, una columna por etapa", rol: "admin", ruta: "/oportunidades", modo: "main", alto: "auto", altoMax: 1000, esperar: texto("En el tablero"), aspecto: "1184/800" },
  { id: "opp-tarjeta-menu", cap: 8, titulo: "El menú de una tarjeta: cambiar de etapa y cerrar", rol: "admin", ruta: "/oportunidades", modo: "main", alto: "auto", altoMax: 1000, esperar: texto("En el tablero"), preparar: async (page) => { await page.getByRole("button", { name: /^Acciones de Dos arcos de fútbol 5/ }).click(); await page.waitForTimeout(500); }, aspecto: "1184/800" },
  { id: "opp-lista", cap: 8, titulo: "La lista de oportunidades con sus filtros", rol: "admin", ruta: "/oportunidades?vista=lista", modo: "main", alto: "auto", altoMax: 1300, esperar: texto("Mostrando"), aspecto: "1184/900" },
  { id: "opp-form", cap: 8, titulo: "Alta de una oportunidad", rol: "admin", ruta: "/oportunidades", modo: "elemento", elemento: dialogo, alto: 1700, esperar: texto("En el tablero"), preparar: async (page) => { await page.getByRole("button", { name: "Nueva oportunidad" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/1200" },
  { id: "opp-detalle", cap: 8, titulo: "Detalle de una oportunidad", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/), modo: "main", alto: "auto", altoMax: 1500, esperar: texto("Cambiar etapa"), aspecto: "1184/1100" },
  { id: "opp-cambiar-etapa", cap: 8, titulo: "Cambiar de etapa con una observación", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/), modo: "elemento", elemento: dialogo, alto: 1200, esperar: texto("Cambiar etapa"), preparar: async (page) => { await page.getByRole("button", { name: "Cambiar etapa" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.4, aspecto: "520/520" },
  { id: "opp-ganada", cap: 8, titulo: "Marcar ganada", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/), modo: "elemento", elemento: dialogo, alto: 1200, esperar: texto("Marcar ganada"), preparar: async (page) => { await page.getByRole("button", { name: "Marcar ganada" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.4, aspecto: "520/520" },
  { id: "opp-perdida", cap: 8, titulo: "Marcar perdida: el motivo es obligatorio", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/), modo: "elemento", elemento: dialogo, alto: 1200, esperar: texto("Marcar perdida"), preparar: async (page) => { await page.getByRole("button", { name: "Marcar perdida" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.4, aspecto: "520/560" },
  { id: "opp-cerrada", cap: 8, titulo: "Una oportunidad cerrada: Reabrir y Cambiar resultado", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Pelotas N°5 para el torneo/), modo: "main", alto: "auto", altoMax: 1500, esperar: texto("Reabrir"), aspecto: "1184/1000" },
  { id: "opp-reabrir", cap: 8, titulo: "Reabrir una oportunidad cerrada", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Pelotas N°5 para el torneo/), modo: "elemento", elemento: dialogo, alto: 1200, esperar: texto("Reabrir"), preparar: async (page) => { await page.getByRole("button", { name: "Reabrir" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.4, aspecto: "520/520" },
  { id: "opp-resultado", cap: 8, titulo: "Cambiar el resultado de una cerrada", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Pelotas N°5 para el torneo/), modo: "elemento", elemento: dialogo, alto: 1200, esperar: texto("Cambiar resultado"), preparar: async (page) => { await page.getByRole("button", { name: "Cambiar resultado" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.4, aspecto: "520/560" },

  // ───────────────────────── 9. Licitaciones
  { id: "lic-lista", cap: 9, titulo: "La lista filtrada por tipo «Licitación municipal»", rol: "admin", ruta: "/oportunidades?vista=lista&tipo=licitacion", modo: "main", alto: "auto", altoMax: 800, esperar: texto("1 resultado"), aspecto: "1184/520" },
  { id: "lic-form", cap: 9, titulo: "El formulario de oportunidad con los datos de la licitación", rol: "admin", ruta: "/oportunidades", modo: "elemento", elemento: dialogo, alto: 1900, esperar: texto("En el tablero"), preparar: async (page) => { await page.getByRole("button", { name: "Nueva oportunidad" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await dialogo(page).getByText("Licitación municipal").first().waitFor({ timeout: 4_000 }); await dialogo(page).getByText("Licitación municipal").first().click(); await page.waitForTimeout(500); }, pendiente: MIGRACION_0011, aspecto: "520/1400" },
  { id: "lic-detalle", cap: 9, titulo: "El detalle de una licitación: organismo, expediente y apertura", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Licitación: equipamiento/), modo: "main", alto: "auto", altoMax: 1500, esperar: texto("Organismo", { exact: true }), pendiente: MIGRACION_0011, aspecto: "1184/1100" },

  // ───────────────────────── 10. Actividades e historial
  { id: "actividad-form", cap: 10, titulo: "Registrar una actividad", rol: "admin", ir: async (page, h) => h.abrirFicha("/empresas", "Club Atlético San Justo"), modo: "elemento", elemento: dialogo, alto: 1500, esperar: texto("Registrar actividad"), preparar: async (page) => { await page.getByRole("button", { name: "Registrar actividad" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/760" },
  { id: "opp-linea-tiempo", cap: 10, titulo: "La línea de tiempo de una oportunidad", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/), modo: "elemento", elemento: (page) => page.getByText(/Historial|Línea de tiempo|Actividad/).first().locator('xpath=ancestor::*[contains(@class,"bg-card") and contains(@class,"shadow-sm")][1]'), alto: 2200, esperar: texto("Cambiar etapa"), aspecto: "760/520" },

  // ───────────────────────── 11. Productos
  { id: "productos-lista", cap: 11, titulo: "El catálogo de productos con su vida útil", rol: "admin", ruta: "/productos?estado=activo", modo: "main", alto: "auto", altoMax: 1400, esperar: texto("Nuevo producto"), aspecto: "1184/1000" },
  { id: "producto-form", cap: 11, titulo: "Alta de un producto", rol: "admin", ruta: "/productos", modo: "elemento", elemento: dialogo, alto: 1500, esperar: texto("Nuevo producto"), preparar: async (page) => { await page.getByRole("button", { name: "Nuevo producto" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/760" },

  // ───────────────────────── 12. Ventas y parque instalado
  { id: "ventas-lista", cap: 12, titulo: "El historial de ventas", rol: "admin", ruta: "/ventas", modo: "main", alto: "auto", altoMax: 1100, esperar: texto("Nueva venta"), aspecto: "1184/820" },
  { id: "venta-form", cap: 12, titulo: "Registrar una venta", rol: "admin", ruta: "/ventas", modo: "elemento", elemento: dialogo, alto: 1500, esperar: texto("Nueva venta"), preparar: async (page) => { await page.getByRole("button", { name: "Nueva venta" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/900" },

  // ───────────────────────── 13. Alertas
  { id: "alertas", cap: 13, titulo: "Alertas de recambio: vencidas, por vencer y sin avisar", rol: "admin", ruta: "/alertas", modo: "main", alto: "auto", altoMax: 1250, esperar: texto("Alertas de recambio"), aspecto: "1184/950" },
  { id: "alerta-recambio", cap: 13, titulo: "«Crear oportunidad de recambio» en una alerta", rol: "admin", ruta: "/alertas", modo: "main", alto: "auto", altoMax: 800, esperar: rol("button", { name: /Crear oportunidad de recambio/ }), pendiente: MIGRACION_0011, aspecto: "1184/620" },
  { id: "alerta-ia", cap: 13, titulo: "El botón «Redactar con IA» en una alerta", rol: "admin", ruta: "/alertas", modo: "main", alto: "auto", altoMax: 800, esperar: rol("button", { name: /Redactar con IA/ }), pendiente: SIN_IA, aspecto: "1184/620" },
  { id: "alertas-movil", cap: 13, titulo: "Las alertas en el celular", rol: "admin", ruta: "/alertas", movil: true, modo: "pantalla", esperar: texto("Sin avisar"), aspecto: "390/844" },

  // ───────────────────────── 14. Presupuestos
  { id: "presupuesto-editor", cap: 14, titulo: "El editor del presupuesto: líneas, validez y condiciones", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/, "/presupuesto"), modo: "main", alto: "auto", altoMax: 1300, esperar: texto("Agregar línea libre"), aspecto: "1184/1000" },
  { id: "presupuesto-hoja", cap: 14, titulo: "La hoja que se imprime", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/, "/presupuesto"), modo: "elemento", elemento: (page) => page.locator(".hoja-presupuesto").first(), alto: 2400, esperar: async (page) => { await page.locator(".hoja-presupuesto").first().waitFor({ timeout: 15_000 }); }, aspecto: "760/1000" },
  { id: "presupuesto-guardado", cap: 14, titulo: "Un presupuesto guardado y numerado (N° 000042)", rol: "admin", ir: async (page, h) => h.abrirOportunidad(/Dos arcos de fútbol 5/, "/presupuesto"), modo: "elemento", elemento: tarjetaDe("Presupuestos de esta oportunidad"), alto: 2600, esperar: async (page) => { await page.getByText(/N° 0000\d\d/).first().waitFor({ timeout: 6_000 }); }, pendiente: MIGRACION_0012, aspecto: "1184/180" },

  // ───────────────────────── 15. Tablero comercial y conversión
  { id: "tablero-comercial", cap: 15, titulo: "El tablero comercial del equipo", rol: "admin", ruta: "/tablero-comercial", modo: "main", alto: "auto", altoMax: 1700, esperar: texto("Pipeline por responsable"), aspecto: "1184/1300" },
  { id: "embudo", cap: 15, titulo: "La conversión del embudo, etapa por etapa", rol: "admin", ruta: "/embudo", modo: "main", alto: "auto", altoMax: 1700, esperar: texto("Cómo se calcula"), aspecto: "1184/1200" },

  // ───────────────────────── 16. Usuarios y roles
  { id: "usuarios-lista", cap: 16, titulo: "Usuarios del cliente", rol: "admin", ruta: "/usuarios", modo: "main", alto: "auto", altoMax: 900, esperar: texto("Invitar usuario"), aspecto: "1184/600" },
  { id: "usuario-invitar", cap: 16, titulo: "Invitar a un usuario", rol: "admin", ruta: "/usuarios", modo: "elemento", elemento: dialogo, alto: 1300, esperar: texto("Invitar usuario"), preparar: async (page) => { await page.getByRole("button", { name: "Invitar usuario" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "520/520" },
  { id: "usuarios-roles", cap: 16, titulo: "La pestaña Roles", rol: "admin", ruta: "/usuarios?tab=roles", modo: "main", alto: "auto", altoMax: 1200, esperar: texto("Nuevo rol"), aspecto: "1184/800" },
  { id: "rol-form", cap: 16, titulo: "Armar un rol con permisos", rol: "admin", ruta: "/usuarios?tab=roles", modo: "elemento", elemento: dialogo, recorteAlto: 1050, alto: 2400, esperar: texto("Nuevo rol"), preparar: async (page) => { await page.getByRole("button", { name: "Nuevo rol" }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, zoom: 1.2, aspecto: "512/1050" },

  // ───────────────────────── 17. Configuración
  { id: "config-datos", cap: 17, titulo: "Configuración: datos de la empresa y logo", rol: "admin", ruta: "/configuracion", modo: "main", alto: "auto", altoMax: 1300, esperar: texto("Así va a verse en tus presupuestos"), aspecto: "1184/1000" },
  { id: "config-etapas", cap: 17, titulo: "Configuración: etapas del embudo", rol: "admin", ruta: "/configuracion", modo: "main", alto: "auto", altoMax: 1200, esperar: rol("tab", { name: /Etapas/ }), preparar: async (page) => { await page.getByRole("tab", { name: /Etapas/ }).click(); await page.waitForTimeout(700); }, aspecto: "1184/800" },
  { id: "config-tipos", cap: 17, titulo: "Configuración: tipos de actividad", rol: "admin", ruta: "/configuracion", modo: "main", alto: "auto", altoMax: 1200, esperar: rol("tab", { name: /Tipos de actividad/ }), preparar: async (page) => { await page.getByRole("tab", { name: /Tipos de actividad/ }).click(); await page.waitForTimeout(700); }, aspecto: "1184/800" },
  { id: "config-origenes", cap: 17, titulo: "Configuración: orígenes", rol: "admin", ruta: "/configuracion", modo: "main", alto: "auto", altoMax: 1200, esperar: rol("tab", { name: /Orígenes/ }), preparar: async (page) => { await page.getByRole("tab", { name: /Orígenes/ }).click(); await page.waitForTimeout(700); }, aspecto: "1184/700" },
  { id: "config-motivos", cap: 17, titulo: "Configuración: motivos de pérdida", rol: "admin", ruta: "/configuracion", modo: "main", alto: "auto", altoMax: 1200, esperar: rol("tab", { name: /Motivos de pérdida/ }), preparar: async (page) => { await page.getByRole("tab", { name: /Motivos de pérdida/ }).click(); await page.waitForTimeout(700); }, aspecto: "1184/700" },

  // ───────────────────────── 18. Panel de plataforma
  { id: "admin-panel", cap: 18, titulo: "El panel de plataforma: clientes del CRM", rol: "superadmin", ruta: "/admin", modo: "pantalla", alto: 900, esperar: texto("Nuevo cliente"), pendiente: "Hace falta la cuenta de superadmin (MANUAL_EMAIL_SUPERADMIN y MANUAL_PASSWORD_SUPERADMIN); la demo no la incluye", aspecto: "1440/900" },
  { id: "admin-nuevo", cap: 18, titulo: "Dar de alta a un cliente nuevo", rol: "superadmin", ruta: "/admin", modo: "elemento", elemento: dialogo, alto: 1300, esperar: texto("Nuevo cliente"), preparar: async (page) => { await page.getByRole("button", { name: /Nuevo cliente/ }).first().click(); await dialogo(page).waitFor({ timeout: 10_000 }); await page.waitForTimeout(500); }, pendiente: "Hace falta la cuenta de superadmin (MANUAL_EMAIL_SUPERADMIN y MANUAL_PASSWORD_SUPERADMIN); la demo no la incluye", zoom: 1.2, aspecto: "520/760" },

  // ───────────────────────── 19. Búsqueda global
  { id: "paleta-resultados", cap: 19, titulo: "Ctrl+K con resultados", rol: "admin", ruta: "/ventas", modo: "pantalla", esperar: rol("heading", { level: 1 }), preparar: async (page) => { await page.keyboard.press("Control+k"); await page.getByRole("dialog").waitFor({ timeout: 10_000 }); await page.keyboard.type("arco", { delay: 60 }); await page.waitForTimeout(2500); }, aspecto: "1440/900" },
];

export const FIGURA_POR_ID = new Map(FIGURAS.map((f) => [f.id, f]));
