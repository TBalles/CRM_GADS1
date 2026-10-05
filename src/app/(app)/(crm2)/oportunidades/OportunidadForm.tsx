"use client";

import { useRef, useState } from "react";
import { FormSection } from "@/components/crm/Drawer";
import { InlineBanner } from "@/components/crm/Feedback";
import { Field, Textarea } from "@/components/crm/Field";
import { MoneyInput } from "@/components/crm/MoneyInput";
import { SegmentedControl } from "@/components/crm/Tabs";
import { Tag } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { TYPE, cn } from "@/components/crm/cx";
import { CampoFecha, CampoOpciones, CampoOrigenCrm, CampoResponsableCrm, CampoTexto, FormDrawer, Par } from "@/components/crm/cuenta/FormDrawer";
import { EstadoOportunidad } from "@/components/crm/cuenta/estados";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, origenPorNombre, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { filaLicitacion, TIPOS_OPORTUNIDAD, validarLicitacion, type ErroresLicitacion, type TipoOportunidad } from "@/lib/licitaciones";
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
type Licitacion = Tables<"licitaciones">;
type Etapa = Pick<Tables<"etapas">, "id" | "nombre" | "tipo" | "orden" | "color">;
type Errores = Partial<Record<"titulo" | "cliente" | "etapa" | "probabilidad" | "fecha", string>> & ErroresLicitacion;

/** Origen del catalogo que se propone al marcar una oportunidad como licitacion (si todavia no tiene uno). */
const ORIGEN_LICITACION = "Licitación municipal";

/** Lo que el formulario necesita y no depende de la oportunidad (lo arma la página servidor). */
export type CatalogosOportunidad = {
  /** Las tablas del rubro (migracion 0011) existen. Sin ellas no se ofrece el tipo "Licitacion" y el tipo queda como estaba. */
  licitacionesActivas: boolean;
  empresas: OpcionEmpresa[];
  contactos: OpcionContacto[];
  productos: OpcionProducto[];
  etapas: Etapa[];
  origenes: OrigenOpcion[];
  perfiles: PerfilOpcion[];
  /** `oportunidades.asignar`. Sin el, el responsable es solo lectura y el alta queda a nombre de quien la crea. */
  puedeAsignar: boolean;
  yoId: string;
};

/**
 * "Nueva oportunidad" / "Editar oportunidad" en un drawer de CRM 2.0. Misma lógica que el formulario legacy: mismos
 * campos e ids (`#titulo`, `#etapa_id`, `#monto`, `#probabilidad`, `#fecha_estimada_cierre`, `#responsable_id`,
 * `#origen_id`, `#licitacion_*`, `#empresa_id`, `#contacto_id`, `#producto_id`, `#notas`), validaciones, payload y avisos.
 *
 * Estado, fecha real de cierre y motivo de perdida NO se editan aca: los fija el trigger de la base cuando se cambia de
 * etapa o se cierra (CierreDialog). En el alta la etapa es una de las abiertas; en la edicion se muestra pero se cambia
 * desde "Cambiar etapa", para que cada cambio deje su observacion en el historial. `key` por apertura (estado limpio).
 */
