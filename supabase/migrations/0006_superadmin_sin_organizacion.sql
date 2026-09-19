-- Tuco & Nito - 0006: el superadmin deja de pertenecer a una organizacion
--
-- Correr en el SQL Editor de Supabase DESPUES de 0005.
--
-- Hasta aca el superadmin era, ademas, Administrador de la organizacion demo:
-- la RLS le dejaba leer y editar los datos comerciales de esa organizacion y
-- la app le mostraba el CRM completo. Ahora el superadmin opera solo la
-- PLATAFORMA (el panel /admin): sin organizacion ni rol, org_actual() y
-- tiene_permiso() le dan null/false y no ve datos comerciales de NADIE.
--
-- El check perfiles_org_o_superadmin (0004) ya permite un perfil sin
-- organizacion cuando es superadmin. Los datos de la organizacion demo quedan
-- intactos: si hace falta usarla, se le agrega un administrador desde el panel.
--
-- Se puede correr mas de una vez.

update public.perfiles
set rol_id = null,
    organizacion_id = null
where es_superadmin;
