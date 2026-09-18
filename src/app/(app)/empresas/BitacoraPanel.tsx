"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  HelpCircle,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormBanner } from "@/components/form";
import { Badge, Button } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";

type Bitacora = Tables<"bitacora_entradas">;
type Contacto = Tables<"contactos">;

/**
 * Los tipos viven en un CHECK de la base. Esta lista tiene que coincidir con
 * ese CHECK: si se agrega uno acá y no allá, el insert falla con un error de
 * restricción que el usuario no puede interpretar.
 */
const TIPOS = [
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "reunion", label: "Reunión", icon: Users },
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "consulta", label: "Consulta", icon: HelpCircle },
  { value: "queja", label: "Queja", icon: AlertTriangle },
  { value: "nota", label: "Nota", icon: NotebookPen },
] as const;

const TIPO_POR_VALUE = new Map(TIPOS.map((t) => [t.value, t]));

function formatMomento(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Un `datetime-local` necesita `aaaa-mm-ddThh:mm` EN HORA LOCAL, no en UTC. */
function ahoraLocal() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function BitacoraPanel({
  empresaId,
  entradas,
  contactos,
  puedeEscribir,
  onCreada,
}: {
  empresaId: string;
  entradas: Bitacora[];
  contactos: Contacto[];
  /** Sin `bitacora.escribir`: se lee pero no se agregan entradas. */
  puedeEscribir: boolean;
  onCreada: (entrada: Bitacora) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [tipo, setTipo] = useState("llamada");
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [ocurridoEn, setOcurridoEn] = useState(ahoraLocal);
  const [tituloError, setTituloError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const contactoPorId = useMemo(() => new Map(contactos.map((c) => [c.id, c])), [contactos]);

  // Más reciente arriba: una bitácora se lee por lo último que pasó.
  const ordenadas = useMemo(
    () =>
      [...entradas].sort(
        (a, b) => new Date(b.ocurrido_en).getTime() - new Date(a.ocurrido_en).getTime(),
      ),
    [entradas],
  );

  function resetForm() {
    setTipo("llamada");
    setTitulo("");
    setDetalle("");
    setContactoId("");
    setOcurridoEn(ahoraLocal());
    setTituloError(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setTituloError("Escribí de qué se trató.");
      return;
    }

    setTituloError(null);
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: dbError } = await supabase
      .from("bitacora_entradas")
      .insert({
        empresa_id: empresaId,
        contacto_id: contactoId || null,
        tipo,
        titulo: titulo.trim(),
        detalle: detalle.trim() || null,
        autor_id: user?.id ?? null,
        // El input entrega hora local; toISOString la manda en UTC, que es lo
        // que espera una columna timestamptz.
        ocurrido_en: new Date(ocurridoEn).toISOString(),
      })
      .select()
      .single();

    setSaving(false);

    if (dbError || !data) {
      setError("No se pudo guardar la entrada. Intentá de nuevo.");
      return;
    }

    showToast("Entrada agregada a la bitácora.", "success");
    onCreada(data);
    resetForm();
    setCreando(false);
  }

  return (
    <div className="space-y-4">
      {creando ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 p-4"
          noValidate
        >
          {error && <FormBanner message={error} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoSelect
              id="tipo"
              label="Tipo"
              required
              options={TIPOS.map((t) => ({ value: t.value, label: t.label }))}
              value={tipo}
              onChange={setTipo}
            />
            <Campo
              id="ocurrido_en"
              label="Cuándo"
              type="datetime-local"
              value={ocurridoEn}
              onChange={setOcurridoEn}
            />
          </div>

          <Campo
            id="titulo"
            label="Resumen"
            required
            autoFocus
            placeholder="Consultó por recambio de redes"
            value={titulo}
            onChange={(v) => {
              setTitulo(v);
              if (tituloError) setTituloError(null);
            }}
            error={tituloError ?? undefined}
          />

          {contactos.length > 0 && (
            <CampoSelect
              id="contacto_id"
              label="Con quién"
              placeholder="Opcional"
              options={contactos.map((c) => ({
                value: c.id,
                label: `${c.nombre} ${c.apellido ?? ""}`.trim(),
              }))}
              value={contactoId}
              onChange={setContactoId}
            />
          )}

          <CampoTextarea
            id="detalle"
            label="Detalle"
            rows={4}
            placeholder="Lo que se charló, lo que quedó pendiente, observaciones…"
            value={detalle}
            onChange={setDetalle}
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                resetForm();
                setCreando(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Guardando…" : "Agregar"}
            </Button>
          </div>
        </form>
      ) : puedeEscribir ? (
        <Button onClick={() => setCreando(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Nueva entrada
        </Button>
      ) : null}

      {!ordenadas.length ? (
        <EmptyState
          compact
          icon={NotebookPen}
          text="Sin entradas todavía"
          hint="Asentá acá lo que se charló, lo que consultó o cualquier observación."
          className="py-10"
        />
      ) : (
        <ol className="space-y-2">
          {ordenadas.map((e) => {
            const meta = TIPO_POR_VALUE.get(e.tipo as (typeof TIPOS)[number]["value"]);
            const Icon = meta?.icon ?? NotebookPen;
            const conQuien = e.contacto_id ? contactoPorId.get(e.contacto_id) : null;
            const esQueja = e.tipo === "queja";

            return (
              <li
                key={e.id}
                className={cn(
                  "rounded-lg border bg-card p-3 shadow-sm",
                  esQueja && "border-destructive/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      esQueja ? "bg-destructive/10" : "bg-brand/10",
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4", esQueja ? "text-destructive" : "text-brand")}
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{e.titulo}</p>
                      <Badge variant={esQueja ? "destructive" : "secondary"}>
                        {meta?.label ?? e.tipo}
                      </Badge>
                    </div>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {formatMomento(e.ocurrido_en)}
                      </span>
                      {conQuien && (
                        <span className="truncate">
                          con {conQuien.nombre} {conQuien.apellido ?? ""}
                        </span>
                      )}
                    </p>

                    {e.detalle && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {e.detalle}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
