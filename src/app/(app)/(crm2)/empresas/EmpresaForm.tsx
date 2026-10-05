"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoArea, CampoOpciones, CampoOrigenCrm, CampoResponsableCrm, CampoTexto, FormDrawer, Par } from "@/components/crm/cuenta/FormDrawer";
import { cuitValido, formatearCuit } from "@/lib/cuit";
import { sitioWebValido } from "@/lib/sitioweb";
import { EMAIL_RE, ESTADOS, TIPOS_CLIENTE, mensajeErrorGuardado, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";
import { sinTrabarse } from "@/lib/guardar";

type Empresa = Tables<"empresas">;
type Errores = Partial<Record<"nombre" | "cuit" | "email" | "sitio_web", string>>;

/**
 * "Nueva empresa" / "Editar empresa": drawer de 640 de CRM 2.0. Lo usan la lista, la vista previa y la ficha; nadie más
 * da de alta empresas, así que esta es la ÚNICA implementación (la validación, el payload y los mensajes son los de
 * siempre). Quien lo usa le pone `key` por apertura (`useApertura().n`): cada alta empieza vacía.
 */
export default function EmpresaForm({
  open,
  onClose,
  empresa,
  perfiles,
  origenes,
  puedeAsignar,
  yoId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empresa?: Empresa;
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** `clientes.asignar`: sin el, el responsable no se elige (la base lo rechaza igual). */
  puedeAsignar: boolean;
  yoId: string;
  onSaved: (empresa: Empresa) => void;
}) {
  const [v, setV] = useState({
    nombre: empresa?.nombre ?? "",
    cuit: empresa?.cuit ?? "",
    tipoCliente: empresa?.tipo_cliente ?? "",
    telefono: empresa?.telefono ?? "",
    email: empresa?.email ?? "",
    direccion: empresa?.direccion ?? "",
    sitioWeb: empresa?.sitio_web ?? "",
    estado: empresa?.estado ?? "potencial",
    responsableId: empresa ? (empresa.responsable_id ?? "") : yoId,
    origenId: empresa?.origen_id ?? "",
    notas: empresa?.notas ?? "",
  });
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useCrmToast();

  const ERROR_DE: Partial<Record<keyof typeof v, keyof Errores>> = { nombre: "nombre", cuit: "cuit", email: "email", sitioWeb: "sitio_web" };
  function set(campo: keyof typeof v, valor: string) {
    setV((prev) => ({ ...prev, [campo]: valor }));
    const clave = ERROR_DE[campo];
    if (clave && errores[clave]) setErrores((prev) => ({ ...prev, [clave]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nuevos: Errores = {};
    if (!v.nombre.trim()) nuevos.nombre = "La razón social es obligatoria.";
    // El digito verificador solo se exige si el CUIT cambio: uno ya guardado
    // (carga vieja, demo) no puede impedir guardar el resto de los datos.
    if (v.cuit.trim() && v.cuit.trim() !== (empresa?.cuit ?? "") && !cuitValido(v.cuit)) {
      nuevos.cuit = "El CUIT no es válido. Revisá los 11 dígitos.";
    }
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) nuevos.email = "Ese mail no parece válido.";
    if (v.sitioWeb.trim() && v.sitioWeb.trim() !== (empresa?.sitio_web ?? "") && !sitioWebValido(v.sitioWeb)) {
      nuevos.sitio_web = "Poné un dominio (www.club.com.ar) o una dirección que empiece con http:// o https://.";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const cuit = v.cuit.trim();
    const cuitFinal = cuit ? (cuit === (empresa?.cuit ?? "") ? cuit : formatearCuit(v.cuit)) : null;
    const payload = {
      nombre: v.nombre.trim(),
      cuit: cuitFinal,
      tipo_cliente: v.tipoCliente || null,
      telefono: v.telefono.trim() || null,
      email: v.email.trim() || null,
      direccion: v.direccion.trim() || null,
      sitio_web: v.sitioWeb.trim() || null,
      estado: v.estado,
      origen_id: v.origenId || null,
      notas: v.notas.trim() || null,
      // Sin clientes.asignar no se manda: el trigger deja al creador como
      // responsable y rechaza cualquier cambio.
      ...(puedeAsignar ? { responsable_id: v.responsableId || null } : {}),
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
    <FormDrawer
      open={open}
      onClose={onClose}
      title={empresa ? "Editar empresa" : "Nueva empresa"}
      description={empresa?.nombre}
      size="lg"
      saving={saving}
      error={error}
      onSubmit={(e) => void sinTrabarse(() => handleSubmit(e), (m) => {
        setSaving(false);
        setError(m);
      })}
    >
      <CampoTexto
        id="nombre"
        label="Razón social"
        required
        placeholder="Club Atlético…"
        value={v.nombre}
        onChange={(x) => set("nombre", x)}
        error={errores.nombre}
      />
      <Par>
        <CampoTexto
          id="cuit"
          label="CUIT"
          inputMode="numeric"
          placeholder="30-12345678-9"
          className="[&_input]:font-(family-name:--crm-font-mono)"
          value={v.cuit}
          onChange={(x) => set("cuit", x)}
          error={errores.cuit}
        />
        <CampoOpciones
          id="tipo_cliente"
          label="Tipo de cliente"
          placeholder="Sin definir"
          value={v.tipoCliente}
          onChange={(x) => set("tipoCliente", x)}
          options={[{ value: "", label: "Sin definir" }, ...TIPOS_CLIENTE.map((t) => ({ value: t.value, label: t.label }))]}
        />
      </Par>
      <Par>
        <CampoTexto id="telefono" label="Teléfono" type="tel" inputMode="tel" placeholder="11 5555-5555" value={v.telefono} onChange={(x) => set("telefono", x)} />
        <CampoTexto
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          placeholder="contacto@club.com"
          value={v.email}
          onChange={(x) => set("email", x)}
          error={errores.email}
        />
      </Par>
      <CampoTexto id="direccion" label="Dirección" placeholder="Av. Siempre Viva 742" value={v.direccion} onChange={(x) => set("direccion", x)} />
      <CampoTexto
        id="sitio_web"
        label="Sitio web"
        inputMode="url"
        placeholder="www.club.com.ar"
        value={v.sitioWeb}
        onChange={(x) => set("sitioWeb", x)}
        error={errores.sitio_web}
      />
      <Par>
        <CampoOpciones id="estado" label="Estado" value={v.estado} onChange={(x) => set("estado", x)} options={ESTADOS.map((s) => ({ value: s.value, label: s.label }))} />
        <CampoOrigenCrm value={v.origenId} onChange={(x) => set("origenId", x)} origenes={origenes} />
      </Par>
      <CampoResponsableCrm
        puedeAsignar={puedeAsignar}
        value={v.responsableId}
        onChange={(x) => set("responsableId", x)}
        perfiles={perfiles}
        actual={empresa?.responsable_id ?? null}
        esAlta={!empresa}
      />
      <CampoArea id="notas" label="Observaciones" placeholder="Contexto, historial, preferencias…" value={v.notas} onChange={(x) => set("notas", x)} />
    </FormDrawer>
  );
}
