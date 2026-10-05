"use client";

// El error del panel de plataforma es el mismo de CRM 2.0 (banner "No se pudieron cargar los datos." + "Reintentar"),
// dentro del marco: el rail y la topbar siguen disponibles. Antes /admin no tenía boundary (caía en el de Next).
export { default } from "../(app)/(crm2)/error";
