# Cómo contribuir

Guía para quien toque el código, las migraciones o la documentación de Tuco & Nito. Es corta a propósito:
lo que no está acá está en [docs/README.md](./docs/README.md).

**Antes de abrir un PR o pushear a `main`:** pasan los cuatro chequeos, la migración (si hay) está probada
con rollback, y la documentación afectada está actualizada. El detalle está más abajo.

> Cada push a `main` dispara un deploy de producción en Vercel (ver [docs/deploy.md](./docs/deploy.md)).
> Tratá `main` como una rama que siempre tiene que funcionar.

## 1. Puesta en marcha

Los pasos para correr el proyecto en local están en el [README](./README.md#inicio-rápido-local).

Dos advertencias de este repositorio:

- Next.js 16 tiene cambios que rompen APIs y convenciones respecto de lo que se suele saber. Antes de escribir
  código de Next, leé la guía correspondiente en `node_modules/next/dist/docs/` (lo recuerda el bloque
  `nextjs-agent-rules` de [CLAUDE.md](./CLAUDE.md), que no hay que borrar).
- `docs/DESIGN.md` es una copia de solo lectura del kit de diseño (ver la sección 6).

## 2. Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `tipo(alcance): asunto`.

| Tipo | Cuándo | Ejemplo real del historial |
|---|---|---|
| `feat` | Una capacidad nueva | `feat(db): migracion 0007 para la entrega final` |
| `fix` | Se corrige un comportamiento | `fix(dashboard): el ranking de empresas excluye oportunidades sin empresa` |
| `refactor` | Cambia la forma, no el comportamiento | `refactor(ui): jerarquia y masthead en todas las pantallas` |
| `docs` | Solo documentación | `docs: vendor the UI kit and record the design divergences` |
| `test` | Pruebas | `test(db): look up the superadmin before switching to the authenticated role` |
| `chore` | Mantenimiento, dependencias, datos de demostración | `chore(deps): add lucide-react, clsx, tailwind-merge and tw-animate-css` |

Reglas del proyecto:

- **Sin atribución de IA.** No agregues líneas `Co-Authored-By` ni textos del tipo "Generated with ..." en los
  mensajes de commit ni en las descripciones de PR. Solo Conventional Commits.
- Un commit es una unidad de trabajo revisable: el código, sus pruebas y su documentación van juntos.
- El asunto en presente e imperativo o descriptivo, sin punto final, de alrededor de 72 caracteres. El cuerpo
  explica el **porqué** (el historial tiene buenos ejemplos: `95f5273`, `a72f794`).
- El idioma de los mensajes del historial es mixto (inglés al principio, español después, sin tildes en el
  asunto). Para lo nuevo, preferí español.
- Nunca se commitean secretos (`.env`, `.env.local`, claves, contraseñas de aplicación).

## 3. Ramas y pull requests

Hoy el historial es lineal sobre `main`. Como cada push a `main` despliega, la forma recomendada es:

1. Crear una rama desde `main`: `feat/descripcion-corta`, `fix/...`, `docs/...`.
2. Hacer commits chicos según la sección anterior.
3. Abrir un PR hacia `main` con la plantilla (`.github/pull_request_template.md`): qué cambia, por qué, cómo
   probarlo y la lista de chequeos.
4. Revisión por una persona que no haya escrito el cambio, con contexto fresco. Es obligatoria cuando el
   cambio toca migraciones, permisos o RLS.
5. Merge a `main` cuando los chequeos pasan. Si el PR incluye una migración, seguí el
   [orden de migración y deploy](./docs/deploy.md#8-orden-de-migración-y-deploy).

Un PR muy grande (más de unas 400 líneas) se parte en PRs encadenados.

## 4. Chequeos antes de pushear

Los cuatro tienen que pasar. No hay integración continua todavía (está planificada en F6), así que los corre
quien pushea.

```bash
npx tsc --noEmit                      # tipos
npx eslint src --max-warnings=0       # lint, sin advertencias
node --test "src/**/*.check.ts"       # self-checks
npx next build                        # build de producción
```

Qué prueba cada uno y cómo leer los resultados: [docs/pruebas.md](./docs/pruebas.md).

Además, si el cambio es visible, mirá la pantalla en claro y oscuro y en ancho de móvil.

## 5. Migraciones SQL

Las migraciones viven en `supabase/migrations/`, se aplican a mano en el SQL Editor de Supabase y **no hay
migraciones de reversa**. Por eso importan estas reglas:

1. **Nombre y orden.** `NNNN_descripcion.sql` con el siguiente número libre. Se aplican en orden y nunca se
   edita una migración ya aplicada: se escribe una nueva.
2. **Aditiva siempre que se pueda.** Agregá tablas y columnas con valor por defecto antes que modificar o
   borrar. Si migra datos o permisos existentes (como la `0007`), decilo en el encabezado y hacé que cada
   migración de datos corra **una sola vez**, con una marca explícita.
3. **Idempotente.** `create ... if not exists`, `drop ... if exists`, `add column if not exists`,
   `on conflict do nothing`. Volver a correrla no debe romper ni duplicar.
4. **Encabezado.** Explicá qué hace, cómo correrla, qué requiere, si no es solo aditiva y en qué orden
   desplegar. Mirá el de la `0007` como modelo.
5. **Transacción.** Las migraciones tempranas llevan `begin`/`commit`; la `0007` no, a propósito, para poder
   ensayarla dentro de una transacción con el test. Decidilo y dejalo escrito en el encabezado.
6. **Se prueba antes dentro de `begin ... rollback`**: pegar `begin;`, la migración y el script de pruebas
   (que termina en `rollback`). Después se aplica de verdad. Ver
   [docs/deploy.md](./docs/deploy.md#ensayar-la-0007-sin-aplicarla).
7. **Cada tabla nueva** lleva `organizacion_id uuid not null default public.org_actual()`, `unique
   (organizacion_id, id)`, claves foráneas compuestas, RLS habilitada y una política por operación con
   `organizacion_id = (select public.org_actual())` más el permiso. Antes de crear políticas nuevas sobre una
   tabla, borrá las viejas: las políticas se combinan con OR.
8. **Funciones.** `SECURITY DEFINER` solo cuando hace falta, siempre con `set search_path = public`. Las
   funciones internas se revocan a `public`, `anon` y `authenticated`.
9. **Permisos.** Si agregás uno, actualizalo en `src/lib/permisos.ts` y en la migración (CHECK de
   `roles.permisos` y roles por defecto). `permisos.check.ts` falla si divergen.
10. **Pruebas SQL.** Todo cambio de reglas o RLS lleva su caso en `supabase/tests/`: dentro de una transacción
    con `rollback`, con casos negativos que verifiquen el código y el mensaje del error, y la fila final
    `TODO OK`. Los errores empiezan con `FALLA:`.
11. **Después de aplicarla:** regenerar `src/lib/supabase/types.ts`, volver a correr el seed de demostración si
    cambia datos, y actualizar [modelo de datos](./docs/modelo-de-datos.md),
    [reglas de negocio](./docs/reglas-de-negocio.md) y el [CHANGELOG](./CHANGELOG.md).
12. **Orden de despliegue.** Si la aplicación vieja no es compatible con la base nueva, aplicar la migración y
    desplegar inmediatamente después.

## 6. Diseño e interfaz

- [`docs/DESIGN.md`](./docs/DESIGN.md) es el kit canónico, una copia **de solo lectura**: no se edita. Antes de
  crear o cambiar interfaz, leelo.
- Si la aplicación necesita apartarse del kit, **no lo edites**: agregá un bloque a
  [`docs/design-overrides.md`](./docs/design-overrides.md) con el formato kit, esta app, dónde y por qué.
- Reutilizá los primitivos de `src/components/ui/` y los campos de `src/components/form.tsx`; no inventes
  variantes de Button, Card o Drawer ni reimplementes selects.
- Respetá los tokens: no escribas colores de marca a mano fuera de `--brand` y compañía (`src/app/globals.css`).
  Si cambiás un token de color, verificá el contraste: el piso es 4.5:1 (WCAG AA).
- Montos siempre con `MoneyInput` y `parseMoney`, nunca `type="number"`. Tablas responsive en dos bloques
  (tarjetas en móvil, tabla en escritorio). Tooltips con `title="..."`.
- Las mutaciones del CRUD se hacen desde el cliente de Supabase del navegador y las Server Actions se reservan
  para lo privilegiado: [decisión 0001](./docs/decisiones/0001-mutaciones-desde-el-cliente.md).

## 7. Convenciones de código y nombres

- **Dominio en español.** Tablas, columnas, rutas y textos de interfaz están en español (empresas, contactos,
  oportunidades, embudo, etapas). Los identificadores de código pueden mezclar; seguí el patrón del archivo.
- Los módulos de lógica pura que tienen un self-check usan imports relativos con extensión (`./x.ts`) y no el
  alias `@/`, para poder correr con `node --test`.
- Los textos de interfaz siguen la voz que ya tiene la aplicación: español rioplatense con voseo ("Ingresá",
  "Elegí un rol"), directo y sin jerga. Los errores dicen qué pasó y qué hacer.
- Los formularios usan los componentes de `src/components/form.tsx`.
- Cuando algo cambia el esquema, hay que regenerar los tipos en el mismo cambio.

## 8. Documentación

Tocaste comportamiento, esquema, permisos o despliegue: actualizá la documentación en el mismo cambio.

| Cambió | Actualizá |
|---|---|
| Una regla de negocio | [docs/reglas-de-negocio.md](./docs/reglas-de-negocio.md) |
| Tablas, columnas, RLS | [docs/modelo-de-datos.md](./docs/modelo-de-datos.md) |
| Una decisión técnica de peso | Una [ADR](./docs/decisiones/README.md) nueva |
| Algo visible para quien usa el sistema | [CHANGELOG.md](./CHANGELOG.md) y, si corresponde, [notas de versión](./docs/notas-de-version.md) |
| Variables de entorno o pasos de despliegue | [docs/deploy.md](./docs/deploy.md) |
| Estructura del proyecto o convenciones para sesiones de IA | [CLAUDE.md](./CLAUDE.md) |

Distinguí siempre qué está **implementado**, qué está en la **base de datos sin interfaz** y qué está
**planificado**; no documentes como existente lo que no se construyó.

## 9. Seguridad

- No pegues claves, contraseñas ni datos reales de personas en issues, PRs ni commits.
- `SUPABASE_SERVICE_ROLE_KEY` es solo del servidor y nunca lleva el prefijo `NEXT_PUBLIC_`.
- Para reportar una vulnerabilidad no abras un issue público: seguí [SECURITY.md](./SECURITY.md).
