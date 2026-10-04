# Política de seguridad

Tuco & Nito es un trabajo práctico universitario (UNLaM, Gestión Aplicada al Desarrollo de Software II) que
corre en producción en [crmgads1.vercel.app](https://crmgads1.vercel.app). Aun así, tratamos la seguridad de
los datos de los clientes con seriedad. Este archivo dice cómo reportar un problema y qué cubre el proyecto.

## Cómo reportar una vulnerabilidad

1. **No abras un issue público** con los detalles de una vulnerabilidad.
2. Contactá a los mantenedores del repositorio a través de GitHub
   ([github.com/TBalles/CRM_GADS1](https://github.com/TBalles/CRM_GADS1)): usá el reporte privado de
   vulnerabilidades de la pestaña **Security** si está disponible, o escribile directamente a un mantenedor
   por GitHub pidiendo un canal privado.
3. Incluí: qué encontraste, los pasos para reproducirlo, qué datos o funciones afecta y, si lo tenés, una
   sugerencia de corrección.
4. No accedas a datos de otras personas más allá de lo necesario para demostrar el problema, y no hagas
   pruebas que degraden el servicio.

Los mantenedores del proyecto son estudiantes: respondemos con el mejor esfuerzo, sin plazos garantizados.

> **Pendiente de confirmar.** No hay una dirección de correo de seguridad definida y no se verificó que el
> reporte privado de vulnerabilidades esté habilitado en el repositorio. Hasta que el grupo lo defina, el
> único canal es el contacto por GitHub descrito arriba.

## Qué cubre el proyecto

- **Versión soportada:** la rama `main`, que es lo que corre en producción. No hay versiones anteriores
  mantenidas.
- **Dentro de alcance:** el código de este repositorio, las migraciones SQL (aislamiento entre
  organizaciones, permisos, reglas) y la configuración documentada en [docs/deploy.md](./docs/deploy.md).
- **Fuera de alcance:** vulnerabilidades de Next.js, Supabase, Vercel o Google (reportalas a sus
  proveedores), ingeniería social, y ataques de denegación de servicio.

## Modelo de seguridad, en breve

- Aislamiento por organización y por permiso con Row Level Security en la base de datos; la interfaz solo
  esconde lo que el rol no puede usar.
- Sin registro público: los usuarios los crean los administradores.
- La clave de servicio de Supabase vive solo en el servidor (`server-only`) y nunca en el navegador.
- Todos los mails salen por un SMTP propio; los links se arman con `SITE_URL`, no con el encabezado `Host`.
- Logo de la organización en un bucket privado, sin SVG.

El detalle, los controles y los **límites conocidos** están en [docs/seguridad.md](./docs/seguridad.md).

## Notas sobre datos de demostración

El archivo `supabase/seeds/demo_catedra.sql` crea cuentas de demostración con una contraseña compartida y
pública, pensadas para la cátedra. Solo dan acceso a la organización de demostración. Si encontrás que
permiten acceder a algo más, es un hallazgo válido.
