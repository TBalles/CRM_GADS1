"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Handshake,
  Mail,
  MessageCircle,
  Search,
} from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Pill, buttonClass } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarcasCancha } from "@/components/Cancha";
import { IconoEquipo } from "@/components/Equipamiento";
import { RelojRecambio } from "@/components/RelojRecambio";
import { createClient } from "@/lib/supabase/client";
import { mensajeErrorOportunidad } from "@/lib/oportunidades";
import { oportunidadDeRecambio } from "@/lib/recambio";
import { useToast } from "@/components/ui/Toast";
import { OverlayCarga } from "@/components/ui/OverlayCarga";
import { cn } from "@/lib/utils";
import { enviarAlertaEmail, registrarEnvioWhatsapp } from "./actions";
import {
  asunto,
  cuerpo,
  cuerpoWhatsapp,
  desdeFila,
  formatFecha,
  linkMailto,
  linkWhatsapp,
} from "./plantillas";
import type { Tables } from "@/lib/supabase/types";

type Alerta = Tables<"alertas_vida_util">;

/**
 * Lo que hace falta para crear la oportunidad de recambio. `null` = la funcion esta apagada (el rol no puede
 * crear oportunidades, o la base todavia no tiene `oportunidades.venta_item_id`, migracion 0011).
 */
export type DatosRecambio = {
  etapaId: string | null;
  origenId: string | null;
  yoId: string;
  /** Equipo -> id de la oportunidad ABIERTA que ya sale de el. */
  abiertas: Record<string, string>;
};

type Filtro = "todas" | "vencido" | "por_vencer" | "sin_avisar";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "vencido", label: "Vencidas" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "sin_avisar", label: "Sin avisar" },
];

