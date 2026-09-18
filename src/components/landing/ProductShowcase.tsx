import { AlertTriangle, BellRing, Check, CheckCheck, Mail, Phone } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Vitrina de producto: ventanas simuladas del CRM flotando sobre la nube de
 * particulas. Todo es HTML y CSS — nada de capturas — asi que se ve nitido en
 * cualquier pantalla, respeta el tema y no pesa.
 *
 * Los numeros son DATOS DE EJEMPLO y la seccion lo dice. En desktop las
 * ventanas se superponen en cascada; en mobile se apilan y se muestran solo
 * tres, porque seis ventanas encimadas en un telefono no se leen.
 */

function Ventana({
  titulo,
  sub,
  enVivo,
  className,
  children,
}: {
  titulo: string;
  sub?: string;
  enVivo?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Dos capas a proposito: la de afuera flota (float-*) y la de adentro aparece
  // al scrollear (reveal). Las dos son `animation`; en el mismo elemento, la
  // segunda pisaria a la primera.
  return (
    <div className={className}>
      <div className="reveal overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(165_14%_8%/0.92)] shadow-2xl shadow-black/60 backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider text-foreground/85">
          {titulo}
          {sub && <span className="font-medium normal-case tracking-normal text-muted-foreground"> · {sub}</span>}
        </p>
        {enVivo && <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
      </div>
      <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-xl tabular-nums">
        {value}
        {delta && <span className="ml-1 text-xs text-brand">{delta}</span>}
      </p>
    </div>
  );
}

const ETAPAS = [
  { nombre: "Consulta", alto: 92 },
  { nombre: "Visita", alto: 74 },
  { nombre: "Presup.", alto: 81 },
  { nombre: "Negoc.", alto: 55 },
  { nombre: "Ganada", alto: 66 },
  { nombre: "Recambio", alto: 100 },
];

const ALERTAS = [
  { producto: "Red de arco 7,32 × 2,44", cliente: "Club Atlético Ramos", estado: "Vencida hace 12 d", vencida: true },
  { producto: "Juego de conos × 40", cliente: "Complejo La Tablada", estado: "Vence en 9 d", vencida: false },
  { producto: "Pecheras × 24", cliente: "Escuela Fútbol Oeste", estado: "Vence en 31 d", vencida: false },
];

export default function ProductShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-4 lg:h-[660px] lg:space-y-0">
      {/* ── Embudo ───────────────────────────────────────────────── */}
      <Ventana
        titulo="Embudo"
        sub="en vivo"
        className="float-a hidden lg:absolute lg:left-0 lg:top-14 lg:block lg:w-[37%]"
      >
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Oportunidades" value="38" delta="↑" />
          <Kpi label="En juego" value="$ 12,4 M" />
        </div>
        <div className="mt-5 flex h-36 items-end gap-2">
          {ETAPAS.map((e, i) => (
            // La columna ocupa todo el alto (h-full) y el tramo de la barra es
            // flex-1: asi el `height: X%` de la barra tiene contra que
            // resolverse. Sin un alto definido arriba, el porcentaje daba 0.
            <div key={e.nombre} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="bar-grow w-full rounded-t-md bg-gradient-to-t from-brand/25 to-brand"
                  style={{ height: `${e.alto}%`, animationDelay: `${i * 70}ms` }}
                />
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                {e.nombre}
              </span>
            </div>
          ))}
        </div>
      </Ventana>

      {/* ── Ventas ───────────────────────────────────────────────── */}
      <Ventana
        titulo="Ventas"
        sub="historial"
        enVivo
        className="float-b lg:absolute lg:left-[32%] lg:top-0 lg:z-10 lg:w-[40%]"
      >
        <div className="flex flex-wrap gap-1.5">
          {["Redes +24%", "Arcos +11%", "Conos +8%"].map((c) => (
            <span
              key={c}
              className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand"
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Kpi label="Facturado este mes" value="$ 8,9 M" />
          <Kpi label="Equipos entregados" value="214" />
        </div>
        <svg viewBox="0 0 300 110" className="mt-3 h-32 w-full" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tn-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 92 L40 80 L80 84 L120 60 L160 66 L200 40 L240 48 L300 18 L300 110 L0 110 Z"
            fill="url(#tn-area)"
          />
          <path
            className="line-draw"
            d="M0 92 L40 80 L80 84 L120 60 L160 66 L200 40 L240 48 L300 18"
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
      </Ventana>

      {/* ── WhatsApp: la alerta saliendo ─────────────────────────── */}
      <Ventana
        titulo="WhatsApp"
        sub="alerta de recambio"
        className="float-c lg:absolute lg:right-[3%] lg:top-8 lg:z-20 lg:w-[25%]"
      >
        <div className="space-y-2.5 lg:min-h-[330px]">
          <p className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hoy
          </p>
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-brand/90 px-3 py-2 text-[11px] leading-snug text-brand-foreground">
            Hola Juan! Te escribimos de {APP_NAME}. Las 2 redes que entregamos el 15/03/2024
            superaron su vida útil estimada. ¿Coordinamos una revisión?
            <span className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-70">
              10:24 <CheckCheck className="h-3 w-3" />
            </span>
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-[11px] leading-snug">
            ¡Justo! Pasame presupuesto para las dos canchas 🙌
            <span className="mt-1 block text-right text-[9px] text-muted-foreground">10:31</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1" aria-hidden="true">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        </div>
      </Ventana>

      {/* ── Alertas ──────────────────────────────────────────────── */}
      <Ventana
        titulo="Alertas"
        sub="recambio"
        enVivo
        className="float-d lg:absolute lg:left-[5%] lg:top-[340px] lg:z-20 lg:w-[38%]"
      >
        <ul className="space-y-2">
          {ALERTAS.map((a) => (
            <li
              key={a.producto}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  a.vencida ? "bg-destructive/15 text-destructive" : "bg-brand/10 text-brand",
                )}
              >
                {a.vencida ? <AlertTriangle className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold">{a.producto}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {a.cliente} · {a.estado}
                </span>
              </span>
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10">
                  <Mail className="h-3 w-3" />
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-brand-foreground">
                  <Phone className="h-3 w-3" />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Ventana>

      {/* ── Bitácora ─────────────────────────────────────────────── */}
      <Ventana
        titulo="Bitácora"
        sub="Club Atlético Ramos"
        className="float-e hidden lg:absolute lg:left-[45%] lg:top-[400px] lg:z-30 lg:block lg:w-[34%]"
      >
        <ul className="space-y-3">
          {[
            { t: "Consultó por recambio de redes", d: "Llamada · hace 2 h", ok: true },
            { t: "Reclamo: una red llegó con un corte", d: "Queja · hace 3 d", ok: false },
            { t: "Visita a las dos canchas de 7", d: "Reunión · hace 1 sem", ok: true },
          ].map((e) => (
            <li key={e.t} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  e.ok ? "bg-brand/15 text-brand" : "bg-destructive/15 text-destructive",
                )}
              >
                {e.ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">{e.t}</span>
                <span className="block text-[10px] text-muted-foreground">{e.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </Ventana>

      {/* ── Métrica ──────────────────────────────────────────────── */}
      <Ventana
        titulo="Recambios"
        className="float-f hidden lg:absolute lg:right-0 lg:top-[430px] lg:z-10 lg:block lg:w-[16%]"
      >
        <div className="flex flex-col items-center py-2">
          <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r="32" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="8" />
            <circle
              className="ring-draw"
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="87 100"
            />
          </svg>
          <p className="mt-2 font-display text-3xl tabular-nums">87%</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            avisados a tiempo
          </p>
        </div>
      </Ventana>
    </div>
  );
}
