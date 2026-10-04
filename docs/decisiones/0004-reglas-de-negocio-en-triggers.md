# 0004. Reglas de negocio en triggers de la base

- **Estado:** Aceptada
- **Fecha:** 2026-10-04 (migración `0007`, commit `a5c0135`); el criterio ya regía en las migraciones
  `0003` y `0005`

## Contexto

La consigna fija reglas para el embudo: una oportunidad abierta no puede estar en una etapa ganada o
perdida, ganada exige fecha real de cierre, perdida exige fecha y motivo, cada cambio se conserva en el
historial, una cerrada no se reabre sin autorización y modificar una cerrada deja registro.

Esas reglas tienen que cumplirse por **cualquier camino** que modifique una oportunidad: el arrastre de
tarjetas en el embudo, el formulario de edición, la RPC `cambiar_etapa` y cualquier llamada directa a la API.
Y por [0001](./0001-mutaciones-desde-el-cliente.md), el navegador ya escribe directamente en la base.

## Decisión

Las reglas viven en la base:

- **`oportunidades_reglas`** (trigger `BEFORE`): el estado sale del tipo de la etapa; ganada pone la fecha de
  cierre (hoy si no viene); perdida exige motivo; reabrir exige `oportunidades.reabrir`; una cerrada que sigue
  cerrada no pierde su fecha.
- **`oportunidades_estado_coherente`** (CHECK): garantía de última línea para cualquier camino que no pase por
  el trigger.
- **`oportunidades_registrar_etapa`** (trigger `AFTER`): escribe el historial de etapas. La observación llega
  por `current_setting('crm.observacion')`, que fija la RPC `cambiar_etapa()`.
- **`oportunidades_auditar_cerrada`** (trigger `AFTER`): registra los campos que cambian en una oportunidad
  que ya estaba cerrada.
- **`validar_responsable`**, **`etapas_validar_tipo`**, **`bitacora_defaults`** y
  **`organizaciones_proteger_plataforma`** aplican las demás reglas de asignación, de etapas, de actividades y
  de plataforma.
- La RPC `cambiar_etapa()` es `SECURITY INVOKER`: junta todo en un paso pero corre con la RLS y los permisos de
  quien llama. Las reglas las aplica el trigger, no la función.
- Los triggers que escriben tablas sin política de escritura (historial, auditoría) son `SECURITY DEFINER`.

## Consecuencias

- Una sola implementación de cada regla, probada en SQL (`supabase/tests/0007_reglas.sql`), válida para toda
  pantalla futura. Pedir un estado que no corresponde a la etapa es un **error**, no se corrige en silencio.
- La interfaz de hoy recibe errores genéricos y no puede, por ejemplo, pedir el motivo de pérdida al soltar una
  tarjeta en "Perdida": la tarjeta vuelve con un aviso. La interfaz que lo resuelve es F2.
- Lógica de negocio en SQL exige disciplina de migraciones: las migraciones de datos de la `0007` corren una
  sola vez con marcas explícitas, y hay una prueba de re-ejecución.
- Los triggers se disparan por orden alfabético de nombre dentro de cada momento (`BEFORE` o `AFTER`); las
  reglas no dependen de ese orden.
- Sin usuario (`auth.uid()` nulo: `service_role`, SQL Editor, scripts) las reglas de estado y fecha valen,
  pero no se exigen permisos: esos caminos son de confianza.
- Un cambio en el catálogo de permisos exige tocar la aplicación y la migración; lo vigila
  `src/lib/permisos.check.ts`.
