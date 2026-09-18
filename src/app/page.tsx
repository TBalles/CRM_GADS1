import Link from "next/link";
import { Varela_Round } from "next/font/google";
import {
  ArrowRight,
  BellRing,
  Boxes,
  ChevronDown,
  GraduationCap,
  LineChart,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  ShieldCheck,
  Users,
} from "lucide-react";
import { GoalMark } from "@/components/Logo";
import ParticleField from "@/components/landing/ParticleField";
import BallCursor from "@/components/landing/BallCursor";
import ProductShowcase from "@/components/landing/ProductShowcase";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { CARRERA, EQUIPO, UNIVERSIDAD, getContacto } from "@/lib/contacto";

/**
 * Landing publica. Es la home (`/`) y no pide sesion: el proxy la deja pasar.
 *
 * Siempre oscura, independiente del tema que el usuario eligio para el CRM
 * (la raiz lleva `dark landing-root`, ver globals.css). El archivo es un
 * Server Component: lo interactivo vive en tres hojas cliente —
 * ParticleField, BallCursor — y todo lo demas es HTML con animaciones CSS
 * atadas al scroll, que sin soporte degradan a contenido quieto y visible.
 */

// Tipografia de display, solo para la landing. El CRM sigue en Inter.
const varela = Varela_Round({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-varela",
  display: "swap",
});

const NAV_LINKS = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#faq", label: "FAQ" },
] as const;

const EQUIPAMIENTO = [
  "Arcos de fútbol 11",
  "Redes",
  "Conos",
  "Pecheras",
  "Pelotas",
  "Banderines de córner",
  "Vallas de salto",
  "Escaleras de coordinación",
  "Bancos de suplentes",
  "Mallas perimetrales",
] as const;

const FUNCIONALIDADES = [
  {
    icon: BellRing,
    tag: "Automático",
    title: "Alertas de recambio",
    body: "Calcula qué equipos cumplieron su vida útil y arma el mensaje por mail o WhatsApp. Vos revisás y mandás.",
  },
  {
    icon: Boxes,
    tag: "La base",
    title: "Catálogo con vida útil",
    body: "Cada producto con su duración estimada. Ese número es el que después dispara los avisos, sin que nadie se acuerde.",
  },
  {
    icon: ShieldCheck,
    tag: "Respaldo",
    title: "Historial de ventas",
    body: "Qué se entregó, a quién, cuánto y cuándo. La base de las alertas y el respaldo de cualquier reclamo.",
  },
  {
    icon: Users,
    tag: "Contacto",
    title: "Clientes y responsables",
    body: "Clubes, complejos y escuelas con su gente, sus mails y teléfonos: a quién escribirle, siempre a mano.",
  },
  {
    icon: NotebookPen,
    tag: "Memoria",
    title: "Bitácora por cliente",
    body: "Lo que se charló, lo que consultó, la queja que tuvo. Con fecha y autor, así el historial no se va con quien atendió.",
  },
  {
    icon: LineChart,
    tag: "Ventas",
    title: "Embudo comercial",
    body: "De la primera consulta al cierre, con cada etapa a la vista y el monto en juego leíble de un vistazo.",
  },
] as const;

const PASOS = [
  {
    title: "Cargá tu catálogo",
    body: "Productos con precio, categoría y la duración estimada de cada uno.",
    tag: "El punto de partida",
  },
  {
    title: "Registrá tus clientes",
    body: "Clubes y complejos con sus contactos, mails y teléfonos.",
    tag: "A quién le vendés",
  },
  {
    title: "Seguí tus oportunidades",
    body: "El embudo completo, de la consulta inicial al cierre.",
    tag: "El embudo",
  },
  {
    title: "Asentá cada venta",
    body: "Qué entregaste y cuándo. La fecha de entrega arranca el reloj.",
    tag: "Arranca el reloj",
  },
  {
    title: "Llegá antes que nadie",
    body: "Cuando un equipo cumple su vida útil, el aviso ya está armado.",
    tag: "El recambio",
  },
] as const;

