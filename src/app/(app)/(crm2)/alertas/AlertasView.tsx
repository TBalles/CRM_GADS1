"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handshake, Mail, MessageCircle, Sparkles } from "lucide-react";
import { ComoUsamosIA } from "@/components/IaAviso";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { Button, IconButton, buttonClass } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { PageBar } from "@/components/crm/PageBar";
import { StatusBadge, StatusDot } from "@/components/crm/Status";
import { SegmentedControl } from "@/components/crm/Tabs";
import { useCrmToast } from "@/components/crm/Toast";
import { SearchInput, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { createClient } from "@/lib/supabase/client";
import { mensajeErrorOportunidad } from "@/lib/oportunidades";
import { sinTrabarse } from "@/lib/guardar";
import { filaTrasRefresco } from "@/components/crm/seleccion";
import { oportunidadDeRecambio } from "@/lib/recambio";
import type { Tables } from "@/lib/supabase/types";
import { enviarAlertaEmail, registrarEnvioWhatsapp } from "./actions";
import { BorradorIA, useBorradorIA } from "./BorradorIA";
import { FILTROS_ALERTAS, contarAlertas, filtrarAlertas, textoVencimiento, type FiltroAlertas } from "./logica";
import { asunto, cuerpo, cuerpoWhatsapp, desdeFila, formatFecha, linkMailto, linkWhatsapp } from "./plantillas";

type Alerta = Tables<"alertas_vida_util">;

/**
 * Lo que hace falta para crear la oportunidad de recambio. `null` = la función está apagada (el rol no puede crear
 * oportunidades, o la base todavía no tiene `oportunidades.venta_item_id`, migración 0011).
 */
export type DatosRecambio = {
  etapaId: string | null;
  origenId: string | null;
  yoId: string;
  /** Equipo -> id de la oportunidad ABIERTA que ya sale de él. */
  abiertas: Record<string, string>;
};

/**
 * Alertas de recambio (CRM 2.0, MASTER.md §10.17): PageBar con los tres contadores de siempre, toolbar (el filtro
 * Todas / Vencidas / Por vencer / Sin avisar y la búsqueda, en el cliente como siempre: la vista ya trae todas, sin
 * paginar) y una tabla densa con una fila por equipo y sus acciones a la vista. Mismas acciones, permisos, avisos y
 * nombres accesibles que la pantalla anterior; el marcador y las tarjetas se fueron.
 */
export default function AlertasView({
  alertas,
  enviaDesdeServidor,
  puedeEnviar,
  recambio,
  iaDisponible,
  avisos,
}: {
  alertas: Alerta[];
  /** Avisos de la página sobre el recambio en 1 clic (migración sin aplicar, error al leer): van bajo la barra. */
  avisos?: React.ReactNode;
  /**
   * Si hay remitente configurado, el mail sale del servidor. Si no, lo abre el cliente de correo del usuario. Se sabe
   * ACÁ, en el render, y no recién al volver del await: para entonces el navegador ya no considera la apertura
   * iniciada por el usuario y la bloquea.
   */
  enviaDesdeServidor: boolean;
  /** Sin `alertas.enviar`: se ven las alertas pero no se mandan. */
  puedeEnviar: boolean;
  recambio: DatosRecambio | null;
  /** F7: hay clave de la IA en el servidor. Sin ella no se ofrece "Redactar con IA". */
  iaDisponible: boolean;
}) {
  const router = useRouter();
  const ia = useBorradorIA();
  const conIA = iaDisponible && puedeEnviar;
  const [query, setQuery] = React.useState("");
  const [filtro, setFiltro] = React.useState<FiltroAlertas>("todas");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [creandoOportunidad, setCreandoOportunidad] = React.useState(false);
  // Oportunidades creadas desde esta pantalla: se suman a las que ya venían del servidor.
  const [creadas, setCreadas] = React.useState<Record<string, string>>({});
  const [refrescando, startTransition] = React.useTransition();
  const { showToast } = useCrmToast();

  const cuentas = contarAlertas(alertas);
  const filtradas = React.useMemo(() => filtrarAlertas(alertas, filtro, query), [alertas, filtro, query]);
  const conAcciones = puedeEnviar || Boolean(recambio);
  const columnas = conAcciones ? 5 : 4;
  const refrescar = () => startTransition(() => router.refresh());

  // Foco después de una acción de fila (MASTER §10.17). Los botones de la fila ocupada van con `aria-disabled` (no
  // `disabled`, que saca el foco al <body>); al terminar, el foco vuelve a la misma acción de la misma fila —o al link
  // "Oportunidad abierta →" que reemplaza al botón— y, si la fila salió de la lista (filtro "Sin avisar"), a la
  // siguiente que siga (`filaTrasRefresco`, como en las otras listas).
  const tabla = React.useRef<HTMLDivElement>(null);
  const focoPendiente = React.useRef<{ id: string; antes: string[]; accion: string } | null>(null);
  const anotarFoco = (id: string, accion: string) => {
    focoPendiente.current = { id, antes: filtradas.map((f) => f.venta_item_id ?? ""), accion };
  };
  React.useEffect(() => {
    const p = focoPendiente.current;
    if (!p) return;
    focoPendiente.current = null;
    const destino = filaTrasRefresco(p.antes, filtradas.map((f) => f.venta_item_id ?? ""), p.id);
    if (!destino) return;
    const fila = tabla.current?.querySelector(`tr[data-id="${CSS.escape(destino)}"]`);
    const visibles = [...(fila?.querySelectorAll<HTMLElement>("[data-accion]") ?? [])].filter((el) => el.getClientRects().length > 0);
    (visibles.find((el) => el.dataset.accion === p.accion) ?? visibles[0])?.focus();
  }, [filtradas, creadas]);

  async function handleEmail(a: Alerta) {
    if (!a.venta_item_id || pendingId) return;
    // Se prefiere el mail de la persona; el del club es el respaldo.
    const destinatario = a.contacto_email ?? a.empresa_email ?? "";
    if (!destinatario) {
      showToast("Este cliente no tiene email cargado. Agregalo desde Empresas.", "error");
      return;
    }
    const datos = desdeFila(a);
    // Se abre primero, todavía dentro del gesto del clic (ver la prop).
    if (!enviaDesdeServidor) window.open(linkMailto(destinatario, asunto(datos), cuerpo(datos)), "_self");

    setPendingId(a.venta_item_id);
    // Solo viaja el id: destinatario y texto los vuelve a derivar el servidor de la base (nota de seguridad en actions.ts).
    let res: Awaited<ReturnType<typeof enviarAlertaEmail>>;
    try {
      res = await enviarAlertaEmail({ ventaItemId: a.venta_item_id });
    } catch {
      showToast("No se pudo completar el envío. Si se abrió tu correo y mandaste el mensaje, no lo repitas.", "error");
      return;
    } finally {
      setPendingId(null);
    }
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast(res.modo === "mailto" ? "Abrimos tu cliente de correo con el mensaje listo." : `Mail enviado a ${destinatario}.`, "success");
    anotarFoco(a.venta_item_id, "mail");
    refrescar();
  }

  async function handleWhatsapp(a: Alerta) {
    if (!a.venta_item_id || pendingId) return;
    const telefono = a.contacto_telefono ?? a.empresa_telefono ?? "";
    if (!telefono) {
      showToast("Este cliente no tiene teléfono cargado. Agregalo desde Empresas.", "error");
      return;
    }
    // Se abre PRIMERO, en el mismo gesto del clic: si se espera al await, el navegador bloquea el popup.
    window.open(linkWhatsapp(telefono, cuerpoWhatsapp(desdeFila(a))), "_blank", "noopener,noreferrer");

    setPendingId(a.venta_item_id);
    let res: Awaited<ReturnType<typeof registrarEnvioWhatsapp>>;
    try {
      res = await registrarEnvioWhatsapp({ ventaItemId: a.venta_item_id });
    } catch {
      showToast("No se pudo registrar el envío. Si mandaste el mensaje, no lo repitas.", "error");
      return;
    } finally {
      setPendingId(null);
    }
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    anotarFoco(a.venta_item_id, "whatsapp");
    refrescar();
  }

  /**
   * Recambio en 1 clic: la oportunidad se crea directo, sin formulario. El aviso lleva el link para verla. Si ya hay una
   * abierta para el mismo equipo (doble clic, o creada en otra pestaña) no se duplica: se enlaza.
   */
  async function handleRecambio(a: Alerta) {
    if (!recambio || !a.venta_item_id || pendingId) return;
    // El foco irá al link "Oportunidad abierta →" que reemplaza al botón (se anota antes: `creadas` cambia adentro).
    anotarFoco(a.venta_item_id, "recambio");
    // Si una consulta TIRA (red caída), la fila no puede quedar ocupada para siempre.
    await sinTrabarse(() => crearRecambio(a, recambio), (m) => {
      focoPendiente.current = null;
      setPendingId(null);
      setCreandoOportunidad(false);
      showToast(m, "error");
    });
  }

  async function crearRecambio(a: Alerta, recambio: DatosRecambio) {
    if (!a.venta_item_id) return;
    const ventaItemId = a.venta_item_id;
    if (!recambio.etapaId) {
      focoPendiente.current = null;
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
      showToast("Ya había una oportunidad abierta para este equipo.", "info", 8000, { label: "Abrirla →", href: `/oportunidades/${previaId}` });
    };
    const buscarAbierta = async () =>
      (await supabase.from("oportunidades").select("id").eq("venta_item_id", ventaItemId).eq("estado", "abierta").limit(1).maybeSingle()).data;

    // Camino amable: si ya hay una abierta (otra pestaña, doble clic) se enlaza. La garantía real es el índice único de la 0011.
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
      focoPendiente.current = null;
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
      focoPendiente.current = null;
      showToast(mensajeErrorOportunidad(error, "No se pudo crear la oportunidad de recambio. Intentá de nuevo."), "error");
      return;
    }
    setCreadas((prev) => ({ ...prev, [ventaItemId]: data.id }));
    showToast(`Creamos «${data.titulo}».`, "success", 8000, { label: "Ver la oportunidad →", href: `/oportunidades/${data.id}` });
  }

  const vacioReal = alertas.length === 0;

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      {conIA && <BorradorIA ia={ia} onEnviado={refrescar} />}
      {/* Lo que antes decía el overlay de carga, para lectores de pantalla (la fila ocupada queda deshabilitada). */}
      <p role="status" className="sr-only">
        {pendingId === null ? "" : creandoOportunidad ? "Creando la oportunidad…" : "Enviando…"}
      </p>
      <PageBar
        title="Alertas de recambio"
        count={`${cuentas.vencido} vencidas · ${cuentas.por_vencer} por vencer (60 días) · ${cuentas.sin_avisar} sin avisar`}
      />
      {avisos && <div className="flex flex-col gap-2 pb-2 empty:hidden">{avisos}</div>}

      {!vacioReal && (
        <Toolbar>
          <SegmentedControl
            label="Filtrar alertas"
            size="sm"
            items={FILTROS_ALERTAS}
            value={filtro}
            onValueChange={(v) => setFiltro(v as FiltroAlertas)}
          />
          <SearchInput
            label="Buscar alerta"
            placeholder="Buscar cliente o producto…"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            className="sm:ml-auto"
          />
        </Toolbar>
      )}

      {conIA && !vacioReal && (
        <div className={cn(TYPE.meta, "flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2 text-(--crm-text-2)")}>
          <p>Si querés, «Redactar con IA» arma un borrador del aviso con los datos de cada equipo. Siempre lo revisás vos antes de mandarlo.</p>
          <ComoUsamosIA />
        </div>
      )}

      {vacioReal ? (
        <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
          <EmptyState
            title="Todo el equipamiento está al día"
            description="Nada vencido ni por vencer en los próximos 60 días. Cuando un equipo se acerque al final de su vida útil, el aviso aparece acá, ya armado."
          />
        </div>
      ) : (
        <div ref={tabla} className="flex min-h-0 flex-col pb-3">
          <DataTable label="Alertas de recambio" busy={pendingId !== null || refrescando} className="min-h-0">
            <THead>
              <Th>Equipo</Th>
              <Th width={208} hideBelow="md">
                Cliente
              </Th>
              <Th width={160} hideBelow="sm">
                Vencimiento
              </Th>
              <Th width={152} hideBelow="lg">
                Aviso
              </Th>
              {conAcciones && (
                <Th hideBelow="sm" className={cn(recambio ? "w-[132px] @[70rem]:w-[244px]" : "w-[104px]")}>
                  <span className="sr-only">Acciones</span>
                </Th>
              )}
            </THead>
            <TBody>
              {filtradas.length === 0 ? (
                <TableMessage colSpan={columnas}>
                  <EmptyState compact title="Ningún recambio con ese filtro" description="Volvé a «Todas» para ver la lista completa." />
                </TableMessage>
              ) : (
                filtradas.map((a) => {
                  const abiertaId = a.venta_item_id ? (creadas[a.venta_item_id] ?? recambio?.abiertas[a.venta_item_id]) : undefined;
                  return (
                    <Fila
                      key={a.venta_item_id}
                      alerta={a}
                      acciones={(enCelda) =>
                        conAcciones && (
                          <Acciones
                            enCelda={enCelda}
                            busy={pendingId === a.venta_item_id}
                            creando={creandoOportunidad && pendingId === a.venta_item_id}
                            recambio={Boolean(recambio)}
                            abiertaId={abiertaId}
                            conIA={conIA}
                            iaOcupada={ia.estado.cargando && ia.estado.alerta?.venta_item_id !== a.venta_item_id}
                            puedeEnviar={puedeEnviar}
                            onRecambio={() => handleRecambio(a)}
                            onIA={() => {
                              // Mientras se manda un aviso (o se crea una oportunidad), no se abre otro borrador.
                              if (!pendingId) ia.abrir(a);
                            }}
                            onEmail={() => handleEmail(a)}
                            onWhatsapp={() => handleWhatsapp(a)}
                          />
                        )
                      }
                    />
                  );
                })
              )}
            </TBody>
          </DataTable>
        </div>
      )}
    </div>
  );
}

