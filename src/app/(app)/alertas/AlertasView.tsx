"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  Mail,
  MessageCircle,
  Package,
  Search,
} from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { useToast } from "@/components/ui/Toast";
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
}: {
  alertas: Alerta[];
  /**
   * Si hay remitente configurado, el mail sale del servidor. Si no, lo abre el
   * cliente de correo del usuario. Se sabe ACÁ, en el render, y no recién al
   * volver del await: para entonces el navegador ya no considera la apertura
   * iniciada por el usuario y la bloquea.
   */
  enviaDesdeServidor: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold tracking-tight">Alertas de recambio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equipos entregados que cumplieron, o están por cumplir, su vida útil estimada. El mensaje
          ya viene armado: revisalo y mandalo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={CalendarClock} label="Vencidas" value={String(vencidas)} />
        <KpiCard icon={BellRing} label="Por vencer (60 días)" value={String(porVencer)} />
        <KpiCard icon={CheckCircle2} label="Sin avisar" value={String(sinAvisar)} />
      </div>

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
          icon={CheckCircle2}
          text="No hay recambios pendientes"
          hint="Cuando un equipo entregado se acerque al final de su vida útil, va a aparecer acá con el mensaje listo para enviar."
        />
      ) : !filtered.length ? (
        <EmptyState icon={Search} text="Sin alertas con ese filtro" hint="Probá con otro criterio." />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const vencida = a.estado === "vencido";
            const busy = pendingId === a.venta_item_id;
            const dias = a.dias_restantes ?? 0;

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
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        vencida ? "bg-destructive/10" : "bg-brand/10",
                      )}
                    >
                      <Package
                        className={cn("h-5 w-5", vencida ? "text-destructive" : "text-brand")}
                      />
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{a.producto_nombre}</p>
                        <Badge variant={vencida ? "destructive" : "secondary"}>
                          {vencida
                            ? `Vencido hace ${Math.abs(dias)} d`
                            : `Vence en ${dias} d`}
                        </Badge>
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

                      {a.ultimo_envio && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Ya avisado por {a.ultimo_canal === "email" ? "mail" : "WhatsApp"} el{" "}
                          {formatFecha(a.ultimo_envio.slice(0, 10))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
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
                      disabled={busy}
                      onClick={() => handleWhatsapp(a)}
                      className="flex-1 gap-1.5 sm:flex-none"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
