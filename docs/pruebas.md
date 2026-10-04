# Pruebas y verificaciones

Todo lo que se puede ejecutar para comprobar que el proyecto está sano, cómo correrlo, qué demuestra y cómo
leer el resultado. No hay framework de pruebas: los self-checks usan el runner de Node y las pruebas SQL se
pegan en el SQL Editor de Supabase.

**Estado al commit `cb7c251`** (ejecutado al escribir esta documentación):

| Verificación | Resultado |
|---|---|
| `node --test "src/**/*.check.ts"` | 37 pruebas, 37 pasan, 0 fallan |
| `npx tsc --noEmit` | Sin errores |
| `npx eslint src --max-warnings=0` | Sin advertencias |
| `npx next build` | No se ejecutó al escribir estas notas |
| Pruebas SQL | Las ejecutó el equipo el 2026-10-04 después de aplicar la 0007, según lo informado. No se re-ejecutaron al escribir esta documentación |

Contenido: [1. Resumen](#1-resumen) · [2. Self-checks](#2-self-checks-con-node---test) ·
[3. Verificación estática](#3-verificación-estática-y-build) · [4. Pruebas SQL](#4-pruebas-sql) ·
[5. Cómo leer un resultado](#5-cómo-leer-un-resultado) · [6. Antes de hacer push](#6-antes-de-hacer-push) ·
[7. Lo que todavía no se prueba](#7-lo-que-todavía-no-se-prueba)

---

## 1. Resumen

| Qué | Cómo se corre | Dónde | Qué prueba |
|---|---|---|---|
| Self-checks (5 archivos, 37 pruebas) | `node --test "src/**/*.check.ts"` | Terminal | Lógica pura: dinero, íconos, permisos, mails, mensajes |
| Tipos | `npx tsc --noEmit` | Terminal | Que todo el TypeScript compile |
| Lint | `npx eslint src --max-warnings=0` | Terminal | Estilo y errores comunes, sin tolerar advertencias |
| Build | `npx next build` | Terminal | Que la aplicación se construya (incluye el chequeo de `server-only`) |
| `0005_permisos.sql` | Pegar en el SQL Editor | Supabase | Aislamiento entre organizaciones y permisos |
| `0007_reglas.sql` | Pegar en el SQL Editor | Supabase | Reglas de la migración 0007 |
| `0008_baja_logica.sql` | Pegar en el SQL Editor, con la 0008 aplicada | Supabase | Que borrar empresas o contactos afecte 0 filas y que la baja lógica (`estado = 'inactivo'`) funcione |
| `0007_reejecucion.sql` | Pegar con la migración dos veces | Supabase | Que la 0007 se pueda re-ejecutar sin efectos |

---

## 2. Self-checks con `node --test`

Cada archivo `*.check.ts` se ejecuta directamente con Node, sin bundler ni framework. Por eso los módulos
que prueban usan imports relativos con extensión (`./permisos.ts`) y no el alias `@/`: Node no lee los
`paths` de `tsconfig`.

```bash
# todos
node --test "src/**/*.check.ts"

# uno solo
node --test src/lib/money.check.ts
node --test src/lib/equipo.check.ts
node --test src/lib/permisos.check.ts
node --test src/lib/cuit.check.ts
node --test src/lib/email/layout.check.ts
node --test "src/app/(app)/alertas/plantillas.check.ts"
```

Requiere un Node que ejecute TypeScript directamente; se verificó con Node 24.14.1. *Pendiente de
confirmar:* la versión mínima de Node. Aparece una advertencia `MODULE_TYPELESS_PACKAGE_JSON` porque
`package.json` no declara `"type": "module"`; es inofensiva.

| Archivo | Pruebas | Qué demuestra |
|---|---|---|
| `src/lib/money.check.ts` | 10 | La máscara de dinero es-AR agrupa miles con puntos, usa la coma como decimal (máximo 2), descarta basura y ceros iniciales; `parseMoney` nunca devuelve `NaN` ni lanza; el cursor se mantiene al editar en el medio del monto |
| `src/lib/equipo.check.ts` | 3 | El nombre manda sobre la categoría y "red para arco" es una red; una marca ("Redex") no se confunde con el producto; sin pista en el nombre decide la categoría, y sin nada es "otro" |
| `src/lib/permisos.check.ts` | 6 | El CHECK de `roles.permisos` de la **migración 0007** tiene exactamente las claves del catálogo de TypeScript; los roles por defecto de SQL coinciden con `ROLES_POR_DEFECTO`; las dependencias apuntan a permisos que existen y se agregan de forma transitiva; el Administrador tiene los 19; `rutaInicial` elige la primera pantalla permitida |
| `src/lib/email/layout.check.ts` | 8 | El HTML de los mails escapa el contenido (no se puede inyectar `<script>`); `urlSegura()` solo deja `http(s)` y `mailto`, y `javascript:` no llega a un `href`; el logo es por CID, sin imágenes externas; la versión en texto plano trae contenido y link; las plantillas de activación y recuperación |
| `src/app/(app)/alertas/plantillas.check.ts` | 10 | Formato de fecha sin zonas horarias; saludo con nombre de pila o al club; la frase distingue vencido de por vencer; el verbo concuerda en plural; sin fecha de vencimiento no inventa plazo; el mensaje de WhatsApp es más corto que el del mail; los links de WhatsApp y `mailto` codifican bien |

`permisos.check.ts` lee `supabase/migrations/0007_entrega_final.sql`. **Si agregás un permiso, hay que
tocarlo en `src/lib/permisos.ts` y en la migración que redefina el CHECK y los roles por defecto**, o este
self-check falla. Es la red de seguridad contra guardar un rol que la base rechace.

### Cómo leer el resultado

```text
✔ maskMoney groups thousands with dots (1.2ms)     <- pasó
✖ nombre de la prueba                               <- falló, con el diff esperado vs. real debajo
ℹ tests 37
ℹ pass 37
ℹ fail 0
```

Lo que importa son las tres últimas líneas: `fail 0` es éxito. El proceso termina con código de salida distinto
de 0 si algo falla.

---

## 3. Verificación estática y build

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx next build
```

- `tsc --noEmit` compila sin generar archivos. Un error de tipos en cualquier archivo corta.
- `eslint src --max-warnings=0` trata cualquier advertencia como error.
- `next build` además comprueba que `src/lib/supabase/admin.ts` (que importa `server-only`) no termine
  importado desde un componente de cliente: si pasara, el build falla, y es la garantía de que la clave de
  servicio no llega al navegador.

Los tres tienen que pasar antes de pushear (ver [CONTRIBUTING](../CONTRIBUTING.md)).

`package.json` solo define los scripts `dev`, `build`, `start` y `lint` (este último es `eslint` a secas, sin
`--max-warnings=0`). Los scripts `typecheck` y `test` están planificados en F6; mientras tanto se corren los
comandos de arriba tal cual.

---

## 4. Pruebas SQL

Tres scripts en `supabase/tests/`. Todos:

- se pegan **enteros** en el **SQL Editor** de Supabase y se ejecutan;
- crean organizaciones y usuarios de prueba, y se hacen pasar por cada uno **como lo hace la aplicación**
  (`set local role authenticated` más un JWT con el `sub` del usuario);
- corren dentro de una transacción que termina en `ROLLBACK`: **no dejan nada en la base**;
- cortan con un `ERROR` que empieza con `FALLA:` apenas algo se cumple de más o de menos.

### Cuál corre antes y cuál después de la 0007

| Script | Requiere | Se corre | Por qué |
|---|---|---|---|
| `0005_permisos.sql` | `0004`, `0005` y **`0007` aplicadas** | **Después** de la 0007 | Desde la 0007 usa los nombres de rol nuevos (`Vendedor`, `Solo lectura`), exige que el Vendedor vea solo su cartera, y espera que la organización nueva reciba 4 roles y 6 etapas |
| `0007_reglas.sql` | **`0007` aplicada** (o la migración dentro de la misma transacción) | **Después** | Prueba objetos que crea la 0007 |
| `0007_reejecucion.sql` | Una base **sin** la 0007 | **Antes**, y nunca en una base que ya la tiene | Corre la migración **dos veces** dentro de la prueba para comprobar que es re-ejecutable. Hay que reemplazar cada línea `-- @@ MIGRACION 0007 @@` por el contenido completo de la migración (son dos líneas) |

**Si re-ejecutás la 0007, re-ejecutá la 0008 después.** La 0007 de este repositorio ya no recrea las
políticas `borrar` de `empresas` y `contactos`, pero una copia vieja de la 0007 sí lo haría.
`0008_baja_logica.sql` prueba, además de la baja lógica, el trigger que conserva una etapa ganada y una
perdida; se corre **después** de aplicar la 0008.

Como la base de producción ya tiene la 0007 aplicada, **`0007_reejecucion.sql` no se puede ejecutar ahí**.
Sirve para una base nueva o un ensayo antes de aplicar la migración. Antes de la 0007 el script
`0005_permisos.sql` que está en el repositorio ya no sirve (usa nombres de la 0007).

### `0005_permisos.sql`: aislamiento y permisos

Crea dos organizaciones de prueba (A y B) y usuarios con distintos roles. Comprueba, entre otras cosas:

- una organización nueva recibe 4 roles y 6 etapas;
- un usuario no obtiene organización desde `user_metadata` (editable por él mismo) ni un rol de otra
  organización;
- cada usuario ve solo lo de su organización: empresas, productos, etapas, roles, perfiles, organizaciones;
- no se puede insertar ni mudar una fila a la otra organización, ni colgar un contacto de una empresa ajena ni
  vender un producto del catálogo ajeno (claves foráneas compuestas);
- el Vendedor no edita el catálogo, no edita ni borra la bitácora, no se modifica su propio perfil, no
  administra roles y no puede ejecutar `registrar_envio_auth`;
- Solo lectura ve clientes pero no ventas ni bitácora, y no crea ni edita;
- el Administrador crea y edita roles propios, pero no edita ni borra el rol Administrador, no crea otro con
  esa marca, y no puede guardar un permiso inexistente;
- un usuario dado de baja y el de una organización suspendida no ven nada;
- el superadmin ve todas las organizaciones y **ningún dato comercial**;
- un visitante sin sesión no ve nada.

### `0007_reglas.sql`: las reglas de la entrega final

Comprueba, verificando **el código y el mensaje del error** (así se sabe que frena el mecanismo correcto:
trigger, RLS, FK o CHECK) y no solo que falle:

| Bloque | Qué comprueba |
|---|---|
| Alta de organización | 4 roles con los nombres nuevos, 6 etapas (1 ganada, 1 perdida), 12 tipos de actividad, 7 orígenes, 7 motivos |
| Cartera propia | El Vendedor ve exactamente sus empresas, contactos (los de su empresa y su cliente individual), oportunidades, ventas, ítems, alertas, actividades e historial; no puede tocar ni borrar lo ajeno |
| Asignación | El Vendedor no puede crear para otro ni reasignar (empresas, contactos, oportunidades); un responsable de otra organización se rechaza |
| Compatibilidad con la app vieja | Altas con `responsable_id` nulo explícito quedan para el creador; la bitácora con solo `tipo` completa el tipo de catálogo y fuerza el autor |
| Actividades | Cada referencia tiene que ser visible y coherente; sin empresa ni contacto se rechaza |
| Reglas del embudo | Perdida sin motivo falla; estado incompatible falla; perdida con motivo por `cambiar_etapa` deja estado, fecha y motivo, historial y observación; editar una cerrada queda auditado; borrar la fecha de cierre falla; reabrir sin permiso falla (por RPC y por `update`) |
| Responsable comercial | Ve todo; reabre; reasigna; ganada por `update` directo con fecha de hoy; cambiar el resultado toma la fecha del nuevo cierre; no borra oportunidades; no crea motivos |
| Solo lectura | Sigue viendo todos los clientes y no ve oportunidades |
| Administrador | Edita catálogos, etapas y datos de la empresa; no puede suspender ni renombrar su organización; no cambia el tipo de una etapa con oportunidades; ni él borra oportunidades |
| Logo (Storage) | No se sube sin `configuracion.gestionar`; el administrador de A no ve ni sube el logo de B, no mueve el suyo a la carpeta de B, no sube un SVG; la política de borrado está limitada a la propia organización y al permiso; el bucket es privado, de 1 MB y solo PNG, JPG y WebP |
| Baja lógica | Un contacto con actividades no se borra; ni `postgres` borra una oportunidad con historial |
| Aislamiento | El administrador de B no ve catálogos, historial, auditoría ni logo de A; no puede cambiar de etapa una oportunidad de A; un visitante sin sesión no ve nada |
| Sin usuario | `service_role` y scripts pueden reabrir y el historial queda sin autor, pero las reglas de estado siguen valiendo |
| Borrar una organización | Con cerradas, historial, auditoría y actividades, borrar la organización entera funciona y no deja huérfanos |

> **El caso del borrado de logos.** Supabase prohíbe todo `DELETE` directo sobre `storage.objects` con el
> trigger `storage.protect_delete`, aun sin filas afectadas. Por eso la prueba no borra: verifica en
> `pg_policies` que la política de borrado esté limitada a la organización propia y a
> `configuracion.gestionar` (commit `cb7c251`). Los archivos se borran por la API de Storage, que aplica las
> mismas políticas.

### `0007_reejecucion.sql`: la migración se puede volver a correr

Prueba lo que `0007_reglas.sql` no puede, porque necesita correr la migración dos veces:

- la migración de roles corre **una sola vez**: si un administrador le saca `clientes.ver_todos` a un rol,
  volver a correr la 0007 no se lo devuelve;
- una organización que ya tenía un rol propio llamado "Vendedor" no choca: su "Ventas" no se renombra pero
  recibe el trato de vendedor;
- "Corporativo" conserva lo que el administrador le había agregado;
- correrla dos veces no duplica catálogos, etapas, historial ni roles.

### Cómo ensayar la 0007 sin aplicarla

Dentro de una transacción: `begin;`, el contenido de `0007_entrega_final.sql` y el de `0007_reglas.sql`
(que termina en `ROLLBACK` y deshace las dos cosas). Ver [deploy](./deploy.md#ensayar-la-0007-sin-aplicarla).

---

## 5. Cómo leer un resultado

Todas las pruebas SQL terminan con una consulta final que solo se alcanza si nada falló. Va **después** del
`ROLLBACK` porque el SQL Editor muestra el resultado de la **última** sentencia.

| Lo que ves | Qué significa |
|---|---|
| Una fila con `resultado` = `TODO OK: ...` | Todo se cumplió y no quedó nada guardado (rollback) |
| Un error que empieza con `FALLA: ...` | Se pudo hacer algo que no se debería (o no se pudo algo que sí). El texto dice qué |
| `FALLA: ... (fallo, pero por otro motivo: [sqlstate] mensaje)` | La operación falló, pero por un mecanismo distinto del esperado: revisar qué la está frenando |
| Un error de Postgres sin `FALLA:` (por ejemplo, objeto inexistente) | La prueba no llegó a evaluar nada: probablemente falta una migración, o se corrió en el orden equivocado |

Si una prueba falla a mitad de camino y el editor deja la transacción abierta, ejecutá `rollback;` antes de
seguir, para no dejar datos de prueba.

---

## 6. Antes de hacer push

Los cuatro pasos de verificación estática y automática, en este orden:

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
node --test "src/**/*.check.ts"
npx next build
```

Si el cambio toca `supabase/migrations/`, además: ensayar la migración en una transacción con rollback,
aplicarla, correr `0005_permisos.sql` y `0007_reglas.sql` (o la prueba nueva que corresponda), y regenerar
`src/lib/supabase/types.ts`. Más en [CONTRIBUTING](../CONTRIBUTING.md).

---

## 7. Lo que todavía no se prueba

- **No hay pruebas de interfaz ni de extremo a extremo.** Playwright y GitHub Actions están planificados en
  F6 (2026-11-05). Hoy la interfaz se verifica a mano.
- **No hay integración continua**: nada corre solo en cada push.
- **Los componentes React no tienen pruebas**: los self-checks cubren lógica pura (dinero, permisos, mails,
  mensajes, íconos).
- **La interfaz de la 0007 no existe**, así que sus pantallas no se pueden probar todavía; las reglas sí
  están cubiertas en la base por `0007_reglas.sql`.