export default function AlertasView({
  alertas,
  enviaDesdeServidor,
  puedeEnviar,
  recambio,
}: {
  alertas: Alerta[];
  /**
   * Si hay remitente configurado, el mail sale del servidor. Si no, lo abre el
   * cliente de correo del usuario. Se sabe ACÁ, en el render, y no recién al
   * volver del await: para entonces el navegador ya no considera la apertura
   * iniciada por el usuario y la bloquea.
   */
  enviaDesdeServidor: boolean;
  /** Sin `alertas.enviar`: se ven las alertas pero no se mandan. */
  puedeEnviar: boolean;
  recambio: DatosRecambio | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creandoOportunidad, setCreandoOportunidad] = useState(false);
  // Oportunidades creadas desde esta pantalla: se suman a las que ya venian del servidor.
  const [creadas, setCreadas] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const vencidas = alertas.filter((a) => a.estado === "vencido").length;
  const porVencer = alertas.filter((a) => a.estado === "por_vencer").length;
  const sinAvisar = alertas.filter((a) => !a.ultimo_envio).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alertas.filter((a) => {
      if (filtro === "vencido" && a.estado !== "vencido") return false;
      if (filtro === "por_vencer" && a.estado !== "por_vencer") return false;
      if (filtro === "sin_avisar" && a.ultimo_envio) return false;
      if (!q) return true;
      return `${a.empresa_nombre ?? ""} ${a.producto_nombre ?? ""} ${a.contacto_nombre ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [alertas, filtro, query]);

  async function handleEmail(a: Alerta) {
    if (!a.venta_item_id || pendingId) return;
    // Se prefiere el mail de la persona; el del club es el respaldo.
    const destinatario = a.contacto_email ?? a.empresa_email ?? "";
    if (!destinatario) {
      showToast("Este cliente no tiene email cargado. Agregalo desde Empresas.", "error");
      return;
    }

    const datos = desdeFila(a);
    const asuntoTexto = asunto(datos);
    const mensaje = cuerpo(datos);

    // Se abre primero, todavía dentro del gesto del clic (ver la prop).
    if (!enviaDesdeServidor) {
      window.open(linkMailto(destinatario, asuntoTexto, mensaje), "_self");
    }

    setPendingId(a.venta_item_id);
    // Solo viaja el id: destinatario y texto los vuelve a derivar el servidor
    // de la base. Ver la nota de seguridad en actions.ts.
    const res = await enviarAlertaEmail({ ventaItemId: a.venta_item_id });
    setPendingId(null);

    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }

    showToast(
      res.modo === "mailto"
        ? "Abrimos tu cliente de correo con el mensaje listo."
        : `Mail enviado a ${destinatario}.`,
      "success",
    );

    startTransition(() => router.refresh());
  }

  async function handleWhatsapp(a: Alerta) {
    if (!a.venta_item_id || pendingId) return;
    const telefono = a.contacto_telefono ?? a.empresa_telefono ?? "";
    if (!telefono) {
      showToast("Este cliente no tiene teléfono cargado. Agregalo desde Empresas.", "error");
      return;
    }

    const datos = desdeFila(a);
    const mensaje = cuerpoWhatsapp(datos);

    // Se abre PRIMERO, en el mismo gesto del clic: si se espera al await, el
    // navegador ya no lo considera iniciado por el usuario y bloquea el popup.
    window.open(linkWhatsapp(telefono, mensaje), "_blank", "noopener,noreferrer");

    setPendingId(a.venta_item_id);
    const res = await registrarEnvioWhatsapp({ ventaItemId: a.venta_item_id });
    setPendingId(null);

    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    startTransition(() => router.refresh());
  }

  /**
   * Recambio en 1 clic: la oportunidad se crea directo, sin formulario. El aviso lleva el link para verla.
   * Si ya hay una abierta para el mismo equipo (doble clic, o creada en otra pestaña) no se duplica: se enlaza.
   */
  async function handleRecambio(a: Alerta) {
    if (!recambio || !a.venta_item_id || pendingId) return;
    const ventaItemId = a.venta_item_id;
    if (!recambio.etapaId) {
      showToast("El embudo no tiene una etapa abierta donde crear la oportunidad. Revisá Configuración.", "error");
      return;
    }

    setCreandoOportunidad(true);
    setPendingId(ventaItemId);
    const supabase = createClient();
    const yaHay = (previaId: string) => {
      setPendingId(null);
      setCreandoOportunidad(false);
      setCreadas((prev) => ({ ...prev, [ventaItemId]: previaId }));
      showToast("Ya había una oportunidad abierta para este equipo.", "info", 8000, {
        label: "Abrirla →",
        href: `/oportunidades/${previaId}`,
      });
    };
    const buscarAbierta = async () =>
      (
        await supabase
          .from("oportunidades")
          .select("id")
          .eq("venta_item_id", ventaItemId)
          .eq("estado", "abierta")
          .limit(1)
          .maybeSingle()
      ).data;

    // Camino amable: si ya hay una abierta (otra pestaña, doble clic) se enlaza. La garantia real es el indice unico de la 0011.
    const previa = await buscarAbierta();
    if (previa) return yaHay(previa.id);

    // El precio no viaja en la vista de alertas: se pide solo del equipo elegido (sin listas de ids en la URL).
    const { data: item } = await supabase.from("venta_items").select("precio_unitario").eq("id", ventaItemId).maybeSingle();
    const fila = oportunidadDeRecambio({
      alerta: a,
      precioUnitario: item?.precio_unitario,
      etapaId: recambio.etapaId,
      origenId: recambio.origenId,
      responsableId: recambio.yoId,
    });
    if (!fila) {
      setPendingId(null);
      setCreandoOportunidad(false);
      showToast("No se pudo armar la oportunidad de recambio. Recargá la página e intentá de nuevo.", "error");
      return;
    }

    const { data, error } = await supabase.from("oportunidades").insert(fila).select().single();
    if (error?.code === "23505" && /venta_item_abierta/i.test(error.message ?? "")) {
      // Otra persona la creó entre el chequeo y el insert: la base lo impidió; se enlaza la que ganó.
      const ganadora = await buscarAbierta();
      if (ganadora) return yaHay(ganadora.id);
    }
    setPendingId(null);
    setCreandoOportunidad(false);
    if (error || !data) {
      showToast(mensajeErrorOportunidad(error, "No se pudo crear la oportunidad de recambio. Intentá de nuevo."), "error");
      return;
    }
    setCreadas((prev) => ({ ...prev, [ventaItemId]: data.id }));
    showToast(`Creamos «${data.titulo}».`, "success", 8000, { label: "Ver la oportunidad →", href: `/oportunidades/${data.id}` });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <OverlayCarga visible={pendingId !== null} texto={creandoOportunidad ? "Creando la oportunidad…" : "Enviando…"} />
      <PageHeader
        titulo="Alertas de recambio"
        eyebrow="Llegá antes que nadie"
        meta={`${vencidas} vencidas · ${porVencer} por vencer · ${sinAvisar} sin avisar`}
        bajada="Equipos entregados que cumplieron, o están por cumplir, su vida útil estimada. El mensaje ya viene armado: revisalo y mandalo."
      />

      {/* EL MARCADOR. Antes eran tres KpiCards iguales, el patron que ya se
          saco del tablero. Ahora es un tablero de estadio sobre la cancha: las
          tres cifras que importan, grandes, con su color de estado. */}
      <section
        aria-label="Resumen de recambios"
        className="cesped relative isolate overflow-hidden rounded-2xl shadow-lg [--cesped-angulo:90deg]"
      >
        <MarcasCancha orientacion="horizontal" className="-z-10 text-white/[0.07]" />
        <dl className="grid grid-cols-3 divide-x divide-white/15">
          {[
            { label: "Vencidas", value: vencidas, tono: "text-red-300" },
            { label: "Por vencer (60 días)", value: porVencer, tono: "text-amber-300" },
            { label: "Sin avisar", value: sinAvisar, tono: "text-white" },
          ].map(({ label, value, tono }) => (
            <div key={label} className="flex flex-col-reverse items-center gap-2 px-2 py-5 text-center sm:py-6">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 sm:text-[11px]">
                {label}
              </dt>
              <dd className={cn("font-mono text-4xl font-bold tabular-nums leading-none sm:text-5xl", tono)}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar alertas">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              aria-pressed={filtro === f.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filtro === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente o producto…"
            aria-label="Buscar alerta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {!alertas.length ? (
        <EmptyState
          escena="al-dia"
          text="Todo el equipamiento está al día"
          hint="Nada vencido ni por vencer en los próximos 60 días. Cuando un equipo se acerque al final de su vida útil, el aviso aparece acá, ya armado."
        />
      ) : !filtered.length ? (
        <EmptyState
          escena="afuera"
          text="Ningún recambio con ese filtro"
          hint="Volvé a «Todas» para ver la lista completa."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const vencida = a.estado === "vencido";
            const busy = pendingId === a.venta_item_id;
            const dias = a.dias_restantes ?? 0;
            const abiertaId = a.venta_item_id ? (creadas[a.venta_item_id] ?? recambio?.abiertas[a.venta_item_id]) : undefined;

            return (
              <Card
                key={a.venta_item_id}
                className={cn(
                  "p-4 transition-shadow hover:shadow-md",
                  vencida && "border-destructive/30",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <IconoEquipo
                      nombre={a.producto_nombre}
                      tono={vencida ? "rojo" : "brand"}
                      className="h-10 w-10"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{a.producto_nombre}</p>
                        <Pill tono={vencida ? "rojo" : "ambar"}>
                          {dias === 0 ? "Vence hoy" : vencida ? `Vencido hace ${Math.abs(dias)} d` : `Vence en ${dias} d`}
                        </Pill>
                        {a.cantidad != null && a.cantidad > 1 && (
                          <Badge variant="outline" className="tabular-nums">
                            ×{a.cantidad}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {a.empresa_nombre}
                          {a.contacto_nombre && ` · ${a.contacto_nombre}`}
                        </span>
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Entregado el {formatFecha(a.fecha_entrega)} · vida útil{" "}
                        {a.vida_util_meses} meses · vence {formatFecha(a.vence_el)}
                      </p>

                      <RelojRecambio
                        entrega={a.fecha_entrega}
                        vence={a.vence_el}
                        dias={dias}
                        vencida={vencida}
                      />

                      {a.ultimo_envio && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Ya avisado por {a.ultimo_canal === "email" ? "mail" : "WhatsApp"} el{" "}
                          {formatFecha(a.ultimo_envio.slice(0, 10))}
                        </p>
                      )}
                    </div>
                  </div>

                  {(puedeEnviar || recambio) && (
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      {recambio &&
                        (abiertaId ? (
                          <Link
                            href={`/oportunidades/${abiertaId}`}
                            className={buttonClass({ variant: "outline", size: "sm", className: "w-full gap-1.5 sm:w-auto" })}
                          >
                            <Handshake aria-hidden="true" className="h-3.5 w-3.5" />
                            Oportunidad abierta →
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => handleRecambio(a)}
                            className="w-full gap-1.5 sm:w-auto"
                          >
                            <Handshake aria-hidden="true" className="h-3.5 w-3.5" />
                            Crear oportunidad de recambio
                          </Button>
                        ))}
                      {puedeEnviar && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleEmail(a)}
                            className="flex-1 gap-1.5 sm:flex-none"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Mail
                          </Button>
                          <Button
                            size="sm"
                            variant={recambio ? "outline" : "default"}
                            disabled={busy}
                            onClick={() => handleWhatsapp(a)}
                            className="flex-1 gap-1.5 sm:flex-none"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