const FAQ = [
  {
    q: "¿Qué problema resuelve exactamente?",
    a: `Que el recambio de equipamiento se pierde. Un juego de redes dura dos temporadas, pero nadie se acuerda de llamar al club cuando se cumplen. ${APP_NAME} calcula esa fecha sola, a partir de lo que ya vendiste, y te avisa con dos meses de anticipación.`,
  },
  {
    q: "¿De dónde sale la fecha de vencimiento?",
    a: "De la fecha de entrega más la vida útil en meses. La vida útil se copia del catálogo al momento de la venta y queda congelada: si después cambiás el catálogo, lo ya entregado sigue venciendo con lo que se le prometió a ese cliente.",
  },
  {
    q: "¿Los mails y WhatsApps se mandan solos?",
    a: "No, y es a propósito. El sistema arma el mensaje con los datos del cliente y del producto, pero el envío lo confirma una persona. Un CRM que manda solo termina escribiéndole a un cliente que ya renovó la semana pasada.",
  },
  {
    q: "¿Qué pasa si un producto no tiene vida útil cargada?",
    a: "Queda fuera del seguimiento de recambio, sin romper nada. Para lo que no se desgasta o no se repone, dejá el campo vacío y ese producto no genera alertas.",
  },
  {
    q: "¿Puedo ver todo lo que se habló con un cliente?",
    a: "Sí. Cada cliente tiene una bitácora con llamadas, reuniones, consultas, quejas y observaciones, con fecha y quién lo cargó. Es un registro histórico: se agrega, no se corrige el pasado.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "La base corre sobre Postgres con Row Level Security en todas las tablas: sin una sesión válida, una consulta no devuelve ni una fila. El acceso es con usuario y contraseña.",
  },
] as const;

/* ── Piezas chicas ─────────────────────────────────────────────────── */

/** "Tuco & Nito" con el "&" en verde, sin repetir el nombre a mano. */
function Wordmark() {
  const [antes, despues] = APP_NAME.split("&");
  if (despues === undefined) return <>{APP_NAME}</>;
  return (
    <>
      {antes}
      <span className="text-brand">&amp;</span>
      {despues}
    </>
  );
}

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-brand",
        center && "justify-center",
      )}
    >
      <span className="h-px w-8 bg-brand" aria-hidden="true" />
      {children}
    </p>
  );
}

function Acento({ children }: { children: React.ReactNode }) {
  return <span className="text-glow text-brand">{children}</span>;
}

function Chispa({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("twinkle pointer-events-none absolute text-brand", className)}>
      ✦
    </span>
  );
}

