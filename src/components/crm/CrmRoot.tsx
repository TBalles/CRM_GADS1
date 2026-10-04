import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Raíz de CRM 2.0: el wrapper `[data-crm]` y el contenedor de portales. Lo usan SOLO `(app)/layout.tsx` y
 * `admin/layout.tsx` (junto con `(app)/crm.css`): la landing nunca lo importa, así que nunca descarga estas fuentes.
 * Contrato: design-system/crm-2/README.md.
 *
 * - `[data-crm]` es `display: contents` (ver crm.css): no genera caja, no cambia layout, scroll ni impresión.
 * - Las fuentes IBM Plex quedan expuestas como variables CSS en el wrapper (`--font-crm-sans`, `--font-crm-mono`)
 *   y NO se aplican a nada todavía. `preload: false`: sin uso, que no se descarguen; pasar a `true` cuando se apliquen.
 * - `#crm-portal` está DENTRO del wrapper para que lo portalizado herede los tokens `--crm-*`.
 */
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-crm-sans",
  display: "swap",
  preload: false,
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
