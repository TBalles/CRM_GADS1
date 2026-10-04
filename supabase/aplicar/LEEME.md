# Kit para aplicar las migraciones 0008 a 0012

Un solo archivo, [`aplicar_0008_a_0012.sql`](./aplicar_0008_a_0012.sql), que reúne las cinco migraciones que
faltan en la base viva, en orden, y termina con una tabla que confirma que quedó todo puesto. Se pega entero
en el SQL Editor de Supabase. Es el paso que te falta para que se activen las canchas, las licitaciones, el
recambio en un clic y la numeración de presupuestos.

| # | Migración | Qué agrega |
|---|---|---|
| 1 | `0008_baja_logica` | Quita el borrado de empresas y contactos (baja lógica garantizada por la base) y la regla "siempre una etapa ganada y una perdida" |
| 2 | `0009_reglas_oportunidades` | Fecha de cierre no futura (hora de Argentina) y "una oportunidad es de una empresa o de un contacto" |
| 3 | `0010_indices_busqueda` | Índices para la búsqueda y la paginación del servidor (más un bloque opcional de `pg_trgm`, **apagado**) |
| 4 | `0011_rubro` | Canchas, licitaciones, recambio en un clic y la regla de la apertura |
| 5 | `0012_presupuestos` | Presupuestos numerados por organización, inmutables y sin borrado |

El archivo **se genera** con `npm run migraciones:consolidar` a partir de `supabase/migrations/`. No lo edites
a mano: `npm test` falla si quedó desactualizado respecto de las migraciones.

## Antes de empezar

- Tienen que estar aplicadas la `0001` a la `0007` (hoy lo están).
- Las cinco son **idempotentes**: volver a correrlas no cambia nada. Ninguna borra datos de usuarios; la `0008`
  solo quita dos políticas de borrado que ninguna pantalla usa.
- **No hay "deshacer".** Si hiciera falta volver atrás habría que restaurar una copia de la base. El plan
  gratuito de Supabase no trae copias automáticas: si querés red de seguridad, exportá antes lo que te importe.
- La aplicación que ya está desplegada **no necesita un nuevo deploy**: sabe esconder las secciones que todavía
  no tienen su migración y las muestra solas cuando la base las tiene.

## Paso a paso

