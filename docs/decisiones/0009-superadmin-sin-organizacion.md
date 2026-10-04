# 0009. Superadmin sin organización

- **Estado:** Aceptada
- **Fecha:** 2026-09-18 (migración `0004`) y 2026-09-19 (migración `0006`, commit `ecef8bf`)

## Contexto

Alguien del equipo del producto tiene que poder dar de alta clientes, asignarles su primer administrador y
suspenderlos. Pero esa persona no debería leer los datos comerciales de los clientes: es mínimo privilegio, y
una lista de clientes con sus empresas, contactos y ventas es información sensible de terceros.

En la `0004` el superadmin era además Administrador de la organización demo: la RLS le dejaba leer y editar
los datos de esa organización y la aplicación le mostraba el CRM completo.

## Decisión

- `perfiles.es_superadmin` es el nivel de **plataforma** y solo se asigna por SQL, nunca desde un metadato.
- Desde la migración `0006` el superadmin **no tiene organización ni rol**. El check
  `perfiles_org_o_superadmin` permite un perfil sin organización solo si es superadmin. Con eso `org_actual()`
  devuelve nulo y `tiene_permiso()` devuelve falso, y ninguna política de datos comerciales le deja pasar una
  fila.
- Lo que sí puede: ver todas las organizaciones, perfiles y roles, y administrar `organizaciones` (política
  "superadmin").
- Tiene su propia interfaz en `/admin` (`src/app/admin`), fuera del CRM. El layout del CRM lo redirige allí.
  Desde ahí crea clientes (con su primer Administrador y la invitación por mail), agrega administradores,
  reenvía invitaciones y suspende o reactiva clientes.
- Todas las acciones del panel empiezan verificando en el servidor que quien llama es superadmin.

## Consecuencias

- Si hace falta usar la organización demo, se le agrega un administrador desde el panel: el superadmin no
  entra.
- Soporte: para ver qué ve un cliente hay que entrar con una cuenta de ese cliente; el superadmin no puede
  "impersonar".
- Cada vez que se agrega una tabla hay que confirmar que la política no incluya al superadmin: la prueba
  `0005_permisos.sql` verifica que no vea empresas de otros clientes.
- El administrador de un cliente no puede cambiar el nombre ni el estado de su organización: lo protege un
  trigger (`organizaciones_proteger_plataforma`), porque una política de actualización no puede limitar
  columnas.
