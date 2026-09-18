import { GoalMark } from "@/components/Logo";
import { APP_NAME } from "@/lib/brand";
import LoginForm from "./LoginForm";

/**
 * Split-screen auth layout (DESIGN.md §12.1). The kit's branding panel uses a
 * hero photo; there's no image asset in this repo, so the panel is a brand
 * gradient with the markings of a pitch drawn in SVG — same composition, no
 * asset to ship or load.
 */
function PitchMarkings() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full text-white/[0.07]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {/* touchlines */}
      <rect x="24" y="24" width="352" height="552" />
      {/* halfway line + centre circle */}
      <line x1="24" y1="300" x2="376" y2="300" />
      <circle cx="200" cy="300" r="62" />
      <circle cx="200" cy="300" r="3" fill="currentColor" />
      {/* penalty areas */}
      <rect x="94" y="24" width="212" height="96" />
      <rect x="146" y="24" width="108" height="42" />
      <rect x="94" y="480" width="212" height="96" />
      <rect x="146" y="534" width="108" height="42" />
      {/* penalty arcs */}
      <path d="M150 120a52 52 0 0 0 100 0" />
      <path d="M150 480a52 52 0 0 1 100 0" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; aviso?: string; email?: string }>;
}) {
  const { error, aviso, email } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background animate-in fade-in duration-500 md:flex-row">
      {/* ── Branding panel (desktop only) ───────────────────────────── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden text-white md:flex lg:w-3/5">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(145deg,hsl(160_78%_18%),hsl(168_60%_10%)_55%,hsl(172_40%_6%))]" />
        <PitchMarkings />
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
            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight drop-shadow-lg lg:text-6xl">
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

          <h2 className="text-3xl font-bold tracking-tight">Bienvenido</h2>
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
