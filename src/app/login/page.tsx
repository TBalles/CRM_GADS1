import { GoalMark } from "@/components/Logo";
import { MarcasCancha } from "@/components/Cancha";
import { APP_NAME } from "@/lib/brand";
import LoginForm from "./LoginForm";

/**
 * Split-screen auth layout (DESIGN.md §12.1). The kit's branding panel uses a
 * hero photo; there's no image asset in this repo, so the panel is the pitch
 * surface (`.cesped`) with its markings drawn in SVG — same composition, no
 * asset to ship or load. The same surface dresses the CRM's sidebar, so the
 * login is the first screen of the product and not a separate page.
 */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; aviso?: string; email?: string }>;
}) {
  const { error, aviso, email } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background animate-in fade-in duration-500 md:flex-row">
      {/* ── Branding panel (desktop only) ───────────────────────────── */}
      <div className="cesped relative hidden w-1/2 flex-col justify-between overflow-hidden md:flex lg:w-3/5">
        <MarcasCancha className="text-white/[0.07]" />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
              <GoalMark className="h-6 w-6" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight">{APP_NAME}</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-white/50">
                Equipamiento deportivo
              </span>
            </span>
          </div>

          <div>
            <h1 className="mb-6 font-display text-4xl leading-[1.04] tracking-tight drop-shadow-lg lg:text-6xl">
              Cada cancha
              <br />
              es una oportunidad.
            </h1>
            <p className="max-w-md border-l-2 border-white/30 pl-4 text-lg text-white/70">
              Clubes, complejos y escuelas de fútbol: seguí tus empresas, contactos y el embudo
              comercial completo en un solo lugar.
            </p>
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-white/40">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-logo text-logo-foreground shadow-lg shadow-logo/25 md:hidden">
            <GoalMark className="h-7 w-7" />
          </span>

          <h2 className="font-display text-3xl tracking-tight">Bienvenido</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ingresá a tu cuenta para gestionar empresas, contactos y oportunidades.
          </p>

          <LoginForm error={error} aviso={aviso} emailInicial={email} />

          <p className="mt-8 text-center text-xs font-medium tracking-wide text-muted-foreground/70">
            {APP_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}
