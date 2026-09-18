import Link from "next/link";
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
import { buttonClass } from "@/components/ui/UIComponents";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/brand";
import { CARRERA, EQUIPO, UNIVERSIDAD, getContacto } from "@/lib/contacto";

/**
 * Landing publica. Es la home (`/`) y no pide sesion: el proxy la deja pasar.
 *
 * Todo el archivo es un Server Component y no tiene una sola linea de estado.
 * El menu mobile y el acordeon de preguntas usan <details>, que ya es un
 * acordeon accesible por teclado en el navegador — no hace falta JS ni
 * convertir la pagina en Client Component para eso.
 */

const NAV_LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#faq", label: "FAQ" },
] as const;

const FUNCIONALIDADES = [
  {
    icon: Boxes,
    title: "Catálogo con vida útil",
    body: "Cargá cada producto con su duración estimada. Ese dato es el que después dispara los avisos de recambio, sin que nadie tenga que acordarse.",
  },
  {
    icon: Users,
    title: "Clientes y contactos",
    body: "Clubes, complejos y escuelas con sus responsables, teléfonos y mails. Todo lo que hace falta para escribirle a la persona correcta.",
  },
  {
    icon: NotebookPen,
    title: "Bitácora por cliente",
    body: "Lo que se charló, lo que consultó, la queja que tuvo. Queda asentado con fecha y autor, así el historial no se va con quien atendió.",
  },
  {
    icon: BellRing,
    title: "Alertas de recambio",
    body: "El sistema calcula qué equipos llegaron al fin de su vida útil y arma el mensaje por mail o WhatsApp. Vos revisás y mandás.",
  },
  {
    icon: LineChart,
    title: "Embudo comercial",
    body: "De la primera consulta al cierre, con las etapas a la vista y el monto de cada oportunidad donde se puede leer de un vistazo.",
  },
  {
    icon: ShieldCheck,
    title: "Historial de compras",
    body: "Cada venta con sus productos, cantidades y fecha de entrega. Es la base de las alertas y el respaldo de cualquier reclamo.",
  },
] as const;

const PASOS = [
  {
    title: "Cargá tu catálogo",
    body: "Productos con precio, categoría y duración estimada de vida útil.",
  },
  {
    title: "Registrá tus clientes",
    body: "Clubes y complejos con sus contactos, mails y teléfonos.",
  },
  {
    title: "Seguí tus oportunidades",
    body: "El embudo comercial completo, de la consulta inicial al cierre.",
  },
  {
    title: "Asentá cada venta",
    body: "Productos entregados y la fecha real de entrega, que arranca el reloj.",
  },
  {
    title: "Contactá antes que la competencia",
    body: "Cuando un equipo cumple su vida útil, el aviso ya está armado.",
  },
] as const;

const FAQ = [
  {
    q: "¿Qué problema resuelve exactamente?",
    a: "Que el recambio de equipamiento se pierde. Un juego de redes dura dos temporadas, pero nadie se acuerda de llamar al club cuando se cumplen. Tuco & Nito calcula esa fecha sola, a partir de lo que ya vendiste, y te avisa con dos meses de anticipación.",
  },
  {
    q: "¿De dónde sale la fecha de vencimiento?",
    a: "De la fecha de entrega del producto más su vida útil en meses. La vida útil se copia del catálogo al momento de la venta y queda congelada ahí: si después cambiás el valor del catálogo, lo ya entregado sigue venciendo con el número que se le prometió a ese cliente.",
  },
  {
    q: "¿Los mails y WhatsApps se mandan solos?",
    a: "No, y es a propósito. El sistema arma el mensaje con los datos del cliente y del producto, pero el envío lo confirma una persona. Un CRM que manda solo termina escribiéndole a un cliente que ya renovó la semana pasada.",
  },
  {
    q: "¿Qué pasa si un producto no tiene vida útil cargada?",
    a: "Queda fuera del seguimiento de recambio, sin romper nada. Tiene sentido para lo que no se desgasta o no se repone: dejá el campo vacío y ese producto simplemente no genera alertas.",
  },
  {
    q: "¿Puedo ver todo lo que se habló con un cliente?",
    a: "Sí. Cada cliente tiene una bitácora donde se asientan llamadas, reuniones, consultas, quejas y observaciones, con fecha y quién lo cargó. Es un registro histórico: se agrega, no se corrige el pasado.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "La base corre sobre Postgres con Row Level Security activa en todas las tablas: sin una sesión válida, una consulta no devuelve ni una fila. El acceso es por usuario y contraseña con Supabase Auth.",
  },
] as const;

