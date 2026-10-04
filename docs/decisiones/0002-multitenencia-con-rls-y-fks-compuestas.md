# 0002. Multitenencia con RLS y claves foráneas compuestas

- **Estado:** Aceptada
- **Fecha:** 2026-09-18 (migración `0004`, commit `2908420`)

## Contexto

El producto lo van a usar varios proveedores de equipamiento deportivo, cada uno con sus clientes, sus
productos y su equipo, y ninguno debe ver los datos de otro. La primera versión era de un solo equipo: una
política `using (true)` para cualquier usuario autenticado.

Dos hechos del diseño de Postgres y Supabase condicionan la solución:

- Una clave foránea común se valida **sin mirar la RLS**: un usuario del cliente A que conociera el id de una
  empresa del cliente B podría colgarle un contacto. No la vería, pero ensuciaría datos ajenos.
- Las políticas de Postgres se combinan con **OR**: una sola política vieja `using (true)` que quedara viva
  anularía todo el aislamiento sin que nada lo avise.

## Decisión

Un solo esquema compartido, con una fila de `organizaciones` por cliente, y el aislamiento garantizado por la
base:

1. **`organizacion_id` en todas las tablas de datos**, `not null`, con `default org_actual()`. La aplicación
   no envía la organización; la pone la base. El `with check` de cada política rechaza cualquier otro valor.
2. **Claves foráneas compuestas** `(organizacion_id, x_id)` hacia `(organizacion_id, id)`, con un
   `unique (organizacion_id, id)` en cada tabla referenciada. La base exige que la fila referenciada sea de la
   misma organización.
3. **Políticas RLS** que piden la organización propia y el permiso (ver
   [0005](./0005-cartera-propia-por-responsable.md) para la cartera). Antes de crearlas, las migraciones
   **borran todas las políticas existentes** de esas tablas.
4. **`org_actual()` y `tiene_permiso()`** como funciones `SECURITY DEFINER` (para leer `perfiles` y `roles`
   sin recursión de RLS). Devuelven nulo y falso si el usuario está dado de baja o su organización inactiva.
5. La organización y el rol de un alta se leen de **`raw_app_meta_data`**, que solo escribe el servidor con la
   clave de servicio, nunca de `raw_user_meta_data`, que el usuario puede editar desde el navegador.
6. Las unicidades pasan a ser por organización (nombre de producto, orden de etapa, nombre de rol).

## Consecuencias

- Es la garantía más fuerte posible: no depende de ningún chequeo de la aplicación, y por eso encaja con
  [0001](./0001-mutaciones-desde-el-cliente.md).
- Cada tabla nueva debe llevar `organizacion_id`, su índice, su política y sus claves compuestas. Es un costo
  fijo de diseño.
- Las políticas usan `(select public.org_actual())` para que Postgres evalúe la función una vez por consulta.
- Borrar una organización entera (lo hace el superadmin) tiene que funcionar con tablas que se referencian
  entre sí: por eso varias claves foráneas son `no action` y no `restrict`, para que la cascada borre todo en
  la misma sentencia.
- Las funciones internas de siembra (`crear_roles_iniciales`, `crear_catalogos_iniciales`) se revocan a
  usuarios finales: expuestas, cualquiera podría sembrar roles en otra organización por `/rpc`.
- Se prueba con `supabase/tests/0005_permisos.sql` (dos organizaciones, intentos de cruce).
- Restricción de plataforma: requiere Postgres 15 o superior (`on delete set null (columna)`).

## Alternativas

El repositorio no documenta alternativas evaluadas (por ejemplo, una base o un esquema por cliente).
