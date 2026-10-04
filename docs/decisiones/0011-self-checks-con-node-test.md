# 0011. Self-checks con `node --test`, sin framework de pruebas

- **Estado:** Aceptada. Las pruebas de interfaz y de extremo a extremo están planificadas en F6
- **Fecha:** 2026-09-17 (primer self-check, `money.check.ts`, commit `8326161`); ampliada en `a72f794`, `2908420` y `aa0619c`

## Contexto

El proyecto tiene poca lógica pura pero sensible (máscara de dinero, redacción de mensajes, catálogo de
permisos que tiene que coincidir con la base, armado de mails) y ninguna razón para sumar un framework de
pruebas, un transformador ni un bundler solo para probarla.

## Decisión

- Cada módulo de lógica pura tiene un archivo `*.check.ts` al lado, ejecutable con el runner de Node
  (`node --test`), sin dependencia nueva.
- Los módulos probados usan **imports relativos con extensión** (`./permisos.ts`) y no el alias `@/`, porque
  Node no lee los `paths` de `tsconfig`. Es el precio de poder probarlos sin bundler, y cada archivo lo
  explica en su encabezado.
- Las funciones probadas son puras: reciben datos y devuelven texto o valores, sin estado ni red.
- Un self-check puede leer archivos del repositorio. `permisos.check.ts` lee la migración vigente y falla si
  el CHECK de `roles.permisos` o los roles por defecto divergen del catálogo de TypeScript.
- Las reglas de la base se prueban en SQL (`supabase/tests/`), dentro de una transacción con `ROLLBACK`,
  haciéndose pasar por cada usuario con su JWT.

## Consecuencias

- Verificación rápida (menos de un segundo para los 37 casos) y sin configuración.
- Los componentes React no tienen pruebas: solo se cubre lógica pura. Las pantallas se verifican a mano hasta
  que lleguen Playwright y la integración continua (F6).
- Hay que acordarse de ejecutarlos: no hay CI todavía. Están en la lista previa al push de
  [CONTRIBUTING](../../CONTRIBUTING.md).
- Agregar un permiso exige tocar la aplicación y la migración a la vez; el self-check lo hace obligatorio.
- Las pruebas SQL hay que pegarlas a mano en el SQL Editor. Ver [pruebas](../pruebas.md).
