# Decisiones de arquitectura

Registro de las decisiones técnicas que dan forma al proyecto, en formato ADR (Architecture Decision
Record): cada una explica el contexto, lo decidido, sus consecuencias y su estado. El razonamiento está
tomado de los comentarios del código, las migraciones y el historial de git, no reconstruido de memoria.

| Nº | Decisión | Estado | Commits de referencia |
|---|---|---|---|
| [0001](./0001-mutaciones-desde-el-cliente.md) | Mutaciones del CRUD desde el cliente, no con Server Actions | Aceptada | `cc75fbb`, `e6ae917` |
| [0002](./0002-multitenencia-con-rls-y-fks-compuestas.md) | Multitenencia con RLS y claves foráneas compuestas | Aceptada | `2908420` |
| [0003](./0003-vida-util-snapshot-en-venta-items.md) | Vida útil copiada como snapshot en `venta_items` | Aceptada | `a72f794` |
| [0004](./0004-reglas-de-negocio-en-triggers.md) | Reglas de negocio en triggers de la base | Aceptada | `a5c0135` |
| [0005](./0005-cartera-propia-por-responsable.md) | Cartera propia por responsable | Aceptada | `a5c0135` |
| [0006](./0006-baja-logica-sin-borrados.md) | Baja lógica en lugar de borrados | Aceptada, con un límite abierto | `a72f794`, `a5c0135` |
| [0007](./0007-graficos-en-css-sin-libreria.md) | Gráficos en CSS puro, sin librería | Aceptada | `53ef1f1`, `ffc4d9e` |
| [0008](./0008-logo-en-bucket-privado-sin-svg.md) | Logo en un bucket privado, sin SVG | Aceptada (sin interfaz todavía) | `a5c0135` |
| [0009](./0009-superadmin-sin-organizacion.md) | Superadmin sin organización | Aceptada | `2908420`, `ecef8bf` |
| [0010](./0010-correo-por-smtp-propio.md) | Todos los mails por SMTP propio | Aceptada | `b9b2fe9`, `2908420` |
| [0011](./0011-self-checks-con-node-test.md) | Self-checks con `node --test`, sin framework de pruebas | Aceptada | `8326161`, `a72f794`, `2908420` |
| [0012](./0012-reglas-del-rubro.md) | Reglas del rubro: medidas estáticas, sugerencia (no diagnóstico) y la regla de la apertura en un trigger aparte | Aceptada | F4, sin commit todavía |

## Cómo agregar una decisión

1. Copiá la estructura de cualquiera de las anteriores y numerala con el siguiente número libre
   (`0012-titulo-en-kebab-case.md`).
2. Completá **Contexto** (qué problema había y qué restricciones), **Decisión** (qué se hace, en presente),
   **Consecuencias** (lo bueno y lo que cuesta) y **Estado**.
3. Estados posibles: `Propuesta`, `Aceptada`, `Reemplazada por NNNN` (sin borrar la original), `Rechazada`.
4. Agregá la fila al índice de arriba.

Una decisión aceptada no se reescribe: si cambia, se escribe una nueva que la reemplaza y la original queda
marcada como reemplazada.

## Relacionado

- [Arquitectura](../arquitectura.md) · [Reglas de negocio](../reglas-de-negocio.md) ·
  [Seguridad](../seguridad.md)
- Las desviaciones del kit de diseño no se registran acá sino en
  [`docs/design-overrides.md`](../design-overrides.md).
