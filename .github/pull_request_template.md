## Qué cambia

<!-- Una o dos frases. Qué hace este PR, en lenguaje del usuario. -->

## Por qué

<!-- El problema o el requisito (consigna, fase del plan, issue). Enlazá el issue con "Closes #N" si hay. -->

## Cómo probarlo

<!-- Pasos concretos. Si hace falta una cuenta, indicá cuál (por ejemplo, la de Vendedor del seed). -->

1.
2.

## Estado de lo que toca

<!-- Marcá lo que corresponda. Distinguí lo implementado de lo que queda en la base sin interfaz o planificado. -->

- [ ] Interfaz y base (implementado)
- [ ] Solo base de datos, sin interfaz todavía
- [ ] Solo documentación

## Chequeos

- [ ] `npx tsc --noEmit`
- [ ] `npx eslint src --max-warnings=0`
- [ ] `node --test "src/**/*.check.ts"`
- [ ] `npx next build`

## Si hay una migración SQL

- [ ] Número siguiente libre, encabezado completo, idempotente
- [ ] Probada dentro de `begin ... rollback` junto con su script de pruebas
- [ ] Caso nuevo en `supabase/tests/` (con casos negativos) o motivo por el que no hace falta
- [ ] Permisos sincronizados entre `src/lib/permisos.ts` y la migración
- [ ] `src/lib/supabase/types.ts` regenerado
- [ ] Indiqué el orden de despliegue (migrar y desplegar enseguida, si la app vieja no es compatible)

## Documentación y diseño

- [ ] Actualicé la documentación afectada (`docs/`, `CHANGELOG.md`, `CLAUDE.md`)
- [ ] Si me aparté del kit de diseño, lo registré en `docs/design-overrides.md` (y no edité `docs/DESIGN.md`)
- [ ] Revisé la pantalla en claro, oscuro y ancho de móvil (si el cambio es visible)

## Seguridad y commits

- [ ] No hay secretos, claves ni datos reales de personas
- [ ] Los commits siguen Conventional Commits y no llevan líneas de atribución de IA
