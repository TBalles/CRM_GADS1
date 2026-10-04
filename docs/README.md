# Documentación de Tuco & Nito

Índice de todo lo que está documentado. Si es tu primera vez, empezá por **Entender el proyecto**.

> En cada documento se distinguen tres estados: **implementado** (funciona en producción), **base lista, sin
> interfaz** (la base de datos ya lo aplica, la pantalla todavía no) y **planificado**.

## Según lo que necesitás

| Quiero... | Leé |
|---|---|
| Saber qué es el producto y cómo arrancarlo | [README](../README.md) |
| Ver todo lo que se agregó en esta versión | [notas-de-version.md](./notas-de-version.md) |
| Saber qué cumple la consigna y qué falta | [notas-de-version.md, sección e](./notas-de-version.md#e-estado-frente-a-la-consigna) |
| Entender cómo está armado | [arquitectura.md](./arquitectura.md) |
| Consultar una tabla o una columna | [modelo-de-datos.md](./modelo-de-datos.md) |
| Saber dónde se cumple una regla | [reglas-de-negocio.md](./reglas-de-negocio.md) |
| Entender la IA opcional (qué manda, costo, cómo apagarla) | [ia.md](./ia.md) |
| Desplegar o actualizar | [deploy.md](./deploy.md) |
| Verificar que todo anda | [pruebas.md](./pruebas.md) |
| Entender por qué se decidió algo | [decisiones/](./decisiones/README.md) |
| Revisar o reportar seguridad | [seguridad.md](./seguridad.md) y [SECURITY.md](../SECURITY.md) |
| Aportar código | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Ver el historial por hito | [CHANGELOG.md](../CHANGELOG.md) |

## Entender el proyecto

| Documento | Para qué sirve |
|---|---|
| [notas-de-version.md](./notas-de-version.md) | Todo lo agregado desde la primera entrega, por área: qué hace, dónde vive, la regla de negocio, cómo probarlo y el commit. Incluye el estado requisito por requisito frente a la consigna, la seguridad de la versión, el plan (F1 a F8), los commits agrupados y el catálogo de permisos |
| [ia.md](./ia.md) | La IA asistida (F7): las siete condiciones de la consigna y cómo se cumplen, qué datos salen y cuáles no, cómo está hecha, costo estimado, variables y cómo apagarla |
| [arquitectura.md](./arquitectura.md) | Diagramas de componentes, flujo de un pedido, sesión y protección de rutas, multitenencia, flujo de mails y topología de despliegue |
| [modelo-de-datos.md](./modelo-de-datos.md) | Diagrama entidad-relación y una ficha por tabla: propósito, columnas clave, claves foráneas y RLS |
| [reglas-de-negocio.md](./reglas-de-negocio.md) | Cada regla (vida útil, alertas, embudo, historial, cartera propia, baja lógica, permisos, logo) con el lugar donde se aplica |
| [decisiones/](./decisiones/README.md) | Decisiones de arquitectura (ADR): contexto, decisión, consecuencias y estado |

## Operar el proyecto

| Documento | Para qué sirve |
|---|---|
| [deploy.md](./deploy.md) | Runbook de Supabase y Vercel, orden de migraciones, seed, SMTP, variables de entorno y lista de verificación |
| [pruebas.md](./pruebas.md) | Self-checks, verificación estática, pruebas SQL (cuál va antes o después de la `0007`), pruebas E2E con Playwright, la CI y cómo leer un resultado |
| [seguridad.md](./seguridad.md) | Modelo de amenazas y controles, secretos, límites conocidos |

## Diseño

| Documento | Para qué sirve |
|---|---|
| [DESIGN.md](./DESIGN.md) | Sumar UI Kit canónico. **Copia de solo lectura: no se edita** |
| [design-overrides.md](./design-overrides.md) | Dónde esta aplicación se aparta del kit a propósito y por qué (15 divergencias) |
| [`design-system/tuco-y-nito/MASTER.md`](../design-system/tuco-y-nito/MASTER.md) | Reglas de identidad de la marca: color, tipografía, estructura, voz, motivos |

## Fuera de esta carpeta

| Archivo | Contenido |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Contexto del proyecto para sesiones de IA y para quien se suma: estructura, convenciones, comandos |
| [`supabase/migrations/`](../supabase/migrations) | Las siete migraciones SQL, en orden |
| [`supabase/tests/`](../supabase/tests) | Pruebas SQL con rollback |
| [`supabase/seeds/demo_catedra.sql`](../supabase/seeds/demo_catedra.sql) | Datos de demostración y cuentas por rol |
| `.github/` | Plantillas de pull request y de issues |
| `Guia-demostracion-Tuco-y-Nito.pdf` | PDF en la raíz que, por su nombre, es una guía de demostración. No se revisó su contenido y al escribir este índice no estaba versionado en git |

Los tres documentos del curso (`Entregas-CRM.pdf`, `Consigna_Trabajo_Practico.pdf`, `Modulos_Principales.pdf`)
no están en el repositorio.

## Mantener la documentación al día

Cuando cambia el comportamiento, el esquema, los permisos o el despliegue, la documentación se actualiza en el
mismo cambio. La tabla de qué actualizar está en [CONTRIBUTING](../CONTRIBUTING.md#8-documentación).
