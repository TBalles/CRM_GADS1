"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campo, CampoSelect, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { CampoOrigen, CampoResponsable } from "@/components/ClienteCampos";
import { useToast } from "@/components/ui/Toast";
import { cuitValido, formatearCuit } from "@/lib/cuit";
import { sitioWebValido } from "@/lib/sitioweb";
import {
  EMAIL_RE,
  ESTADOS,
  TIPOS_CLIENTE,
  mensajeErrorGuardado,
  type OrigenOpcion,
  type PerfilOpcion,
} from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
type Errores = Partial<Record<"nombre" | "cuit" | "email" | "sitio_web", string>>;

export default function EmpresaForm({
  empresa,
  perfiles,
  origenes,
  puedeAsignar,
  yoId,
  onSaved,
  onCancel,
}: {
  empresa?: Empresa;
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** `clientes.asignar`: sin el, el responsable no se elige (la base lo rechaza igual). */
  puedeAsignar: boolean;
  yoId: string;
  onSaved: (empresa: Empresa) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? "");
  const [cuit, setCuit] = useState(empresa?.cuit ?? "");
  const [tipoCliente, setTipoCliente] = useState(empresa?.tipo_cliente ?? "");
  const [telefono, setTelefono] = useState(empresa?.telefono ?? "");
  const [email, setEmail] = useState(empresa?.email ?? "");
  const [direccion, setDireccion] = useState(empresa?.direccion ?? "");
  const [sitioWeb, setSitioWeb] = useState(empresa?.sitio_web ?? "");
  const [estado, setEstado] = useState(empresa?.estado ?? "potencial");
  const [responsableId, setResponsableId] = useState(empresa ? (empresa.responsable_id ?? "") : yoId);
  const [origenId, setOrigenId] = useState(empresa?.origen_id ?? "");
  const [notas, setNotas] = useState(empresa?.notas ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nuevos: Errores = {};
    if (!nombre.trim()) nuevos.nombre = "La razón social es obligatoria.";
    // El digito verificador solo se exige si el CUIT cambio: uno ya guardado
    // (carga vieja, demo) no puede impedir guardar el resto de los datos.
    if (cuit.trim() && cuit.trim() !== (empresa?.cuit ?? "") && !cuitValido(cuit)) {
      nuevos.cuit = "El CUIT no es válido. Revisá los 11 dígitos.";
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) nuevos.email = "Ese mail no parece válido.";
    if (sitioWeb.trim() && sitioWeb.trim() !== (empresa?.sitio_web ?? "") && !sitioWebValido(sitioWeb)) {
      nuevos.sitio_web = "Poné un dominio (www.club.com.ar) o una dirección que empiece con http:// o https://.";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const cuitFinal = cuit.trim() ? (cuit.trim() === (empresa?.cuit ?? "") ? cuit.trim() : formatearCuit(cuit)) : null;
    const payload = {
      nombre: nombre.trim(),
      cuit: cuitFinal,
      tipo_cliente: tipoCliente || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      sitio_web: sitioWeb.trim() || null,
      estado,
      origen_id: origenId || null,
      notas: notas.trim() || null,
      // Sin clientes.asignar no se manda: el trigger deja al creador como
      // responsable y rechaza cualquier cambio.
      ...(puedeAsignar ? { responsable_id: responsableId || null } : {}),
    };

    const { data, error: dbError } = empresa
      ? await supabase.from("empresas").update(payload).eq("id", empresa.id).select().single()
      : await supabase.from("empresas").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      setError(mensajeErrorGuardado(dbError, "No se pudo guardar la empresa. Revisá los datos e intentá de nuevo."));
      return;
    }

    showToast(empresa ? "Empresa actualizada." : "Empresa creada.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="nombre"
        label="Razón social"
        required
        autoFocus
        placeholder="Club Atlético…"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          limpiar("nombre");
        }}
        error={errores.nombre}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          id="cuit"
          label="CUIT"
          inputMode="numeric"
          placeholder="30-12345678-9"
          value={cuit}
          onChange={(v) => {
            setCuit(v);
            limpiar("cuit");
          }}
          error={errores.cuit}
        />
        <CampoSelect
          id="tipo_cliente"
          label="Tipo de cliente"
          placeholder="Sin definir"
          value={tipoCliente}
          onChange={setTipoCliente}
          options={[{ value: "", label: "Sin definir" }, ...TIPOS_CLIENTE.map((t) => ({ value: t.value, label: t.label }))]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="telefono" label="Teléfono" type="tel" inputMode="tel" placeholder="11 5555-5555" value={telefono} onChange={setTelefono} />
        <Campo
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          placeholder="contacto@club.com"
          value={email}
          onChange={(v) => {
            setEmail(v);
            limpiar("email");
          }}
          error={errores.email}
        />
      </div>

      <Campo id="direccion" label="Dirección" placeholder="Av. Siempre Viva 742" value={direccion} onChange={setDireccion} />
      <Campo
        id="sitio_web"
        label="Sitio web"
        inputMode="url"
        placeholder="www.club.com.ar"
        value={sitioWeb}
        onChange={(v) => {
          setSitioWeb(v);
          limpiar("sitio_web");
        }}
        error={errores.sitio_web}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelect
          id="estado"
          label="Estado"
          value={estado}
          onChange={setEstado}
          options={ESTADOS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <CampoOrigen value={origenId} onChange={setOrigenId} origenes={origenes} />
      </div>

      <CampoResponsable
        puedeAsignar={puedeAsignar}
        value={responsableId}
        onChange={setResponsableId}
        perfiles={perfiles}
        actual={empresa?.responsable_id ?? null}
        esAlta={!empresa}
      />

      <CampoTextarea id="notas" label="Observaciones" placeholder="Contexto, historial, preferencias…" value={notas} onChange={setNotas} />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
