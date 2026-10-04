# 0003. Vida útil copiada como snapshot en `venta_items`

- **Estado:** Aceptada
- **Fecha:** 2026-09-18 (migración `0003`, commit `a72f794`)

## Contexto

El valor diferencial del producto es avisar cuándo hay que recambiar el equipamiento que se entregó. El
vencimiento depende de la **vida útil** del producto (en meses) y de la **fecha de entrega**.

Si la vida útil se leyera del catálogo con un `join`, cambiarla afectaría retroactivamente a lo ya entregado:
si mañana el catálogo cambia la vida útil de un arco de 24 a 36 meses, los arcos ya vendidos pasarían a vencer
más tarde de lo que se le prometió al cliente. Un `join` daría la respuesta de hoy a una pregunta del pasado.

## Decisión

- `venta_items.vida_util_meses` guarda una **copia** de `productos.vida_util_meses` tomada al insertar el
  ítem (trigger `set_venta_items_defaults`, función `venta_items_defaults()`), solo si el ítem no la trae.
- `venta_items.fecha_entrega` también es propia del ítem: en una venta puede entregarse una parte hoy y el
  resto el mes siguiente, y el reloj arranca cuando el equipo llega a la cancha, no cuando se factura. Si no
  viene, hereda la fecha de la venta.
- La vista `alertas_vida_util` calcula el vencimiento como `fecha_entrega + vida_util_meses` usando la copia.
- La columna está documentada en la base: *"Snapshot de productos.vida_util_meses al momento de la venta. No
  es un join a propósito."*
- El trigger es `SECURITY INVOKER` a propósito (lee con los permisos de quien inserta, que ya puede leerlos
  por RLS). Con `SECURITY DEFINER` leería como dueño y, el día que se ajusten los permisos, sería un agujero.

## Consecuencias

- Cambiar el catálogo no mueve ningún vencimiento ya prometido.
- Un ítem cargado sin que el producto tenga vida útil queda sin seguimiento para siempre, aunque después se la
  agreguen al producto. Hay que editar el ítem, o cargar una venta nueva.
- La copia es un dato duplicado; el costo es mínimo y es justamente lo que se quiere.
- Las ventas son un hecho consumado, distinto de las oportunidades (el embudo, que todavía puede cerrarse o
  perderse): por eso son tablas separadas.
- Como todo ítem con vida útil entra en la vista, un producto no se puede borrar mientras haya ventas
  (`venta_items.producto_id` es `on delete restrict`): se da de baja. Ver
  [0006](./0006-baja-logica-sin-borrados.md).
- Está explicado al usuario en el FAQ de la landing.
