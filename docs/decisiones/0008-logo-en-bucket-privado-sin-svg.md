# 0008. Logo en un bucket privado, sin SVG

- **Estado:** Aceptada. La base está lista; la interfaz de carga todavía no existe (F1, 2026-10-13)
- **Fecha:** 2026-10-04 (migración `0007`, sección 13, commit `a5c0135`)

## Contexto

Cada proveedor tiene que poder cargar su logo para los presupuestos imprimibles (F6): el documento sale con
el logo y los datos fiscales **del proveedor**, no con la marca Tuco & Nito. El archivo lo sube un usuario, lo
ven los demás usuarios de la misma organización y no debe poder cruzar a otra.

Un SVG subido por un usuario puede traer scripts.

## Decisión

- Bucket **`logos` privado** (`public = false`) en Supabase Storage, sin dependencia nueva.
- Solo `image/png`, `image/jpeg` e `image/webp`, hasta **1 MB** (1.048.576 bytes). Storage aplica el límite y
  los tipos al subir.
- **SVG excluido a propósito.**
- Ruta fija **`{organizacion_id}/logo.{png|jpg|jpeg|webp}`**, validada con una expresión regular en las
  políticas de inserción y de actualización.
- Cuatro políticas en `storage.objects`: ver (cualquiera de la organización, porque va en los presupuestos) y
  subir, cambiar y borrar (`configuracion.gestionar`). Todas limitadas a la carpeta de la propia organización
  con `split_part(name, '/', 1) = org_actual()`.
- Se servirá por URL firmada. La ruta queda en `organizaciones.logo_path`.

## Consecuencias

- Sin SVG no hay logos vectoriales; PNG, JPG o WebP alcanzan para un encabezado de presupuesto.
- El límite y los tipos los aplica Storage, no la aplicación, de modo que no dependen de un chequeo del
  navegador. La interfaz de F1 igual validará tamaño y tipo en el cliente para dar un mensaje claro.
- Supabase prohíbe todo `DELETE` directo sobre `storage.objects` (trigger `storage.protect_delete`), así que las
  pruebas SQL no pueden borrar un logo: verifican en `pg_policies` que la política de borrado esté acotada a la
  organización propia y a `configuracion.gestionar` (commit `cb7c251`). Los archivos se borran por la API.
- Cambiar el logo reemplaza el archivo de la misma ruta (o de otra extensión, que dejaría el anterior: la
  interfaz de F1 tendrá que limpiarlo).
