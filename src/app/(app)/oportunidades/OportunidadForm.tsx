"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Campo,
  CampoMoney,
  CampoSelect,
  CampoTextarea,
  CampoGrupo,
  FormActions,
  FormBanner,
} from "@/components/form";
import { CampoOrigen, CampoResponsable } from "@/components/ClienteCampos";
import { EstadoOportunidadPill, EtapaBadge, TipoOportunidadBadge } from "@/components/oportunidades";
import { FieldLabel } from "@/components/ui/UIComponents";
import { useToast } from "@/components/ui/Toast";
import { formatFecha, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { maskFromNumber, parseMoney } from "@/lib/money";
import {
  etapasAbiertas,
  mensajeErrorOportunidad,
  validarFechaEstimada,
  validarProbabilidad,
  type OpcionContacto,
  type OpcionEmpresa,
  type OpcionProducto,
} from "@/lib/oportunidades";
import type { Tables } from "@/lib/supabase/types";

type Oportunidad = Tables<"oportunidades">;
type Etapa = Pick<Tables<"etapas">, "id" | "nombre" | "tipo" | "orden" | "color">;
type Errores = Partial<Record<"titulo" | "cliente" | "etapa" | "probabilidad" | "fecha", string>>;

/**
 * Alta y edicion de una oportunidad (dentro de un Drawer).
 *
 * Estado, fecha real de cierre y motivo de perdida NO se editan aca: los fija el
 * trigger de la base cuando se cambia de etapa o se cierra (CierreModal). En el
 * alta la etapa es una de las abiertas; en la edicion la etapa se muestra pero se
 * cambia desde "Cambiar etapa", para que cada cambio deje su observacion en el
 * historial.
 */
export default function OportunidadForm({
  oportunidad,
  empresas,
  contactos,
  productos,
  etapas,
  origenes,
  perfiles,
  motivoNombre,
  puedeAsignar,
  yoId,
  onSaved,
  onCancel,
}: {
  oportunidad?: Oportunidad;
  empresas: OpcionEmpresa[];
  contactos: OpcionContacto[];
  productos: OpcionProducto[];
  etapas: Etapa[];
  origenes: OrigenOpcion[];
  perfiles: PerfilOpcion[];
  /** Nombre del motivo de perdida de una oportunidad perdida (solo lectura). */
  motivoNombre?: string | null;
  /** `oportunidades.asignar`. Sin el, el responsable es solo lectura y el alta queda a nombre de quien la crea. */
  puedeAsignar: boolean;
  yoId: string;
  onSaved: (oportunidad: Oportunidad) => void;
  onCancel: () => void;
}) {
  const abiertas = etapasAbiertas(etapas);
  const [titulo, setTitulo] = useState(oportunidad?.titulo ?? "");
  const [empresaId, setEmpresaId] = useState(oportunidad?.empresa_id ?? "");
  const [contactoId, setContactoId] = useState(oportunidad?.contacto_id ?? "");
  const [productoId, setProductoId] = useState(oportunidad?.producto_id ?? "");
  const [responsableId, setResponsableId] = useState(oportunidad?.responsable_id ?? yoId);
  const [origenId, setOrigenId] = useState(oportunidad?.origen_id ?? "");
  const [etapaId, setEtapaId] = useState(abiertas[0]?.id ?? "");
  // Money is held as the masked string and parsed at submit (golden rule #4).
  const [monto, setMonto] = useState(maskFromNumber(oportunidad?.monto));
  const [probabilidad, setProbabilidad] = useState(oportunidad?.probabilidad != null ? String(oportunidad.probabilidad) : "");
  const [fechaEstimada, setFechaEstimada] = useState(oportunidad?.fecha_estimada_cierre ?? "");
  const [notas, setNotas] = useState(oportunidad?.notas ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  // Un cliente dado de baja (inactivo) no se ofrece, salvo que ya sea el de esta oportunidad.
  const empresasVisibles = empresas.filter((e) => e.estado !== "inactivo" || e.id === oportunidad?.empresa_id);
  // La empresa o el contacto de la oportunidad pueden ser de otra cartera: la RLS no los trae, pero
  // el select tiene que poder mostrarlos, o el guardado los mandaria como "Sin empresa" / "Sin contacto".
  const empresaOculta = Boolean(oportunidad?.empresa_id && !empresas.some((e) => e.id === oportunidad.empresa_id));
  const contactoOculto = Boolean(oportunidad?.contacto_id && !contactos.some((c) => c.id === oportunidad.contacto_id));
  const contactosDeBaja = (c: OpcionContacto) => c.estado === "inactivo" && c.id !== oportunidad?.contacto_id;
  // With a company chosen, only its contacts. Without one, every contact says
  // which company it belongs to.
  const contactosVisibles = (empresaId
    ? contactos.filter((c) => c.empresaId === empresaId)
    : contactos.map((c) => (c.empresa ? { ...c, label: `${c.label} · ${c.empresa}` } : c))
  ).filter((c) => !contactosDeBaja(c));

  function elegirEmpresa(id: string) {
    setEmpresaId(id);
    // The chosen contact has to belong to the new company.
    if (id && contactoId && contactos.find((c) => c.id === contactoId)?.empresaId !== id) setContactoId("");
    limpiar("cliente");
  }

  function elegirContacto(id: string) {
    setContactoId(id);
    // Picking a contact first fills in its company.
    const suEmpresa = contactos.find((c) => c.id === id)?.empresaId;
    if (id && !empresaId && suEmpresa) setEmpresaId(suEmpresa);
    limpiar("cliente");
  }

  const noContactar =
    empresas.find((e) => e.id === empresaId)?.estado === "no_contactar" ||
    contactos.find((c) => c.id === contactoId)?.estado === "no_contactar";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const prob = validarProbabilidad(probabilidad);
    const nuevos: Errores = {};
    if (!titulo.trim()) nuevos.titulo = "El título es obligatorio.";
    if (!empresaId && !contactoId) nuevos.cliente = "Elegí una empresa o un contacto: toda oportunidad es de alguien.";
    if (!oportunidad && !etapaId) nuevos.etapa = "Elegí una etapa del embudo.";
    if (prob.error) nuevos.probabilidad = prob.error;
    const errFecha = validarFechaEstimada(fechaEstimada);
    if (errFecha) nuevos.fecha = errFecha;
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      titulo: titulo.trim(),
      empresa_id: empresaId || null,
      contacto_id: contactoId || null,
      producto_id: productoId || null,
      origen_id: origenId || null,
      monto: monto.trim() ? parseMoney(monto) : null,
      probabilidad: prob.valor,
      fecha_estimada_cierre: fechaEstimada || null,
      notas: notas.trim() || null,
      // Sin `oportunidades.asignar` no se manda: el alta queda a nombre de quien la crea
      // (trigger `validar_responsable`) y la edicion conserva el responsable.
      ...(puedeAsignar ? { responsable_id: responsableId || null } : {}),
    };

    const { data, error: dbError } = oportunidad
      ? await supabase.from("oportunidades").update(payload).eq("id", oportunidad.id).select().single()
      : await supabase.from("oportunidades").insert({ ...payload, etapa_id: etapaId }).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError(mensajeErrorOportunidad(dbError, "No se pudo guardar la oportunidad. Revisá los datos e intentá de nuevo."));
      return;
    }

    showToast(oportunidad ? "Oportunidad actualizada." : "Oportunidad creada.", "success");
    onSaved(data);
  }

  const etapaActual = oportunidad ? etapas.find((x) => x.id === oportunidad.etapa_id) : undefined;
  const cerrada = oportunidad != null && oportunidad.estado !== "abierta";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && <FormBanner message={error} />}

      {cerrada && (
        <p role="status" className="rounded-lg border border-border bg-secondary p-3 text-sm">
          <strong>Esta oportunidad está cerrada.</strong> Podés corregir sus datos, pero cada cambio queda registrado en la auditoría.
        </p>
      )}

      <Campo
        id="titulo"
        label="Título"
        required
        autoFocus
        placeholder="Provisión de arcos y redes"
        value={titulo}
        onChange={(v) => {
          setTitulo(v);
          limpiar("titulo");
        }}
        error={errores.titulo}
      />

      <CampoGrupo title="Estado comercial">
        {oportunidad ? (
          <div role="group" aria-labelledby="etapa-actual-label">
            <FieldLabel id="etapa-actual-label">Etapa y estado</FieldLabel>
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-input bg-secondary px-3 py-2">
              <EtapaBadge nombre={etapaActual?.nombre ?? "—"} color={etapaActual?.color} />
              <EstadoOportunidadPill estado={oportunidad.estado} />
              <TipoOportunidadBadge tipo={oportunidad.tipo} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              La etapa se cambia con «Cambiar etapa», «Marcar ganada» o «Marcar perdida»: así queda el motivo en el historial.
            </p>
          </div>
        ) : (
          <CampoSelect
            id="etapa_id"
            label="Etapa"
            required
            placeholder={abiertas.length ? "Elegí la etapa" : "No hay etapas abiertas"}
            value={etapaId}
            onChange={(v) => {
              setEtapaId(v);
              limpiar("etapa");
            }}
            options={abiertas.map((x) => ({ value: x.id, label: x.nombre, color: x.color }))}
            error={errores.etapa}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoMoney id="monto" label="Valor estimado" value={monto} onChange={setMonto} />
          <Campo
            id="probabilidad"
            label="Probabilidad (%)"
            inputMode="numeric"
            placeholder="Opcional, de 0 a 100"
            value={probabilidad}
            onChange={(v) => {
              setProbabilidad(v);
              limpiar("probabilidad");
            }}
            error={errores.probabilidad}
          />
        </div>

        <Campo
          id="fecha_estimada_cierre"
          label="Fecha estimada de cierre"
          type="date"
          value={fechaEstimada}
          onChange={(v) => {
            setFechaEstimada(v);
            limpiar("fecha");
          }}
          error={errores.fecha}
        />

        {cerrada && oportunidad && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div role="group" aria-labelledby="cierre-real-label">
              <FieldLabel id="cierre-real-label">Fecha real de cierre</FieldLabel>
              <p className="flex h-10 items-center rounded-lg border border-input bg-secondary px-3 text-sm tabular-nums">
                {oportunidad.fecha_cierre ? formatFecha(oportunidad.fecha_cierre) : "—"}
              </p>
            </div>
            {oportunidad.estado === "perdida" && (
              <div role="group" aria-labelledby="motivo-label">
                <FieldLabel id="motivo-label">Motivo de pérdida</FieldLabel>
                <p className="flex min-h-10 items-center rounded-lg border border-input bg-secondary px-3 py-2 text-sm">
                  {motivoNombre ?? "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </CampoGrupo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoResponsable
          puedeAsignar={puedeAsignar}
          value={responsableId}
          onChange={setResponsableId}
          perfiles={perfiles}
          actual={oportunidad?.responsable_id ?? null}
          esAlta={!oportunidad}
        />
        <CampoOrigen value={origenId} onChange={setOrigenId} origenes={origenes} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="empresa_id"
          label="Empresa"
          placeholder="Sin empresa"
          searchable={empresasVisibles.length > 8}
          value={empresaId}
          onChange={elegirEmpresa}
          options={[
            { value: "", label: "Sin empresa" },
            ...(empresaOculta && oportunidad?.empresa_id ? [{ value: oportunidad.empresa_id, label: "Empresa de otra cartera" }] : []),
            ...empresasVisibles.map((x) => ({ value: x.id, label: x.label })),
          ]}
          error={errores.cliente}
        />
        <CampoSelect
          id="contacto_id"
          label="Contacto"
          placeholder={empresaId && !contactosVisibles.length ? "Esta empresa no tiene contactos" : "Sin contacto"}
          searchable={contactosVisibles.length > 8}
          value={contactoId}
          onChange={elegirContacto}
          options={[
            { value: "", label: "Sin contacto" },
            ...(contactoOculto && oportunidad?.contacto_id ? [{ value: oportunidad.contacto_id, label: "Contacto de otra cartera" }] : []),
            ...contactosVisibles.map((x) => ({ value: x.id, label: x.label })),
          ]}
        />
      </div>

      {noContactar && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-sm">
          <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <strong>Este cliente está marcado como «No contactar».</strong> Podés cargar la oportunidad, pero confirmá que corresponde antes de volver a escribirle o llamarlo.
          </span>
        </p>
      )}

      <CampoSelect
        id="producto_id"
        label="Producto / servicio"
        placeholder="Sin producto"
        searchable={productos.length > 8}
        value={productoId}
        onChange={setProductoId}
        // Un producto dado de baja solo se ofrece si ya es el de esta oportunidad.
        options={[
          { value: "", label: "Sin producto" },
          ...productos
            .filter((p) => p.activo || p.id === oportunidad?.producto_id)
            .map((p) => ({ value: p.id, label: p.activo ? p.label : `${p.label} (de baja)` })),
        ]}
      />

      <CampoTextarea
        id="notas"
        label="Observaciones"
        placeholder="Detalle del pedido, condiciones, seguimiento…"
        value={notas}
        onChange={setNotas}
      />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