/** "Vencido hace 72 d" (badge: es lo que tiene que saltar) o "Vence en 20 d" / "Vence hoy" (punto de atención). */
function Vencimiento({ dias, vencida }: { dias: number; vencida: boolean }) {
  const texto = textoVencimiento(dias, vencida);
  return vencida ? <StatusBadge tone="danger">{texto}</StatusBadge> : <StatusDot tone="warning">{texto}</StatusDot>;
}

/**
 * Una alerta (MASTER.md §10.17). Dos líneas por columna. El reloj del recambio va en texto (sin barra): "Entregado el …
 * · vida útil … meses" bajo el equipo y el vencimiento (cuánto falta o hace cuánto venció + la fecha) en su columna. Lo
 * que el contenedor esconde se suma adelante de la línea de apoyo del equipo, que puede ocupar dos renglones (no se
 * recorta: es el dato): < 60rem el aviso, < 45rem el cliente, < 30rem el vencimiento con su fecha.
 */
function Fila({ alerta: a, acciones }: { alerta: Alerta; acciones: (enCelda: boolean) => React.ReactNode }) {
  const vencida = a.estado === "vencido";
  const dias = a.dias_restantes ?? 0;
  const cliente = [a.empresa_nombre, a.contacto_nombre].filter(Boolean).join(" · ");
  const aviso = a.ultimo_envio ? `Avisado por ${a.ultimo_canal === "email" ? "mail" : "WhatsApp"} el ${formatFecha(a.ultimo_envio.slice(0, 10))}` : null;

  return (
    <Tr data-id={a.venta_item_id ?? undefined}>
      <Td className="whitespace-normal py-1.5 align-top">
        <div className="flex min-w-0 items-center gap-2">
          <IconoEquipoSimple nombre={a.producto_nombre} className="size-4 shrink-0 text-(--crm-text-2)" />
          <Tooltip content={a.producto_nombre ?? ""} onlyWhenTruncated>
            <span className="block min-w-0 truncate font-medium">{a.producto_nombre}</span>
          </Tooltip>
          {a.cantidad != null && a.cantidad > 1 && <span className={cn(TYPE.mono, "shrink-0 text-(--crm-text-2)")}>×{a.cantidad}</span>}
        </div>
        {/* Un renglón por dato (se leen de un vistazo y ninguno se recorta). */}
        <div className={cn(TYPE.meta, "pl-6 text-(--crm-text-2) [&>span]:block")}>
          <span className="@[30rem]:hidden!">
            <StatusDot tone={vencida ? "danger" : "warning"} className={cn("align-[-1px]", vencida ? "text-(--crm-danger)" : "text-(--crm-warning)")}>
              {textoVencimiento(dias, vencida)}
            </StatusDot>
            {a.vence_el && <span className="tabular-nums"> · vence {formatFecha(a.vence_el)}</span>}
          </span>
          {cliente && <span className="@[45rem]:hidden!">{cliente}</span>}
          {aviso && <span className="@[60rem]:hidden!">{aviso}</span>}
          <span className="tabular-nums">
            Entregado el {formatFecha(a.fecha_entrega)} · vida útil {a.vida_util_meses} meses
          </span>
        </div>
        {/* En el celular las acciones van debajo, a todo el ancho (la columna de acciones se esconde). */}
        {acciones(true) && <div className="mt-1.5 pl-6 @[30rem]:hidden">{acciones(true)}</div>}
      </Td>
      <Td hideBelow="md" className="py-1.5 align-top">
        <Tooltip content={a.empresa_nombre ?? ""} onlyWhenTruncated>
          <span className="block truncate">{a.empresa_nombre}</span>
        </Tooltip>
        {a.contacto_nombre && <span className={cn(TYPE.meta, "block truncate text-(--crm-text-2)")}>{a.contacto_nombre}</span>}
      </Td>
      <Td hideBelow="sm" className="py-1.5 align-top">
        <Vencimiento dias={dias} vencida={vencida} />
        {a.vence_el && (
          <span className={cn(TYPE.meta, "block text-(--crm-text-2)")}>
            vence <time dateTime={a.vence_el} className={TYPE.mono}>{formatFecha(a.vence_el)}</time>
          </span>
        )}
      </Td>
      <Td hideBelow="lg" className="py-1.5 align-top">
        {a.ultimo_envio ? (
          <>
            <StatusDot tone="success">Por {a.ultimo_canal === "email" ? "mail" : "WhatsApp"}</StatusDot>
            <span className={cn(TYPE.meta, "block pl-3.5 text-(--crm-text-2)")}>
              el <span className={TYPE.mono}>{formatFecha(a.ultimo_envio.slice(0, 10))}</span>
            </span>
          </>
        ) : (
          <span className="text-(--crm-text-2)">Sin avisar</span>
        )}
      </Td>
      {acciones(false) && (
        <Td hideBelow="sm" className="overflow-visible px-2 py-1 align-top">
          {acciones(false)}
        </Td>
      )}
    </Tr>
  );
}