1. Entrá a [supabase.com](https://supabase.com/dashboard) → tu proyecto (`pdseuwdifzywpdgawbrl`) → **SQL Editor**
   → **New query**.
2. Abrí `supabase/aplicar/aplicar_0008_a_0012.sql`, copiá **todo** el contenido (895 líneas, unos 50 KB) y pegalo.
3. Tocá **Run**. El editor puede avisar que el script tiene "operaciones destructivas": son los
   `drop policy if exists` y `drop trigger if exists` que hacen a las migraciones idempotentes. Confirmá.
4. Mirá el resultado: es una tabla con **24 filas `OK`** y una última fila `TOTAL` que tiene que decir
   **`TODO OK`**. La columna `verificacion` de esa fila dice además si `pg_trgm` está activo (es opcional, ver
   más abajo).

El editor manda el archivo como un solo pedido: si algo falla, Postgres **revierte todo el archivo** y no queda
nada a medias.

## Si algo falla

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| Un error con la línea y un mensaje (`relation … does not exist`, `column … does not exist`) | Falta una migración anterior (la `0001` a la `0007`) o se pegó el archivo cortado | Verificá que estén aplicadas las anteriores y volvé a pegar el archivo **entero** |
| El error nombra una función o un trigger de una migración puntual | Se identifica por el cartel `>>> 00XX_…` que está más arriba en el archivo | Corré **solo** ese archivo de `supabase/migrations/` para ver el error completo, arreglalo y volvé a correr el kit |
| Corrió sin error pero alguna fila de verificación dice `FALTA` | Esa pieza no quedó puesta | Volvé a correr el kit completo (es idempotente). Si sigue, corré a mano la migración que figura en la columna `migracion` |
| `extension "pg_trgm" is not available` | Activaste el bloque opcional y tu plan no tiene la extensión | Volvé a comentar el bloque (ver abajo). La aplicación anda igual sin él |

Nunca edites el archivo consolidado para "arreglarlo": si hay que cambiar algo, se cambia la migración
correspondiente y se vuelve a generar el kit.

## El bloque opcional de `pg_trgm`

Dentro de la sección de la `0010` hay un bloque marcado `>>> BLOQUE OPCIONAL: PG_TRGM … <<< FIN BLOQUE OPCIONAL`
que viene **comentado** (apagado). Hace usable el buscador con decenas de miles de filas; con el volumen de un
CRM chico no se nota. Para encenderlo, sacale el `-- ` del principio a las líneas entre los dos marcadores y
ejecutá el archivo entero de nuevo.

## Después: las pruebas SQL

Cada una se pega en el SQL Editor y se ejecuta. Hacen `rollback` (no dejan nada guardado) y terminan con **una
fila que dice `TODO OK`**; si algo falla, cortan con un error que empieza con `FALLA:`.

1. `supabase/tests/0005_permisos.sql`
2. `supabase/tests/0007_reglas.sql`
3. `supabase/tests/0008_baja_logica.sql`
4. `supabase/tests/0009_reglas_oportunidades.sql`
5. `supabase/tests/0011_rubro.sql`
6. `supabase/tests/0012_presupuestos.sql`

**No corras** `supabase/tests/0007_reejecucion.sql`: es solo para una base que todavía no tiene la `0007`.

Validado en PGlite (Postgres en el navegador de Node): migraciones `0001` a `0007`, después **solo** este
archivo (dos veces seguidas), y las seis pruebas dan `TODO OK`.

## Después: tipos y typecheck

Los tipos de `src/lib/supabase/types.ts` son anteriores a las migraciones nuevas. Regeneralos contra la base ya
migrada y verificá que todo compile (necesitás `supabase login` o `SUPABASE_ACCESS_TOKEN`):

```bash
npx supabase gen types typescript --project-id pdseuwdifzywpdgawbrl > src/lib/supabase/types.ts
npm run typecheck
```

Si el typecheck marca errores nuevos, son los que escondía el tipo desactualizado: se corrigen en ese momento.

## Después: completar el manual de usuario

El manual (`docs/Manual-de-usuario-Tuco-y-Nito.pdf`) se hizo mientras estas migraciones no estaban aplicadas, así
que las figuras de canchas, licitaciones, recambio y presupuesto guardado salen como **«Captura pendiente»**
(la lista está en `docs/manual/pendientes.json`). Con la base migrada se completan con un solo comando.

1. **Datos de la demo del rubro.** La demostración base no trae canchas, datos de licitación ni presupuestos
   guardados. Cargalos con el complemento (pegar y ejecutar en el SQL Editor):
   `supabase/seeds/demo_rubro.sql`. Es re-ejecutable, requiere `demo_catedra.sql` y estas migraciones.

   **Sin acceso al SQL Editor**, la misma carga se hace por la API con la cuenta de Administrador de la demo:

   ```bash
   DEMO_PASSWORD=… npm run demo:rubro -- --dry   # solo lee: dice qué crearía
   DEMO_PASSWORD=… npm run demo:rubro            # carga lo que falte
   ```

   (`scripts/demo/cargar-rubro.mjs`; lee la URL y la clave pública del `.env`, la contraseña va solo por entorno.)
   Es idempotente: busca cada cosa por su clave natural y no duplica nada; sobre una base donde ya se cargó
   `demo_rubro.sql` no crea canchas, licitación ni presupuesto. Lo único que agrega es vincular la oportunidad
   «Recambio de redes de fútbol 11» al equipo entregado, para que la alerta muestre «Oportunidad abierta →».
2. **Levantá la app** apuntando a esa base: `npm run dev` (o `npm run build && npm run start`).
3. **Regenerá el manual** pasando las credenciales **por entorno, solo en la línea de comandos** (nunca en un
   archivo del repositorio):

   ```bash
   MANUAL_BASE_URL=http://localhost:3000 \
   MANUAL_EMAIL=administrador@demo.tuconito.com.ar MANUAL_PASSWORD=… \
   MANUAL_EMAIL_VENDEDOR=ventas@demo.tuconito.com.ar MANUAL_PASSWORD_VENDEDOR=… \
   npm run manual
   ```

   (La contraseña de la cuenta de demostración está en el comentario de `supabase/seeds/demo_catedra.sql`.)
   Opcionales: `MANUAL_EMAIL_SUPERADMIN` y `MANUAL_PASSWORD_SUPERADMIN` para las figuras del panel de
   plataforma, y `ANTHROPIC_API_KEY` en el `.env` de la app (y reiniciarla) para las de la IA.
4. Mirá la salida: dice cuántas figuras quedaron pendientes y por qué. Detalle del manual en
   [`docs/manual/LEEME.md`](../../docs/manual/LEEME.md).
