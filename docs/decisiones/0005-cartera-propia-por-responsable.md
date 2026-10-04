# 0005. Cartera propia por responsable

- **Estado:** Aceptada
- **Fecha:** 2026-10-04 (migración `0007`, commit `a5c0135`)

## Contexto

La consigna define dos perfiles distintos. El **Vendedor** "consulta los clientes asignados" y el
**Responsable comercial** "consulta la información de todo el equipo" y "asigna y reasigna oportunidades". El
Administrador "puede acceder a toda la información".

Hasta la `0005`, quien podía ver clientes veía a todos los de la organización. Hacía falta que un vendedor
viera solo lo suyo, y que eso lo hiciera cumplir la base y no la pantalla (ver
[0001](./0001-mutaciones-desde-el-cliente.md) y [0004](./0004-reglas-de-negocio-en-triggers.md)).

## Decisión

- Empresas, contactos y oportunidades tienen `responsable_id`. Se ven y se editan si el usuario tiene el
  permiso **`clientes.ver_todos`** o es el responsable. Un contacto también se ve si se ve su empresa.
- Lo que cuelga de una empresa (ventas, ítems, alertas enviadas, actividades) hereda la regla con una
  subconsulta a `empresas`, que corre con la RLS de quien consulta. La vista `alertas_vida_util`, por ser
  `security_invoker` y hacer join con `empresas`, queda filtrada sin tocarla. Las actividades también se ven
  si se ve su contacto o su oportunidad.
- Un alta sin responsable queda asignada a **quien la crea** (trigger `validar_responsable`; no alcanza con un
  `default` porque la app vieja manda `null` explícito).
- Asignar a otro, o reasignar, exige `clientes.asignar` u `oportunidades.asignar`. El responsable tiene que ser
  de la misma organización.
- Roles por defecto: **Vendedor** sin `ver_todos` (cartera propia); **Responsable comercial** y **Solo
  lectura** con `ver_todos`; **Administrador**, todos los permisos.
- Migración de lo existente: los roles que ya veían clientes reciben `ver_todos` (solo "Ventas" y "Vendedor"
  pasan a cartera propia), para no dejarlos ciegos de golpe. La cartera existente se asigna al responsable de
  su oportunidad más reciente.
- Para **escribir** una actividad no alcanza con ver una referencia: cada una tiene que ser visible para quien
  escribe y coherente con las demás, para que un vendedor no cuelgue una actividad en el cliente de otro usando
  su propia oportunidad como llave.

## Consecuencias

- Lo que no tiene responsable lo ven solo quienes tienen `ver_todos` hasta que un administrador lo asigne. Hoy
  **no hay pantalla** para asignar empresas ni contactos (F1).
- Un vendedor no puede reasignar. Si necesita pasar un cliente, lo hace un Responsable comercial o un
  Administrador.
- Los `exists (select ... from empresas ...)` dentro de las políticas tienen costo; son consultas por clave
  primaria y hoy los volúmenes son chicos. No hay mediciones en el repositorio.
- Las pantallas muestran lo que la base devuelve: un vendedor ve contadores y listas más cortos, sin código
  adicional. Pero el tablero cuenta solo lo visible, lo que es correcto.
- Si un administrador le saca `ver_todos` a un rol, correr de nuevo la `0007` no se lo devuelve (la marca de
  "ya migrado" es el CHECK de `roles.permisos`).
- Probada en `supabase/tests/0007_reglas.sql` (bloque "Soy vendedor 1").
