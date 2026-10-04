# 0001. Mutaciones del CRUD desde el cliente, no con Server Actions

- **Estado:** Aceptada
- **Fecha:** 2026-09-17 (desde el esqueleto inicial; sigue vigente)

## Contexto

La interfaz edita en paneles laterales (`Drawer`) sin navegar a otra página. La primera implementación
usaba Server Actions y `router.refresh()` para repintar la lista. En este proyecto, `router.refresh()`
después de una Server Action no siempre volvía a pintar la lista con los datos nuevos: a veces quedaba
mostrando el estado viejo hasta recargar a mano.

Había además otra restricción: la autorización ya no dependía de la capa de aplicación, sino de la
RLS de la base (ver [0002](./0002-multitenencia-con-rls-y-fks-compuestas.md)).

## Decisión

- El CRUD de empresas, contactos, oportunidades, productos, ventas y bitácora se escribe desde Client
  Components con el cliente de Supabase del navegador (`src/lib/supabase/client.ts`).
- Cada escritura pide la fila guardada (`.select().single()`) y la mezcla a mano en el estado local de React,
  así la pantalla se actualiza al instante sin depender del refresco del router.
- Las **Server Actions** se reservan para lo que no puede ir desde el navegador: escribir cookies de sesión
  (login), usar la clave de servicio (usuarios, clientes, cuentas) y enviar mails con credenciales SMTP
  (alertas). Cada una verifica sesión y permiso antes de actuar.
- Las lecturas de cada pantalla se hacen en Server Components con el cliente de servidor.

## Consecuencias

- La interfaz responde al instante. Los cambios de etapa son optimistas: la tarjeta se mueve y vuelve atrás
  con un aviso si la escritura falla (`OportunidadesView.tsx`).
- **La protección no puede estar en el código de la pantalla.** Como el navegador escribe directo a la base,
  todo control tiene que vivir en la RLS y en los triggers. Esta decisión empuja a
  [0004](./0004-reglas-de-negocio-en-triggers.md).
- Los errores de la base llegan al navegador sin traducir; hoy las pantallas muestran mensajes genéricos
  ("No se pudo guardar la oportunidad") aunque la causa sea una regla concreta (por ejemplo, perdida sin
  motivo). Mejorar esos mensajes es parte de F2.
- No hay un punto de servidor donde loguear o validar cada alta. La validación de datos recae en las
  restricciones de la base y en los formularios.
- `CLAUDE.md` decía que el único Server Action era el login; hoy hay seis archivos de acciones. La regla
  vigente es la de arriba, no esa frase.

## Alternativas descartadas

Server Actions con `revalidatePath` y `router.refresh()`: descartada por el problema de repintado descrito
en el contexto.

## Actualización (F3)

La decisión sigue en pie: las escrituras del CRUD salen del navegador. Lo que cambió es cómo se ve el
resultado. Las listas ya no copian sus filas a un estado local de React: son del servidor (paginadas, con
la URL como estado) y, después de escribir, llaman a `router.refresh()` para volver a pedir la página. El
problema de repintado de esta decisión venía de listas que copiaban sus props a un `useState` y no veían las
props nuevas; sin esa copia, el refresco anda (verificado en el navegador al dar de alta, editar y dar de baja
empresas y contactos, y al cerrar y reabrir oportunidades). El movimiento optimista de las tarjetas del
tablero se conserva. Ver [arquitectura §2.1](../arquitectura.md#21-listas-paginadas-en-el-servidor-la-url-es-el-estado-f3).
