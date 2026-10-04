# 0007. Gráficos en CSS puro, sin librería

- **Estado:** Aceptada
- **Fecha:** 2026-09-17 (commits `53ef1f1`, `ffc4d9e`)

## Contexto

El Sumar UI Kit (`docs/DESIGN.md`) prescribe Recharts como única librería de gráficos. El tablero de esta
aplicación necesita solo dos formas: barras horizontales ordenadas (oportunidades por etapa, empresas con más
valor) y una barra apilada al 100 % (distribución del embudo). Recharts pinta `fill` y `stroke` como
atributos SVG, donde `var(--token)` no se resuelve: habría que duplicar la paleta en JavaScript y mantenerla
sincronizada a mano con el tema claro y oscuro.

## Decisión

El tablero no usa ninguna librería de gráficos. Las dos formas se construyen con `div` y flex en
`src/app/(app)/dashboard/charts.tsx`:

- **Magnitud** (`MagnitudeBars`): barra horizontal ordenada, un solo tono de marca, con el valor como etiqueta
  directa. Sin un color distinto por categoría nominal: duplicaría con color el largo de la barra sin agregar
  información. Admite una barra distinta del valor (`bar`): el ranking de empresas mide la barra por monto y
  muestra la cantidad como etiqueta.
- **Parte de un todo** (`ShareBar`): barra apilada al 100 % con los colores de etapa y leyenda con porcentajes,
  para que la identidad nunca dependa solo del color.
- Los promedios y montos no son parte de un todo: nunca torta.

Queda registrado como la divergencia 5 de `docs/design-overrides.md`.

## Consecuencias

- Los gráficos heredan los tokens de color y funcionan en claro y oscuro sin código adicional.
- Sin dependencia nueva ni peso de JavaScript extra.
- No sirve para series temporales ni gráficos densos. Si aparecen, la divergencia dice que se traiga Recharts y
  se siga la sección 4.6 del kit.
- Los gráficos no tienen interacción más allá de lo que da el navegador.