const pillPrimario =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-bold text-brand-foreground shadow-[0_0_32px_-6px_hsl(var(--glow)/0.7)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_0_44px_-4px_hsl(var(--glow)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const pillSecundario =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-7 text-sm font-bold transition-colors hover:border-brand/60 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const linkNav =
  "rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function LandingPage() {
  // Publica, pero si ya hay sesion el boton cambia: no tiene sentido mandar a
  // login a alguien que ya esta adentro.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contacto = getContacto();
  const ctaHref = user ? "/dashboard" : "/login";
  const ctaLabel = user ? "Ir al CRM" : "Ingresar";

  return (
    <div
      className={cn(
        varela.variable,
        "dark landing-root relative isolate min-h-dvh overflow-x-clip bg-background text-foreground",
      )}
    >
      {/* Cielo fijo detrás de toda la página. */}
      <ParticleField mode="stars" className="fixed inset-0 -z-10 h-dvh w-full" />
      <BallCursor />

      {/* ── Header ──────────────────────────────────────────────────── */}
      {/* `fixed` y no `sticky`: el body tiene overflow-x: hidden (globals.css),
          y eso lo vuelve contenedor de scroll y apaga el sticky sin avisar. */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/30">
              <GoalMark className="h-5 w-5" />
            </span>
            <span className="font-display text-lg tracking-tight">
              <Wordmark />
            </span>
          </Link>

          <nav aria-label="Secciones" className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className={linkNav}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <a href="#contacto" className={cn(linkNav, "hidden sm:block")}>
              Contacto
            </a>
            <Link href={ctaHref} className={cn(pillPrimario, "h-10 px-5")}>
              {ctaLabel}
            </Link>

            {/* Menú mobile: <details> nativo, sin estado de React. */}
            <details className="group relative lg:hidden">
              <summary
                aria-label="Abrir menú"
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden"
              >
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <nav
                aria-label="Secciones"
                className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-popover/95 p-2 shadow-2xl backdrop-blur-md"
              >
                {[...NAV_LINKS, { href: "#contacto", label: "Contacto" }].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="pt-18">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[calc(100dvh-4.5rem)] items-center overflow-hidden">
          {/* El arco armado con partículas. En mobile queda de fondo, tenue,
              detrás del texto; en desktop ocupa la mitad derecha. */}
          <ParticleField mode="logo" className="absolute inset-0 -z-10 h-full w-full opacity-35 lg:opacity-100" />
          <Chispa className="left-[8%] top-[14%] text-xl" />
          <Chispa className="bottom-[22%] left-[46%] text-sm [animation-delay:1.2s]" />
          <Chispa className="right-[10%] top-[18%] hidden text-base [animation-delay:2s] lg:block" />

          <div className="mx-auto w-full max-w-7xl px-5 py-20">
            {/* En desktop el texto no pasa de la mitad: la otra mitad es del arco. */}
            <div className="max-w-2xl lg:max-w-[52%]">
              <Eyebrow>Gestión comercial para equipamiento deportivo</Eyebrow>

              <h1 className="mt-7 font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl xl:text-[5.4rem]">
                Cada arco que vendiste tiene <Acento>fecha de recambio</Acento>.
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {APP_NAME} es el CRM para proveedores de equipamiento deportivo: clientes, embudo,
                historial de ventas y alertas que te avisan cuando un equipo cumple su vida útil —
                antes que la competencia.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href="#contacto" className={pillPrimario}>
                  <span aria-hidden="true">✦</span> Pedir una demo
                </a>
                <a href="#como-funciona" className={pillSecundario}>
                  Ver cómo funciona <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                60 días de anticipación · Mail y WhatsApp · Chau planillas
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute bottom-8 right-6 hidden flex-col items-center gap-3 md:flex"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Scroll
            </span>
            <span className="scroll-cue block h-10 w-px bg-brand" />
          </div>
        </section>

        {/* ── Cinta de equipamiento ───────────────────────────────────── */}
        <section
          aria-label="Equipamiento que se sigue"
          className="marquee relative overflow-hidden border-y border-white/[0.06] py-7 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="marquee-track flex w-max">
            {/* Dos copias: la animación corre -50% y empalma sin salto. La
                segunda es decorativa para los lectores de pantalla. */}
            {[0, 1].map((copia) => (
              <ul key={copia} aria-hidden={copia === 1} className="flex shrink-0 items-center">
                {EQUIPAMIENTO.map((item) => (
                  <li key={item} className="flex items-center">
                    <span className="px-7 font-display text-xl text-muted-foreground/75 md:text-2xl">
                      {item}
                    </span>
                    <span className="text-brand" aria-hidden="true">
                      ✦
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* ── La oportunidad ──────────────────────────────────────────── */}
        <section className="relative px-5 py-32 md:py-44">
          <Chispa className="left-[18%] top-[30%] text-2xl" />
          <Chispa className="right-[16%] bottom-[28%] text-lg [animation-delay:1.6s]" />
          <div className="reveal mx-auto max-w-4xl text-center">
            <Eyebrow center>La oportunidad</Eyebrow>
            <h2 className="mt-7 font-display text-4xl leading-[1.08] tracking-tight md:text-6xl">
              La red que se gasta es <Acento>una venta que ya ganaste</Acento>.
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Una red dura dos temporadas. Un juego de conos, una. Pero nadie anota cuándo entregó
              qué, y cuando el club necesita recambiar le compra al primero que pasa. {APP_NAME} se
              acuerda por vos.
            </p>
          </div>
        </section>

        {/* ── Qué hace ────────────────────────────────────────────────── */}
        <section id="funcionalidades" className="relative scroll-mt-20 px-5 pb-28">
          <div className="mx-auto max-w-6xl">
            <div className="reveal max-w-2xl">
              <Eyebrow>Qué hace</Eyebrow>
              <h2 className="mt-6 font-display text-4xl leading-[1.08] tracking-tight md:text-5xl">
                Todo el ciclo comercial, <Acento>en un solo lugar</Acento>.
              </h2>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FUNCIONALIDADES.map(({ icon: Icon, tag, title, body }) => (
                <article
                  key={title}
                  data-spotlight
                  className="spot-card reveal rounded-3xl border border-white/[0.07] bg-card/50 p-7 backdrop-blur-sm transition-colors hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-brand/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand">
                      {tag}
                    </span>
                  </div>
                  <h3 className="mt-7 text-lg font-bold tracking-tight">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>

            <div className="reveal relative mt-12 flex items-center justify-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
              <p className="relative rounded-full border border-white/10 bg-background px-5 py-2.5 text-center text-xs text-muted-foreground">
                <span className="font-bold text-brand">✦ Hecho para la cancha</span> — no es un CRM
                genérico adaptado
              </p>
            </div>
          </div>
        </section>

        {/* ── Producto ────────────────────────────────────────────────── */}
        <section id="producto" className="relative isolate scroll-mt-20 overflow-hidden px-5 py-28">
          <ParticleField mode="halo" className="absolute inset-0 -z-10 h-full w-full opacity-80" />
          <div className="mx-auto max-w-6xl">
            <div className="reveal max-w-3xl">
              <Eyebrow>Nuestro producto</Eyebrow>
              <h2 className="mt-6 font-display text-4xl leading-[1.08] tracking-tight md:text-6xl">
                El CRM que <Acento>te avisa antes</Acento>.
              </h2>
            </div>
            <div className="mt-16">
              <ProductShowcase />
            </div>
            <p className="mt-10 text-center text-xs text-muted-foreground/70">
              Pantallas ilustrativas con datos de ejemplo.
            </p>
          </div>
        </section>

        {/* ── Cómo funciona ───────────────────────────────────────────── */}
        <section id="como-funciona" className="steps-scope relative scroll-mt-20 overflow-hidden py-28">
          {/* Palabra gigante de fondo, solo contorno. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-40 -translate-x-1/2 select-none whitespace-nowrap font-display text-[26vw] leading-none text-transparent [-webkit-text-stroke:1px_hsl(var(--border))] lg:text-[17rem]"
          >
            recambio
          </span>

          <div className="relative mx-auto max-w-6xl px-5">
            <div className="reveal max-w-2xl">
              <Eyebrow>Cómo funciona</Eyebrow>
              <h2 className="mt-6 font-display text-4xl leading-[1.08] tracking-tight md:text-5xl">
                De la venta al recambio.
                <br />
                <Acento>Todo conectado.</Acento>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Cinco pasos. El quinto es el que hoy no pasa en ningún lado.
              </p>
            </div>
          </div>

          {/* Carrusel horizontal con snap. Enfocable, así se recorre con las
              flechas del teclado además de con el trackpad. El scroll-padding
              repite el padding: el snap alinea contra el borde del scroller e
              ignora el padding, y sin esto la primera card arrancaba pegada al
              borde en vez de alineada con el título. */}
          <div
            tabIndex={0}
            aria-label="Pasos de uso"
            className="steps-scroller relative mt-14 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-6 [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)] focus-visible:outline-none lg:scroll-px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))] lg:px-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]"
          >
            {PASOS.map(({ title, body, tag }, i) => (
              <article
                key={title}
                data-spotlight
                className={cn(
                  "spot-card flex min-h-[20rem] w-[82vw] max-w-[23rem] shrink-0 snap-start flex-col rounded-3xl border bg-card/60 p-8 backdrop-blur-sm transition-colors hover:border-brand/40 sm:w-[23rem]",
                  i === PASOS.length - 1 ? "border-brand/50" : "border-white/[0.08]",
                )}
              >
                <span className="font-display text-2xl tabular-nums text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 text-2xl font-bold tracking-tight">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
                <p className="mt-auto pt-8 text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  {tag}
                </p>
              </article>
            ))}
          </div>

          <div className="steps-progress-track mx-auto mt-6 max-w-6xl px-5">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="steps-progress h-full w-full bg-brand" />
            </div>
          </div>
        </section>

        {/* ── Nosotros ────────────────────────────────────────────────── */}
        <section id="nosotros" className="relative scroll-mt-20 px-5 py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div className="reveal">
              <Eyebrow>Nosotros</Eyebrow>
              <h2 className="mt-6 font-display text-4xl leading-[1.08] tracking-tight md:text-5xl">
                Cinco estudiantes, <Acento>un sistema de verdad</Acento>.
              </h2>
              <p className="mt-7 leading-relaxed text-muted-foreground">
                Somos estudiantes de {CARRERA.split(" —")[0]} en la {UNIVERSIDAD.split(" (")[0]}.{" "}
                {APP_NAME} nació de una pregunta concreta: un proveedor sabe perfectamente cuánto dura
                una red o un juego de arcos, pero no tiene forma de acordarse de avisarle al club
                cuando se cumple el plazo.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Lo construimos como un producto real: modelo de datos normalizado, seguridad a nivel
                de fila en la base y un frente con sistema de diseño propio. No es una maqueta.
              </p>
            </div>

            <div data-spotlight className="spot-card reveal rounded-3xl border border-white/[0.08] bg-card/60 p-8 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold">{CARRERA}</p>
                  <p className="text-sm text-muted-foreground">{UNIVERSIDAD}</p>
                </div>
              </div>

              <dl className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { k: "Integrantes", v: String(EQUIPO.length) },
                  { k: "Año", v: "4.º" },
                  { k: "Universidad", v: "UNLaM" },
                ].map(({ k, v }) => (
                  <div key={k} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
                    <dd className="font-display text-3xl text-brand">{v}</dd>
                    <dt className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {k}
                    </dt>
                  </div>
                ))}
              </dl>

              <ul className="mt-6 flex flex-wrap gap-2">
                {EQUIPO.map((nombre) => (
                  <li
                    key={nombre}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold"
                  >
                    {nombre}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section id="faq" className="relative scroll-mt-20 px-5 py-28">
          <div className="mx-auto max-w-3xl">
            <div className="reveal text-center">
              <Eyebrow center>FAQ</Eyebrow>
              <h2 className="mt-6 font-display text-4xl tracking-tight md:text-5xl">
                Preguntas frecuentes
              </h2>
            </div>

            <div className="mt-14 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {FAQ.map(({ q, a }, i) => (
                <details key={q} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-5 py-6 text-left transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-sm tabular-nums text-brand">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-base font-semibold tracking-tight md:text-lg">{q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition-colors group-open:border-brand/50 group-open:bg-brand/10">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <p className="pb-6 pl-10 pr-12 leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contacto ────────────────────────────────────────────────── */}
        <section id="contacto" className="relative scroll-mt-20 px-5 pb-28 pt-12">
          <div className="reveal relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-brand/30 bg-card/70 px-6 py-16 text-center backdrop-blur-sm md:px-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl"
            />
            <Chispa className="right-10 top-10 text-xl" />
            <div className="relative">
              <Eyebrow center>Contacto</Eyebrow>
              <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight md:text-5xl">
                Dejá de perseguir el recambio <Acento>en una planilla</Acento>.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
                Escribinos y coordinamos una demo con datos cargados, o entrá directo al sistema.
              </p>

              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={`mailto:${contacto.email}?subject=${encodeURIComponent(`Demo de ${APP_NAME}`)}`}
                  className={pillPrimario}
                >
                  <span aria-hidden="true">✦</span> Pedir una demo
                </a>
                <Link href={ctaHref} className={pillSecundario}>
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
                <a
                  href={`mailto:${contacto.email}`}
                  data-spotlight
                  className="spot-card flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-brand/40"
                >
                  <Mail className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Mail
                    </span>
                    <span className="block truncate text-sm">{contacto.email}</span>
                  </span>
                </a>
                <a
                  href={`https://wa.me/${contacto.whatsappLink}?text=${encodeURIComponent(`Hola! Me interesa ver una demo de ${APP_NAME}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-spotlight
                  className="spot-card flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-brand/40"
                >
                  <MessageCircle className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      WhatsApp
                    </span>
                    <span className="block truncate text-sm">{contacto.telefonoVisible}</span>
                  </span>
                </a>
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <MapPin className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Dónde
                    </span>
                    <span className="block truncate text-sm">{contacto.ciudad}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-5 py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand ring-1 ring-brand/30">
              <GoalMark className="h-4 w-4" />
            </span>
            <span className="font-display tracking-tight">
              <Wordmark />
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME} · {UNIVERSIDAD}
          </p>
        </div>
      </footer>
    </div>
  );
}
