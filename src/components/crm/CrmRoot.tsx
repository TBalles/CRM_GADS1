import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Raíz de CRM 2.0: el wrapper `[data-crm]` y el contenedor de portales. Lo usan SOLO `(app)/layout.tsx` y
 * `admin/layout.tsx` (junto con `(app)/crm.css`): la landing nunca lo importa, así que nunca descarga estas fuentes.
 * Contrato: design-system/crm-2/README.md.
 *
 * - `[data-crm]` es `display: contents` (ver crm.css): no genera caja, no cambia layout, scroll ni impresión.
 * - Las fuentes IBM Plex quedan expuestas como variables CSS en el wrapper (`--font-crm-sans`, `--font-crm-mono`).
 *   Desde la Etapa 2 el chrome del shell (rail, topbar, capas) usa Plex Sans en toda pantalla del CRM: Sans va con
 *   `preload: true` (next/font precarga UN archivo, el de 400; el shell garantiza texto en 400 en todo ancho con el link
 *   "Saltar al contenido"). Mono queda con `preload: false`: el chrome solo la usa en el atajo "Ctrl K", que en mobile
 *   no se dibuja, y precargarla daría "preloaded but not used" ahí (se descarga al usarse, con `swap`).
 * - `#crm-portal` está DENTRO del wrapper para que lo portalizado herede los tokens `--crm-*`.
 */
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-crm-sans",
  display: "swap",
  preload: true,
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-crm-mono",
  display: "swap",
  preload: false,
});

export default function CrmRoot({ children }: { children: React.ReactNode }) {
  return (
    <div data-crm className={`${plexSans.variable} ${plexMono.variable}`}>
      {children}
      <div id="crm-portal" />
    </div>
  );
}
