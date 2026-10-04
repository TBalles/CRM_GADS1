# 0013. IA asistida: borradores que una persona revisa, una Server Action por el secreto y apagada por defecto

- **Estado:** Aceptada
- **Fecha:** 2026-10-04 (F7, sin migración)

## Contexto

La consigna deja como extra opcional una funcionalidad de IA que resuelva un problema real del CRM, use datos del sistema,
se integre a un flujo existente y **permita que el usuario revise el resultado**. Había que decidir qué problema atacar, qué
puede hacer la IA, cómo llegar a la API sin exponer la clave, qué datos mandarle y qué pasa cuando no hay clave o falla.
Detalle de las siete condiciones en [ia](../ia.md).

## Decisión

**1. Dos usos, los dos de redacción.** Un borrador del aviso de recambio (en el flujo de alertas) y un resumen de la cuenta
(en la ficha 360). Son tareas donde un texto de calidad ahorra tiempo y donde equivocarse cuesta poco **porque una persona lo
lee antes de usarlo**.

**2. La IA solo redacta: nunca actúa.** Sin herramientas, sin escritura en la base, sin envíos. El aviso se manda desde el
WhatsApp o el correo de la persona (`window.open` + `registrarEnvioConBorrador`, que solo registra), no desde el servidor. Así no
se abre el relay de mails que la acción de alertas evita a propósito (acepta solo un id y deriva el texto de la base).

**3. Server Action, por el secreto.** `ANTHROPIC_API_KEY` no puede llegar al navegador. Es otra excepción acotada a "mutaciones
desde el cliente" (como el envío de mails). El navegador manda solo un id; el servidor relee con la sesión de la persona
(la RLS decide qué ve la IA) y arma el contexto.

**4. Contexto mínimo y filtrado, armado con funciones puras.** Solo lo que el borrador necesita; nombre de pila del contacto;
mails, teléfonos, CUIT y documentos no se piden, y en los textos libres que sí van se intentan tachar (mails, enlaces, CUIT, números
largos; sin garantía: no reconoce nombres propios ni direcciones en prosa). Tope de 6000 caracteres. Probado con self-checks.

**5. Apagada por defecto, con la plantilla como respaldo.** Sin clave no hay botones. Con clave, cualquier falla (límite, clave
inválida, saturación, rechazo, corte) deja la plantilla fija en el cuadro y un aviso en palabras. La plantilla de siempre nunca
se quita ni se vuelve peor.

**6. SDK oficial, Claude Opus 5.5 y esfuerzo bajo.** `@anthropic-ai/sdk` (única dependencia nueva, solo en servidor), modelo
`claude-opus-5-5` configurable con `ANTHROPIC_MODEL`, sin `thinking` (no se puede apagar) y `effort: "low"` para el costo,
`max_tokens` 4000 sin streaming, `timeout` de 30 s y un reintento, y `fallbacks: "default"` ante un rechazo de seguridad.

**7. Límite por persona en memoria.** 10 llamadas cada 10 minutos. Es de mejor esfuerzo y por instancia; el techo real de gasto es
el límite de la cuenta de la API.

## Alternativas descartadas

- **Un chat libre.** No cumple "integrarse en un flujo existente" ni "relacionada directamente con el CRM", y no se puede acotar el dato que sale.
- **Que la IA mande el mail o cree la oportunidad.** Contradice "permitir que el usuario revise" y abriría un relay y decisiones automáticas.
- **Llamar a la API desde el navegador.** Expondría la clave.
- **Guardar los borradores o un historial de IA.** Más datos personales en reposo sin un uso que lo justifique.
- **Límite en la base.** Más exacto, pero requiere una migración y una tabla para algo que hoy no lo justifica.

## Consecuencias

- **Bueno.** Opcional y reversible (se quita la clave). El camino sin IA queda intacto. Nada sale sin que una persona lo vea. La
  clave y el SDK quedan fuera del cliente (verificado en el build).
- **Cuesta.** Los datos de la cuenta viajan a un tercero cuando alguien toca el botón; el filtro de textos libres no reconoce todo.
  El límite por persona se puede esquivar con varias instancias. La calidad de los textos depende del modelo y de los prompts y hay
  que mirarla con uso real. El aviso con IA no usa el SMTP del servidor.
- **Costo.** Del orden de US$ 0,01 a 0,05 por borrador (estimación, ver [ia](../ia.md#6-costo-por-llamada)); alguien tiene que aportar la clave y fijar un tope de gasto.