function Seccion({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 px-5 py-20 md:py-28 ${className ?? ""}`}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <span className="mb-4 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {eyebrow}
            </span>
          )}
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h2>
          {subtitle && <p className="mt-3 text-base text-muted-foreground md:text-lg">{subtitle}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  // La landing es publica, pero si ya hay sesion el boton cambia: no tiene
  // sentido mandar a login a alguien que ya esta adentro.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contacto = getContacto();
  const ctaHref = user ? "/dashboard" : "/login";
  const ctaLabel = user ? "Ir al CRM" : "Ingresar";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
              <GoalMark className="h-[19px] w-[19px]" />
            </span>
            <span className="text-base font-bold tracking-tight">{APP_NAME}</span>
          </Link>

          <nav aria-label="Secciones" className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#contacto"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Contactanos
            </a>
            <Link href={ctaHref} className={buttonClass()}>
              {ctaLabel}
            </Link>

            {/* Menu mobile: <details> es un acordeon nativo, accesible por
                teclado y sin estado de React. */}
            <details className="group relative md:hidden">
              <summary
                aria-label="Abrir menú"
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
              >
                <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
              </summary>
              <nav
                aria-label="Secciones"
                className="absolute right-0 top-11 w-52 rounded-md border bg-popover p-1 shadow-md"
              >
                {[...NAV_LINKS, { href: "#contacto", label: "Contactanos" }].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="block rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 md:pb-28 md:pt-24">
        {/* Halo de marca detrás del titular. `pointer-events-none` para que no
            se coma los clics de los botones que tiene encima. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] max-w-[130vw] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand">
            Gestión comercial para equipamiento deportivo
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            El recambio que hoy se te escapa,
            <br className="hidden sm:block" /> avisado a tiempo
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            {APP_NAME} reemplaza tus planillas por un sistema pensado para proveedores de
            equipamiento deportivo: clientes, embudo comercial, historial de ventas y alertas
            automáticas cuando un equipo cumple su vida útil.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#contacto"
              className={buttonClass({ size: "lg", className: "w-full gap-2 sm:w-auto" })}
            >
              Pedir una demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#funcionalidades"
              className={buttonClass({
                variant: "outline",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
            >
              Ver funcionalidades
            </a>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Sin instalación · Datos de demo incluidos · Proyecto académico abierto
          </p>
        </div>
      </section>

      {/* ── Funcionalidades ─────────────────────────────────────────── */}
      <Seccion
        id="funcionalidades"
        eyebrow="Funcionalidades"
        title="Todo el ciclo comercial, en un solo lugar"
        subtitle="Desde que entra la consulta hasta que hay que volver a golpear la puerta."
        className="border-t bg-secondary/30"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONALIDADES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-brand" />
              </span>
              <h3 className="text-base font-bold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </Seccion>

      {/* ── Cómo funciona ───────────────────────────────────────────── */}
      <Seccion
        id="como-funciona"
        eyebrow="Cómo funciona"
        title="De la venta al recambio, todo conectado"
        subtitle="Cinco pasos. El quinto es el que hoy no pasa."
        className="border-t"
      >
        <ol className="mx-auto max-w-2xl space-y-1">
          {PASOS.map(({ title, body }, i) => (
            <li key={title} className="flex gap-5">
              {/* La línea vertical vive en el contenedor del número, así se
                  estira sola con el alto del texto de cada paso. */}
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {i < PASOS.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="pb-8 pt-1">
                <h3 className="text-base font-bold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* ── Nosotros ────────────────────────────────────────────────── */}
      <Seccion
        id="nosotros"
        eyebrow="Nosotros"
        title="Quiénes hicimos esto"
        subtitle="Un equipo de cinco estudiantes construyendo software real, no un ejercicio de cátedra."
        className="border-t bg-secondary/30"
      >
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border bg-card p-7 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <GraduationCap className="h-5 w-5 text-brand" />
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight">{CARRERA}</h3>
                <p className="text-sm text-muted-foreground">{UNIVERSIDAD}</p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Somos cinco estudiantes de 4.º año de {CARRERA.split(" —")[0]} en la{" "}
              {UNIVERSIDAD.split(" (")[0]}. {APP_NAME} nació de una pregunta concreta: un proveedor
              de equipamiento deportivo sabe perfectamente cuánto dura una red o un juego de arcos,
              pero no tiene forma de acordarse de avisarle al club cuando se cumple el plazo. Ese
              recambio se pierde, o se lo lleva otro.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Lo armamos como un sistema de verdad: modelo de datos normalizado, seguridad a nivel
              de fila en la base, y un frente construido sobre un sistema de diseño propio. No es un
              prototipo de maqueta — es una aplicación que se puede usar.
            </p>

            <div className="mt-7 flex flex-wrap gap-2 border-t pt-6">
              {EQUIPO.map((nombre) => (
                <span
                  key={nombre}
                  className="rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
                >
                  {nombre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Seccion>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <Seccion
        id="faq"
        eyebrow="FAQ"
        title="Preguntas frecuentes"
        className="border-t"
      >
        <div className="mx-auto max-w-2xl divide-y border-y">
          {FAQ.map(({ q, a }, i) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-bold tabular-nums text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-base font-semibold tracking-tight">{q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 pl-10 pr-8 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </Seccion>

      {/* ── Contacto ────────────────────────────────────────────────── */}
      <Seccion
        id="contacto"
        eyebrow="Contacto"
        title="¿Querés verlo funcionando?"
        subtitle="Escribinos y coordinamos una demo con datos de prueba cargados."
        className="border-t bg-secondary/30"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${contacto.email}?subject=${encodeURIComponent(`Demo de ${APP_NAME}`)}`}
            className="flex items-start gap-4 rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
              <Mail className="h-5 w-5 text-brand" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-tight">Mail</span>
              <span className="block truncate text-sm text-muted-foreground">{contacto.email}</span>
            </span>
          </a>

          <a
            href={`https://wa.me/${contacto.whatsappLink}?text=${encodeURIComponent(`Hola! Me interesa ver una demo de ${APP_NAME}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
              <MessageCircle className="h-5 w-5 text-brand" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-tight">WhatsApp</span>
              <span className="block truncate text-sm text-muted-foreground">
                {contacto.telefonoVisible}
              </span>
            </span>
          </a>

          <div className="flex items-start gap-4 rounded-xl border bg-card p-6 shadow-sm sm:col-span-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
              <MapPin className="h-5 w-5 text-brand" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-tight">Dónde estamos</span>
              <span className="block text-sm text-muted-foreground">
                {contacto.direccion} — {contacto.ciudad}
              </span>
            </span>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border-2 border-brand/30 bg-card p-9 text-center shadow-sm">
          <h3 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Dejá de perseguir el recambio en una planilla
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Entrá al sistema y mirá el embudo, el historial de ventas y las alertas de vida útil con
            datos cargados.
          </p>
          <Link
            href={ctaHref}
            className={buttonClass({ size: "lg", className: "mt-7 gap-2" })}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Seccion>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t px-5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <GoalMark className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME} · {UNIVERSIDAD}
          </p>
        </div>
      </footer>
    </div>
  );
}