/**
 * Las acciones de una alerta, a la vista (como antes; no van en un `⋮`): "Crear oportunidad de recambio" (o el link
 * "Oportunidad abierta →"), "Redactar con IA", "Mail" y "WhatsApp". Mismos nombres accesibles; con poco ancho la primera
 * queda como ícono (su nombre no cambia) y las otras son íconos con tooltip.
 */
function Acciones({
  enCelda,
  busy,
  creando,
  recambio,
  abiertaId,
  conIA,
  iaOcupada,
  puedeEnviar,
  onRecambio,
  onIA,
  onEmail,
  onWhatsapp,
}: {
  /** Debajo del equipo (celular): alineadas a la izquierda y con el texto de la primera a la vista. */
  enCelda: boolean;
  busy: boolean;
  creando: boolean;
  recambio: boolean;
  abiertaId: string | undefined;
  conIA: boolean;
  iaOcupada: boolean;
  puedeEnviar: boolean;
  onRecambio: () => void;
  onIA: () => void;
  onEmail: () => void;
  onWhatsapp: () => void;
}) {
  // En la columna, con menos de 70rem la primera queda como ícono (su nombre accesible no cambia): así el equipo tiene
  // ancho y la fila queda en dos renglones a 1280. El tooltip aparece solo cuando el texto está escondido.
  const corto = enCelda ? "" : "@max-[70rem]:w-7 @max-[70rem]:px-0";
  const textoCorto = enCelda ? "" : "@max-[70rem]:sr-only";
  // Ocupada: `aria-disabled` y no `disabled` (que saca el foco al <body>); los handlers ya ignoran el clic.
  const ocupada = busy || undefined;
  return (
    <div className={cn("flex items-center", enCelda ? "justify-start gap-1" : "justify-end gap-0.5")}>
      {recambio &&
        (abiertaId ? (
          <Tooltip content="Oportunidad abierta →" onlyWhenLabelHidden>
            <Link
              href={`/oportunidades/${abiertaId}`}
              aria-label="Oportunidad abierta →"
              data-accion="recambio"
              className={buttonClass({ variant: "ghost", size: "sm", className: cn(!enCelda && "mr-auto", corto) })}
            >
              <Handshake aria-hidden="true" strokeWidth={1.75} />
              <span data-label className={textoCorto}>
                Oportunidad abierta →
              </span>
            </Link>
          </Tooltip>
        ) : (
          <Tooltip content="Crear oportunidad de recambio" onlyWhenLabelHidden>
            <Button
              size="sm"
              icon={Handshake}
              aria-disabled={ocupada}
              aria-busy={creando || undefined}
              data-accion="recambio"
              onClick={onRecambio}
              aria-label="Crear oportunidad de recambio"
              className={cn(!enCelda && "mr-auto", corto)}
            >
              <span data-label className={textoCorto}>
                Crear oportunidad
              </span>
            </Button>
          </Tooltip>
        ))}
      {conIA && (
        <Tooltip content="Redactar con IA">
          {/* Una sola llamada paga a la vez: mientras una alerta espera su borrador, las otras esperan. */}
          <IconButton label="Redactar con IA" icon={Sparkles} size="sm" data-accion="ia" aria-disabled={busy || iaOcupada || undefined} onClick={onIA} />
        </Tooltip>
      )}
      {puedeEnviar && (
        <>
          <Tooltip content="Mail">
            <IconButton label="Mail" icon={Mail} size="sm" data-accion="mail" aria-disabled={ocupada} onClick={onEmail} />
          </Tooltip>
          <Tooltip content="WhatsApp">
            <IconButton label="WhatsApp" icon={MessageCircle} size="sm" data-accion="whatsapp" aria-disabled={ocupada} onClick={onWhatsapp} />
          </Tooltip>
        </>
      )}
    </div>
  );
}
