# IA asistida (F7)

Funcionalidad **opcional** de la consigna (pp. 6 y 7): dos borradores que redacta Claude, el modelo de Anthropic, y que
una persona revisa antes de usar. **Se apaga sola**: sin `ANTHROPIC_API_KEY` en el servidor no aparece ningún botón y el
CRM anda exactamente igual que antes.

Estado: **implementado y verificado con un servidor simulado de la API**; **no probado contra la API real** (no había clave
al construirlo). Qué se verificó y qué no, al final.

Contenido: [1. Qué hace](#1-qué-hace) · [2. Las 7 condiciones de la consigna](#2-las-7-condiciones-de-la-consigna) ·
[3. Qué datos salen y cuáles no](#3-qué-datos-salen-y-cuáles-no) · [4. Control de la persona](#4-control-de-la-persona-y-transparencia) ·
[5. Cómo está hecho](#5-cómo-está-hecho) · [6. Costo](#6-costo-por-llamada) · [7. Configuración y cómo apagarla](#7-configuración-y-cómo-apagarla) ·
[8. Límites](#8-límites) · [9. Qué se verificó](#9-qué-se-verificó-y-qué-no)

---

## 1. Qué hace

| Función | Dónde | Qué produce | Qué NO hace |
|---|---|---|---|
| **Aviso de recambio con IA** | `/alertas`, botón "Redactar con IA" junto al flujo de mail y WhatsApp | Un borrador del mensaje para el cliente, en un cuadro de texto editable. Usa el equipo vencido o por vencer y sus fechas, las compras anteriores, las canchas y los avisos ya enviados | No envía nada. La plantilla fija de siempre sigue siendo el camino por defecto y el respaldo ante cualquier error |
| **Resumen de cuenta con IA** | Ficha 360 de empresa y de contacto, dentro de "Historia de la cuenta", botón "Resumir con IA" | Un panel de solo lectura con tres bloques: qué pasó, equipamiento instalado y qué ofrecerle ahora. Con "Copiar", "Regenerar" y "Cerrar" | No se guarda, no se agrega a la historia, no crea oportunidades ni actividades |

Ambos textos llevan siempre la etiqueta de IA ("Borrador generado con IA: revisalo antes de enviar" y "Generado con IA:
revisalo antes de usarlo, puede tener errores").

**Cómo se usa el aviso.** El botón abre un panel lateral con el borrador. La persona lo edita si quiere y toca "Abrir en
WhatsApp" o "Abrir en mail": se abre **su** WhatsApp o **su** cliente de correo con el texto, y recién ahí se registra el aviso
(la alerta pasa a figurar "ya avisada"). "Volver a la plantilla" restaura el texto fijo de siempre; "Regenerar con IA" pide otro
borrador. Si la IA falla, el cuadro se llena con la plantilla y un aviso dice por qué.

El envío automático desde el servidor por SMTP **no** se usa para los borradores de IA: ese camino (`enviarAlertaEmail`) sigue
derivando el texto de la base y nunca acepta un texto del navegador, para no abrir un relay de mails (ver
[seguridad](./seguridad.md)). Los borradores de IA salen por los canales de la propia persona.

---

## 2. Las 7 condiciones de la consigna

La consigna (el título "Extra opcional: incorporación de inteligencia artificial" está en la p. 6; el objetivo y las condiciones, en la p. 7) pide que cada grupo identifique "un problema
concreto dentro del uso del CRM que pueda resolverse o simplificarse mediante inteligencia artificial" y que la funcionalidad
cumpla estas condiciones. La IA debe incorporarse "únicamente después de completar y probar las funcionalidades principales del CRM":
F7 se hizo después de F0 a F6.

> **La funcionalidad deberá:**
> 1. Resolver una necesidad real.
> 2. Estar relacionada directamente con el CRM desarrollado.
> 3. Utilizar información registrada en el sistema.
> 4. Integrarse en un flujo existente.
> 5. Producir un resultado útil para alguno de los usuarios.
> 6. Justificar por qué requiere inteligencia artificial.
> 7. Permitir que el usuario revise el resultado.

| # | Condición | Cómo se cumple por diseño |
|---|---|---|
| 1 | Resolver una necesidad real | Un proveedor chico que le vende a clubes pierde tiempo y deja pasar recambios por no saber qué decirle a cada cliente: el aviso genérico se ve automático y no aprovecha el historial. Y quien retoma una cuenta (un vendedor nuevo, un responsable que reasigna) tiene que leer decenas de actividades para ponerse al día. Los dos son trabajos que hoy se hacen a mano, cuenta por cuenta |
| 2 | Estar relacionada directamente con el CRM | Opera sobre objetos del CRM (alertas de recambio, ficha 360 de empresa y de contacto) y vive dentro de sus pantallas. No es un chat suelto |
| 3 | Utilizar información registrada en el sistema | Todo el contexto sale de filas del CRM leídas por el servidor en el momento (equipos entregados y vida útil, compras, canchas, avisos enviados, actividades, oportunidades). Los prompts prohíben usar cualquier dato que no esté en ese bloque. Ver [sección 3](#3-qué-datos-salen-y-cuáles-no) |
| 4 | Integrarse en un flujo existente | El aviso se suma al flujo de alertas (al lado de "Mail" y "WhatsApp", con el mismo registro de envío y la misma plantilla como base). El resumen se suma a la "Historia de la cuenta" de la ficha 360. No hay pantallas nuevas |
| 5 | Producir un resultado útil para alguno de los usuarios | Para el **vendedor**: un aviso listo para revisar y mandar en segundos, y un resumen para retomar una cuenta. Para el **responsable comercial**: ponerse al día de una cuenta antes de reasignarla o de hablar con el cliente |
| 6 | Justificar por qué requiere IA | **Aviso:** la plantilla fija sirve para el caso base y se conserva. Lo que no puede hacer es *componer* según el contexto: no sabe distinguir un primer aviso de un seguimiento, mencionar de pasada las canchas del club ni agradecer una compra anterior, y cubrir esas combinaciones con plantillas son decenas de variantes que nadie mantiene. **Resumen:** hay que leer texto libre (títulos y detalles de actividades escritos por varias personas) y sintetizarlo; eso no se resuelve con reglas ni con SQL. El resumen numérico de la ficha ("Resumen de la cuenta") ya existe sin IA y sigue siendo la fuente de las cifras. Salvedad honesta: para el aviso, la ganancia es de calidad y de tiempo, no de posibilidad; por eso es opcional y la plantilla es el respaldo |
| 7 | Permitir que el usuario revise el resultado | El aviso se muestra en un cuadro **editable** y no sale hasta que la persona toca "Abrir en WhatsApp" o "Abrir en mail", con su propio WhatsApp o correo. El resumen es de solo lectura, marcado como IA y con una nota de que puede equivocarse. Ninguna acción de IA guarda ni envía nada por sí misma |

---

## 3. Qué datos salen y cuáles no

Cada vez que alguien toca un botón de IA, el servidor arma **un solo texto** (`src/lib/ia/contexto.ts`) y lo manda a la API de
Anthropic. El navegador solo manda un id: el contexto lo arma siempre el servidor, volviendo a leer con la **sesión de la
persona**, así que la RLS decide qué hay (un Vendedor solo resume cuentas de su cartera y, sin `ventas.ver`, no se manda nada de
compras; en ese caso el texto dice explícitamente que esa parte es desconocida).

| Sale | Detalle |
|---|---|
| Nombre del club o empresa | Para escribirle al club. Si el cliente es una persona, su nombre de pila |
| Nombre de pila del contacto | Nunca el apellido |
| Equipos | Producto, cantidad, fecha de entrega, vida útil, fecha de vencimiento y días que faltan o pasaron |
| Compras | Cantidad, primera y última fecha, total comprado, algunos productos |
| Canchas | Formato, cantidad y superficie |
| Oportunidades | Título, estado, etapa y monto (hasta 10) |
| Actividades | Hasta 15: fecha, tipo, título (100 caracteres) y detalle (160), ya limpios |
| Avisos previos | Fecha y canal |

| No se pide (los campos no viajan) | Cómo |
|---|---|
| Mails, teléfonos, CUIT, documentos, direcciones, número de comprobante, notas de la ficha, nombres de quien cargó o responde, contraseñas, claves, datos de otras organizaciones | No están en lo que se lee ni en lo que se arma |

**Textos libres: se intenta limpiarlos, no hay garantía.** Los nombres de producto y de cancha y los títulos y detalles de actividades
los escribe cualquiera y pueden traer datos personales. Antes de salir, `limpiarTexto` tacha: mails (con arroba, sin punto en el dominio
o escritos `[at]`, `(at)`, `[arroba]`), usuarios `@algo`, enlaces y dominios sueltos o acortadores (`bit.ly/x`, `club.com.ar/pago`),
CUIT y cualquier número de 7 o más dígitos que no sea una fecha real (`dd/mm/aaaa`, `dd-mm-aaaa`, `dd.mm.aaaa`, `aaaa-mm-dd`, con
rangos plausibles: `11.45.6789` se tacha). **No reconoce** nombres propios, direcciones escritas en una frase ni un mail deletreado con
palabras ("juan arroba club punto com"). Por eso la función es opcional y el aviso "Cómo usamos la IA" no promete más que "intentamos".

El texto completo tiene un tope de 6000 caracteres. `contexto.check.ts` prueba cada una de estas reglas de limpieza y de tope. El proveedor
procesa el texto para devolver el borrador; **qué retiene o por cuánto tiempo depende de las condiciones de la cuenta de la API
con que se despliegue** y debe revisarse con quien aporta la clave antes de activar la función en producción.

---

## 4. Control de la persona y transparencia

- **Etiqueta visible** en todo lugar donde aparece texto de la IA (`EtiquetaIA`).
- **"Cómo usamos la IA"** (un `<details>` junto a los botones, y dentro del panel del aviso) dice qué se envía, qué no y que la IA solo redacta.
- **Revisión obligatoria por diseño.** Nada sale solo: el aviso exige un clic en "Abrir en WhatsApp" o "Abrir en mail" sobre un
  texto editable; el resumen no dispara nada.
- **Sin decisiones automáticas.** La IA no cambia datos, no mueve oportunidades, no crea actividades ni envía.
- **Sin almacenamiento por parte de la función.** Los borradores viven en el estado de la pantalla. Lo único que se guarda es lo
  que ya se guardaba: al mandar un aviso, `alertas_enviadas` registra el texto que la persona **efectivamente** envió (igual que
  con la plantilla); no queda registro de que lo redactó la IA ni del borrador original.
- **Se desactiva** quitando `ANTHROPIC_API_KEY`. Un administrador lo ve en `/configuracion` ("IA: activa" o "IA: desactivada", solo lectura).
- **Permisos.** El aviso exige `alertas.enviar` (el mismo del envío); el resumen, `clientes.ver`.

---

## 5. Cómo está hecho

```
src/lib/ia/
  config.ts      iaDisponible(), modeloIA(), admiteFallback()   (sin SDK; lo leen las páginas servidor)
  cliente.ts     singleton del SDK, `server-only`
  prompts.ts     prompts de sistema (constantes, español rioplatense) y armarPedido()
  contexto.ts    contexto mínimo y limpieza de datos personales (funciones puras)
  errores.ts     errores del SDK y stop_reason -> frases en palabras
  limite.ts      límite por persona (ventana deslizante en memoria)
  generar.ts     la llamada a Claude, `server-only`
src/app/(app)/ia/actions.ts          Server Actions redactarAvisoRecambio y resumirCuenta
src/app/(app)/alertas/BorradorIA.tsx  panel del aviso (hook useBorradorIA + Drawer)
src/components/ResumenIA.tsx          botón y panel del resumen
src/components/IaAviso.tsx            EtiquetaIA y "Cómo usamos la IA"
```

**La llamada** (`generar.ts`, SDK oficial `@anthropic-ai/sdk`, única dependencia nueva, solo en servidor):

- Modelo `claude-opus-5-5` por defecto (configurable con `ANTHROPIC_MODEL`).
- Pensamiento siempre encendido (no se puede apagar en este modelo): no se manda `thinking`; el costo se controla con
  `output_config: { effort: "low" }`. Sin temperature, top_p ni top_k, sin prefill, sin `tool_choice`.
- `max_tokens: 4000` (el pensamiento también cuenta), sin streaming (la respuesta es corta), `timeout` de 30 s y un reintento.
- **Reintento por rechazo de seguridad del lado del servidor**: `betas: ["server-side-fallback-2026-07-01"]` y
  `fallbacks: "default"`. Los tipos del SDK instalado (0.131.0) lo aceptan. Solo se manda con los modelos que lo admiten.
- Se mira `stop_reason`: `refusal` y `max_tokens` dan una frase amable, no un error ni un texto a medias.
- Errores en cadena de lo más específico a lo más general (`RateLimitError`, `AuthenticationError` y `PermissionDeniedError`,
  `APIConnectionTimeoutError`, `APIConnectionError`, `InternalServerError`, `APIError`). Al navegador solo llegan frases fijas;
  al log del servidor, la clase y el status.
- Sin caché de prompt (el prompt de sistema es chico).

**Por qué una Server Action.** Necesita un secreto; ver [arquitectura §2.3](./arquitectura.md#23-ia-asistida-f7-una-server-action-por-el-secreto).

**Defensa ante textos que den órdenes.** Una actividad puede decir "ignorá las reglas y…". El prompt de sistema es constante, los
datos van aparte entre `<DATOS>` sin `<` ni `>` (no se puede cerrar el bloque) y las reglas dicen que son información. Además el
peor resultado posible es un borrador que una persona lee: la IA no tiene herramientas ni puede ejecutar nada.

---

## 6. Costo por llamada

Precios de Claude Opus 5.5 (lista de la API, 2026-09): **US$ 4 por millón de tokens de entrada y US$ 20 por millón de salida.**

**Estas cifras son ESTIMACIONES, no mediciones**: no había clave para llamar a la API real ni al contador de tokens. Se calcularon
con el largo real de los prompts y de los contextos de la demo (≈ 3,5 caracteres por token en español) y con una salida que
incluye el pensamiento a esfuerzo bajo. La primera semana con clave conviene mirar `usage` en la consola de Anthropic y corregir esta tabla.

| Llamada | Entrada | Salida (pensamiento + texto) | Costo típico | Techo por llamada |
|---|---|---|---|---|
| Aviso de recambio | ≈ 900 tokens (sistema ≈ 560, datos ≈ 300) | ≈ 500 a 1200 | ≈ US$ 0,01 a 0,03 | US$ 0,09 (entrada 1000 + `max_tokens` 4000) |
| Resumen de cuenta | ≈ 1300 a 2400 (datos hasta 6000 caracteres) | ≈ 800 a 1500 | ≈ US$ 0,02 a 0,05 | US$ 0,09 |

El "techo por llamada" es el de **una** respuesta. El techo teórico de **una acción del usuario** es mayor: el SDK reintenta una vez
(`maxRetries: 1`) y, si un clasificador de seguridad rechaza el pedido, la API lo vuelve a correr con otro modelo (`fallbacks`), que se
factura aparte; en el peor caso son hasta unas cuatro corridas completas, o sea **unos US$ 0,35 por acción**. Ambos casos son raros (los reintentos
suelen ser por errores que no se facturan). Orden de magnitud: 100 borradores al mes cuestan unos **US$ 2 a 4**. El límite por persona (10
acciones cada 10 minutos) acota el caso típico a unos US$ 0,3 por persona cada 10 minutos y el peor teórico a unos US$ 3,5. Para un techo duro, fijar un límite de gasto mensual en la consola de Anthropic.

---

## 7. Configuración y cómo apagarla

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Con ella la función se activa; sin ella (o vacía) **no hay botones ni llamadas**. Solo servidor, sin `NEXT_PUBLIC_` |
| `ANTHROPIC_MODEL` | No | Modelo a usar. Por defecto `claude-opus-5-5` |

Se cargan en Vercel (Project Settings, Environment Variables) o en `.env.local` en desarrollo. Para apagarla: borrar la variable y
redesplegar. Detalle en [deploy](./deploy.md). `ANTHROPIC_BASE_URL` (que lee el SDK) permite apuntar a un servidor simulado en
pruebas locales.

---

## 8. Límites

- **Límite por persona** de 10 llamadas cada 10 minutos, **en memoria y por instancia** del servidor (mejor esfuerzo; ver [seguridad §6](./seguridad.md)).
- **La calidad del texto no se midió**: el servidor simulado devuelve texto fijo. Los prompts piden voseo, 60 a 110 palabras para
  el aviso y 180 para el resumen, y prohíben inventar precios, fechas y compromisos, pero **hay que leer los primeros borradores
  reales** y ajustar `prompts.ts` si hace falta.
- El resumen lee las filas más recientes (tope de la ficha 360) y las acota más (15 actividades, 10 oportunidades, 8 compras): cuentas muy
  largas se resumen por lo reciente, y el texto avisa cuando el CRM leyó solo una parte.
- El parque del resumen sale de las compras leídas (hasta 200); el de la ficha se lee aparte con tope de 1000.
- El aviso con IA se escribe en un solo formato para WhatsApp o mail (sin asunto: el asunto es el de la plantilla).
- Los textos libres pueden contener datos personales que el filtro no reconoce (un nombre propio, una dirección escrita en prosa, un mail deletreado con palabras).
- **Un solo tope de largo**: 2000 caracteres (`MAX_MENSAJE_BORRADOR`). Es lo máximo que se acepta de la IA, lo que cabe en el cuadro de texto y lo que el
  servidor registra como enviado; el cliente lo valida antes de abrir WhatsApp o el correo.
- **El modelo cambia el control de costo.** `effort: "low"` solo se manda con los modelos que lo aceptan (Opus 4.5 a 5.5, Sonnet 4.6 a 5.5, Fable/Mythos 5): con
  `claude-haiku-4-5`, Sonnet 4.5 o un id desconocido se omite (la API respondería 400) y no hay control de esfuerzo.
- No hay historial ni memoria entre llamadas: cada borrador parte de cero.

---

## 9. Qué se verificó y qué no

**Verificado:** `npm run typecheck`, `npm run lint`, `npm test` (46 pruebas nuevas de la IA), `next build` sin que el SDK aparezca en
ningún chunk del cliente, y el navegador contra un servidor simulado de la API: sin clave los botones no existen y nada se rompe;
con clave, el borrador se muestra y se edita, "Volver a la plantilla" restaura el texto fijo, los errores 429, 401, 529, `refusal`
y `max_tokens` caen a la plantilla con un mensaje en palabras (sin filtrar el texto del proveedor), el resumen de empresa y de contacto,
y el límite por persona. También que lo enviado a la API lleva el modelo, `effort: low`, `fallbacks: "default"` y el encabezado beta, y ningún mail, enlace ni número largo.

**No verificado:** ninguna llamada a la API real; la calidad y el tono de los textos; el costo medido; el envío completo del aviso
(que escribe en `alertas_enviadas` de la base viva) desde el panel de IA; el comportamiento de `fallbacks: "default"` ante un rechazo real.
