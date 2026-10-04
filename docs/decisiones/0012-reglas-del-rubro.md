# 0012. Reglas del rubro: medidas estáticas, sugerencia en lugar de diagnóstico y la apertura en un trigger aparte

- **Estado:** Aceptada
- **Fecha:** 2026-10-04 (F4, migración `0011`)

## Contexto

F4 agrega lo que es propio de quien le vende equipamiento a canchas: la ficha de canchas de un cliente, una sugerencia
de qué arcos y redes le tocan, las licitaciones municipales y el recambio en un clic. Hubo tres decisiones con
alternativas reales:

1. de dónde salen las medidas de los arcos para la sugerencia;
2. qué promete la sugerencia;
3. dónde vive la regla "una licitación no se gana antes de su apertura".

## Decisión

**1. Las medidas son estáticas, en código.** F5 y futsal 3 × 2 m, F7 6 × 2,10 m, F9 y F11 7,32 × 2,44 m
(`src/lib/canchas.ts`). Son las del reglamento de cada formato, no un dato de negocio que cada proveedor configure,
así que no hay tabla de medidas ni pantalla para editarlas. Se prueba con un self-check. Si algún día un cliente
trabaja con formatos propios, se agrega una tabla; hoy sería configuración sin usuario.

**2. La sugerencia es una sugerencia.** Compara las medidas estándar con lo que ESTE proveedor le entregó a la
empresa (parque instalado), por la medida que dice el nombre del producto. No sabe qué compró el club en otro lado ni
el estado real de la cancha, supone una red por arco y no cuenta los equipos vencidos. Por eso la pantalla dice "Le
faltan…" con una nota de que no es un diagnóstico, y las pelotas son una reserva opcional que no cuenta para "completo".
Un producto cuyo nombre no dice la medida se trata como comodín en lugar de ignorarse.

**3. La regla de la apertura va en la base, en un trigger propio.** `oportunidades_licitacion_regla` es un trigger
nuevo sobre `oportunidades` y no una edición de `oportunidad_reglas()` (0007/0009): cada regla en su función, sin
reescribir una función que ya tiene cuatro capas de historia. Calcula el tipo de la etapa por su cuenta, así que no
depende del orden en que Postgres dispara los triggers `BEFORE`. Compara con la fecha de Argentina (como la 0009) y
también rechaza ganar una licitación sin fila en `licitaciones`. La pantalla repite la regla (modal de cierre y detalle)
solo para no ofrecer un botón que va a fallar.

## Consecuencias

- **Bueno.** La regla vale para cualquier camino (formulario, RPC, script). Las medidas se auditan leyendo un archivo.
  La sugerencia no promete más de lo que sabe.
- **Cuesta.** El reparto de unidades entre medidas es voraz (un producto "5/7" va primero a F5); una cuenta exacta pediría
  la medida como columna del producto. Cambiar una medida es cambiar código.
- **Límite abierto.** La regla se juzga al ganar: editar a futuro la apertura de una licitación ya ganada no se impide.
- **Despliegue.** La 0011 se aplica a mano; la aplicación esconde las secciones que dependen de ella mientras falte
  (`esErrorDeEsquema`) en lugar de romperse.
