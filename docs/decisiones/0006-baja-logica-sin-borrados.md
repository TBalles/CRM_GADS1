# 0006. Baja lógica en lugar de borrados

- **Estado:** Aceptada, con un límite abierto (ver Consecuencias)
- **Fecha:** 2026-09-18 (productos, commit `a72f794`) y 2026-10-04 (resto, commit `a5c0135`)

## Contexto

La consigna es explícita: "los registros que tengan información histórica no deberán eliminarse
físicamente; cuando una empresa o contacto deje de utilizarse, deberá modificarse su estado para conservar sus
oportunidades y actividades anteriores". Además, el historial de ventas es la base de las alertas de recambio:
borrar un producto rompería lo ya entregado.

## Decisión

| Entidad | Cómo se da de baja | Cómo se protege el historial |
|---|---|---|
| Producto | `activo = false` | `venta_items.producto_id` es `on delete restrict` |
| Empresa, contacto | `estado = 'inactivo'` (la interfaz no ofrece borrar) | Un contacto con actividades: FK `no action` desde `bitacora_entradas` |
| **Oportunidad** | Se marca perdida con motivo | **No existe política de borrado para nadie, ni el administrador.** Historial y auditoría la referencian sin cascada |
| Etapa, origen, motivo, tipo de actividad | `activo = false` | Lo ya registrado los referencia sin cascada |
| Usuario | `perfiles.activo = false` más ban en Auth | — |
| Organización | `activa = false` | — |
| Bitácora, alertas enviadas, historial, auditoría | No se editan ni se borran | Sin políticas de update ni delete |

Las claves foráneas de historial, auditoría y contacto de actividades son **`no action`** y no `restrict` a
propósito: `no action` se verifica al final de la sentencia, así que borrar una organización entera (lo hace
el superadmin) sigue funcionando porque su cascada borra oportunidades e historial en la misma sentencia.

## Consecuencias

- Las listas tendrán que distinguir activos de inactivos (filtro por estado). Hoy las pantallas no lo hacen
  porque son anteriores a la `0007`.
- **Límite abierto.** La política `borrar` de `empresas` y `contactos` sigue vigente para quien tiene
  `clientes.editar` dentro de su cartera. La interfaz no borra, pero una llamada directa a la API podría, y
  borrar una empresa arrastra sus ventas y su bitácora (`on delete cascade`). Para empresas, la baja lógica es
  hoy una convención de la interfaz y no una garantía de la base. Quitar esas políticas es el cierre natural de
  esta decisión y está pendiente.
- Una oportunidad creada por error no se puede borrar: se marca perdida, con el motivo que corresponda
  (existe un motivo "Dato histórico sin motivo" para los datos anteriores a la `0007`).
- Los datos de prueba se limpian borrando la organización de demostración, no fila por fila.