export default function OportunidadForm({
  open,
  onClose,
  oportunidad,
  licitacion,
  motivoNombre,
  catalogos,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  oportunidad?: Oportunidad;
  /** Datos de la licitacion de esta oportunidad, si ya se cargaron. */
  licitacion?: Licitacion | null;
  /** Nombre del motivo de perdida de una oportunidad perdida (solo lectura). */
  motivoNombre?: string | null;
  catalogos: CatalogosOportunidad;
  onSaved: (oportunidad: Oportunidad, licitacion?: Licitacion | null) => void;
}) {
  const { licitacionesActivas, empresas, contactos, productos, etapas, origenes, perfiles, puedeAsignar, yoId } = catalogos;
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
  const [tipo, setTipo] = useState<TipoOportunidad>(oportunidad?.tipo === "licitacion" ? "licitacion" : "directa");
  const [expediente, setExpediente] = useState(licitacion?.expediente ?? "");
  const [organismo, setOrganismo] = useState(licitacion?.organismo ?? "");
  const [fechaApertura, setFechaApertura] = useState(licitacion?.fecha_apertura ?? "");
  const [montoOficial, setMontoOficial] = useState(maskFromNumber(licitacion?.monto_oficial));
  const [garantia, setGarantia] = useState(licitacion?.garantia ?? "");
  // Si la oportunidad se guardo pero los datos de la licitacion no, un nuevo intento actualiza en vez de duplicar.
  const [guardada, setGuardada] = useState<Oportunidad | null>(null);
  // Y al cerrar el panel (Cancelar, X o Escape) se avisa igual al padre para que refresque: la oportunidad ya existe.
  const parcial = useRef<Oportunidad | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useCrmToast();

  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  function cerrar() {
    if (parcial.current) onSaved(parcial.current, null);
    else onClose();
  }

  // Un cliente dado de baja (inactivo) no se ofrece, salvo que ya sea el de esta oportunidad.
  const empresasVisibles = empresas.filter((e) => e.estado !== "inactivo" || e.id === oportunidad?.empresa_id);
  // La empresa o el contacto de la oportunidad pueden ser de otra cartera: la RLS no los trae, pero
  // el select tiene que poder mostrarlos, o el guardado los mandaria como "Sin empresa" / "Sin contacto".
  const empresaOculta = Boolean(oportunidad?.empresa_id && !empresas.some((e) => e.id === oportunidad.empresa_id));
  const contactoOculto = Boolean(oportunidad?.contacto_id && !contactos.some((c) => c.id === oportunidad.contacto_id));
  const contactosDeBaja = (c: OpcionContacto) => c.estado === "inactivo" && c.id !== oportunidad?.contacto_id;
  // With a company chosen, only its contacts. Without one, every contact says which company it belongs to.
  const contactosVisibles = (empresaId
    ? contactos.filter((c) => c.empresaId === empresaId)
    : contactos.map((c) => (c.empresa ? { ...c, label: `${c.label} · ${c.empresa}` } : c))
  ).filter((c) => !contactosDeBaja(c));

  function elegirTipo(next: TipoOportunidad) {
    setTipo(next);
    // Una licitacion nace con el origen "Licitacion municipal" si todavia no tiene ninguno.
    if (next === "licitacion" && !origenId) setOrigenId(origenPorNombre(origenes, ORIGEN_LICITACION) ?? "");
  }

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
    const esLicitacion = licitacionesActivas && tipo === "licitacion";
    const camposLicitacion = {
      expediente,
      organismo,
      fechaApertura,
      montoOficial: montoOficial.trim() ? parseMoney(montoOficial) : null,
      garantia,
    };
    if (esLicitacion) Object.assign(nuevos, validarLicitacion(camposLicitacion));
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
      // Sin las tablas del rubro no se toca el tipo.
      ...(licitacionesActivas ? { tipo } : {}),
      // Sin `oportunidades.asignar` no se manda: el alta queda a nombre de quien la crea
      // (trigger `validar_responsable`) y la edicion conserva el responsable.
      ...(puedeAsignar ? { responsable_id: responsableId || null } : {}),
    };

    const existente = oportunidad ?? guardada;
    const { data, error: dbError } = existente
      ? await supabase.from("oportunidades").update(payload).eq("id", existente.id).select().single()
      : await supabase.from("oportunidades").insert({ ...payload, etapa_id: etapaId }).select().single();

    if (dbError || !data) {
      setSaving(false);
      setError(mensajeErrorOportunidad(dbError, "No se pudo guardar la oportunidad. Revisá los datos e intentá de nuevo."));
      return;
    }

    // Los datos de la licitacion van despues de la oportunidad (necesitan su id): uno por oportunidad, se pisan al editar.
    let licitacionGuardada: Licitacion | null | undefined;
    if (esLicitacion) {
      const { data: lic, error: licError } = await supabase
        .from("licitaciones")
        .upsert({ oportunidad_id: data.id, ...filaLicitacion(camposLicitacion) }, { onConflict: "oportunidad_id" })
        .select()
        .single();
      if (licError || !lic) {
        setSaving(false);
        setGuardada(data);
        parcial.current = data;
        showToast("La oportunidad se guardó, pero faltan los datos de la licitación.", "warning", 8000);
        setError(
          `La oportunidad se guardó, pero no los datos de la licitación: ${
            esErrorDeEsquema(licError)
              ? "la base todavía no tiene la tabla de licitaciones (migración 0011)."
              : mensajeErrorOportunidad(licError, "revisá los datos y volvé a guardar.")
          }`,
        );
        return;
      }
      licitacionGuardada = lic;
    }
    setSaving(false);
    parcial.current = null;

    showToast(existente ? "Oportunidad actualizada." : "Oportunidad creada.", "success");
    onSaved(data, licitacionGuardada);
  }

  const etapaActual = oportunidad ? etapas.find((x) => x.id === oportunidad.etapa_id) : undefined;
  const cerrada = oportunidad != null && oportunidad.estado !== "abierta";

  return (
    <FormDrawer
      open={open}
      onClose={cerrar}
      title={oportunidad ? "Editar oportunidad" : "Nueva oportunidad"}
      description={oportunidad?.titulo}
      saving={saving}
      error={error}
      onSubmit={handleSubmit}
    >
      {cerrada && (
        <InlineBanner tone="info" title="Esta oportunidad está cerrada.">
          Podés corregir sus datos, pero cada cambio queda registrado en la auditoría.
        </InlineBanner>
      )}

      <CampoTexto
        id="titulo"
        label="Título"
        required
        placeholder="Provisión de arcos y redes"
        value={titulo}
        onChange={(v) => {
          setTitulo(v);
          limpiar("titulo");
        }}
        error={errores.titulo}
      />

      <FormSection title="Estado comercial">
        {oportunidad ? (
          <div role="group" aria-labelledby="etapa-actual-label" className="flex flex-col gap-1">
            <span id="etapa-actual-label" className="text-[13px] font-medium leading-[18px]">
              Etapa y estado
            </span>
            <p className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) px-3 py-1">
              <span className="inline-flex items-center gap-1.5">
                {etapaActual?.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: etapaActual.color }} />}
                {etapaActual?.nombre ?? "—"}
              </span>
              <EstadoOportunidad estado={oportunidad.estado} />
              {oportunidad.tipo === "licitacion" && <Tag>Licitación</Tag>}
            </p>
            <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
              La etapa se cambia con «Cambiar etapa», «Marcar ganada» o «Marcar perdida»: así queda el motivo en el historial.
            </p>
          </div>
        ) : (
          <CampoOpciones
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

        <Par>
          <Field id="monto" label="Valor estimado">
            {(p) => <MoneyInput {...p} value={monto} onChange={setMonto} />}
          </Field>
          <CampoTexto
            id="probabilidad"
            label="Probabilidad (%)"
            inputMode="numeric"
            placeholder="Opcional, de 0 a 100"
            className="[&_input]:font-(family-name:--crm-font-mono) [&_input]:tabular-nums"
            value={probabilidad}
            onChange={(v) => {
              setProbabilidad(v);
              limpiar("probabilidad");
            }}
            error={errores.probabilidad}
          />
        </Par>

        <CampoFecha
          id="fecha_estimada_cierre"
          label="Fecha estimada de cierre"
          value={fechaEstimada}
          onChange={(v) => {
            setFechaEstimada(v);
            limpiar("fecha");
          }}
          error={errores.fecha}
        />

        {cerrada && oportunidad && (
          <Par>
            <SoloLectura id="cierre-real-label" label="Fecha real de cierre" mono>
              {oportunidad.fecha_cierre ? formatFecha(oportunidad.fecha_cierre) : "—"}
            </SoloLectura>
            {oportunidad.estado === "perdida" && (
              <SoloLectura id="motivo-label" label="Motivo de pérdida">
                {motivoNombre ?? "—"}
              </SoloLectura>
            )}
          </Par>
        )}
      </FormSection>

      <Par>
        <CampoResponsableCrm
          puedeAsignar={puedeAsignar}
          value={responsableId}
          onChange={setResponsableId}
          perfiles={perfiles}
          actual={oportunidad?.responsable_id ?? null}
          esAlta={!oportunidad}
        />
        <CampoOrigenCrm value={origenId} onChange={setOrigenId} origenes={origenes} />
      </Par>

      {licitacionesActivas && (
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="text-[13px] font-medium leading-[18px]">
            Tipo
          </span>
          <SegmentedControl
            label="Tipo"
            className="self-start"
            items={TIPOS_OPORTUNIDAD.map((t) => ({ value: t.value, label: t.label }))}
            value={tipo}
            onValueChange={(v) => elegirTipo(v as TipoOportunidad)}
          />
        </div>
      )}

      {licitacionesActivas && tipo === "licitacion" && (
        <FormSection title="Licitación municipal">
          <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Hasta que llegue la fecha de apertura no se puede marcar ganada: la base lo controla.</p>
          <CampoTexto
            id="licitacion_organismo"
            label="Organismo"
            required
            placeholder="Municipalidad de…"
            value={organismo}
            onChange={(v) => {
              setOrganismo(v);
              limpiar("organismo");
            }}
            error={errores.organismo}
          />
          <Par>
            <CampoTexto
              id="licitacion_expediente"
              label="Expediente"
              placeholder="EX-2026-001234"
              value={expediente}
              onChange={(v) => {
                setExpediente(v);
                limpiar("expediente");
              }}
              error={errores.expediente}
            />
            <CampoFecha
              id="licitacion_apertura"
              label="Fecha de apertura"
              required
              value={fechaApertura}
              onChange={(v) => {
                setFechaApertura(v);
                limpiar("fechaApertura");
              }}
              error={errores.fechaApertura}
            />
          </Par>
          <Par>
            <Field id="licitacion_monto_oficial" label="Monto oficial" error={errores.montoOficial}>
              {(p) => (
                <MoneyInput
                  {...p}
                  value={montoOficial}
                  onChange={(v) => {
                    setMontoOficial(v);
                    limpiar("montoOficial");
                  }}
                />
              )}
            </Field>
            <CampoTexto
              id="licitacion_garantia"
              label="Garantía de oferta"
              placeholder="1% de la oferta, póliza de caución…"
              value={garantia}
              onChange={(v) => {
                setGarantia(v);
                limpiar("garantia");
              }}
              error={errores.garantia}
            />
          </Par>
        </FormSection>
      )}

      <Par>
        <CampoOpciones
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
        <CampoOpciones
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
      </Par>

      {noContactar && (
        <InlineBanner tone="warning" title="Este cliente está marcado como «No contactar».">
          Podés cargar la oportunidad, pero confirmá que corresponde antes de volver a escribirle o llamarlo.
        </InlineBanner>
      )}

      <CampoOpciones
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

      <Field id="notas" label="Observaciones">
        {(p) => <Textarea {...p} rows={3} placeholder="Detalle del pedido, condiciones, seguimiento…" value={notas} onChange={(e) => setNotas(e.target.value)} />}
      </Field>
    </FormDrawer>
  );
}

/** Un dato que el formulario muestra pero no edita (lo fija la base al cerrar). */
function SoloLectura({ id, label, mono, children }: { id: string; label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-[13px] font-medium leading-[18px]">
        {label}
      </span>
      <p className={cn("flex min-h-8 items-center rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) px-3 py-1", mono && TYPE.mono)}>
        {children}
      </p>
    </div>
  );
}
