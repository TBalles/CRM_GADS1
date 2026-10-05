"use client";

import * as React from "react";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoTexto, FormDrawer } from "@/components/crm/cuenta/FormDrawer";
import { Checkbox, Field, Textarea } from "@/components/crm/Field";
import { PERMISOS, type Permiso } from "@/lib/permisos";
import { guardarRol } from "./actions";
import { alternarPermiso, errorDeRol, gruposDePermisos } from "./logica";

export type RolFila = {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_admin: boolean;
  permisos: string[];
};

const GRUPOS = gruposDePermisos();

/**
 * "Nuevo rol" / "Editar rol" (CRM 2.0): drawer con los campos, ids (`#rol-nombre`, `#rol-descripcion`), validaciones y
 * textos de siempre. Los permisos van agrupados (un título por grupo y un divisor, sin cajas) como checkboxes con su
 * descripción; tildar uno tilda lo que necesita y destildarlo destilda lo que depende de él (`alternarPermiso`).
 * `key` desde quien abre: cada apertura arranca con los datos del rol.
 */
export default function RolForm({
  open,
  onClose,
  rol,
  esMiRol,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  rol?: RolFila;
  /** Es el rol de quien edita: no puede sacarle la gestión de usuarios. */
  esMiRol: boolean;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = React.useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(rol?.descripcion ?? "");
  const [elegidos, setElegidos] = React.useState<Set<Permiso>>(
    () => new Set((rol?.permisos ?? []).filter((p): p is Permiso => PERMISOS.some((x) => x.clave === p))),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { showToast } = useCrmToast();

  function alternar(p: Permiso) {
    setElegidos((prev) => alternarPermiso(prev, p));
    if (error) setError(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const problema = errorDeRol(nombre, elegidos, esMiRol);
    if (problema) {
      setError(problema);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await guardarRol({ id: rol?.id ?? null, nombre, descripcion, permisos: [...elegidos] });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    showToast(rol ? "Rol actualizado." : "Rol creado.", "success");
    onSaved();
  }

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={rol ? "Editar rol" : "Nuevo rol"}
      description={rol?.nombre}
      saving={saving}
      error={error}
      submitLabel={rol ? "Guardar rol" : "Crear rol"}
      onSubmit={guardar}
    >
      <CampoTexto id="rol-nombre" label="Nombre" required placeholder="RRHH, Logística, Atención al cliente…" value={nombre} onChange={setNombre} />
      <Field id="rol-descripcion" label="Descripción">
        {(p) => (
          <Textarea {...p} rows={2} maxLength={200} placeholder="Para qué sirve este rol" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        )}
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-4 border-t border-(--crm-border) pt-4">
        <legend className="float-left mb-1 w-full text-[13px] font-semibold leading-[18px]">Qué puede hacer</legend>
        {GRUPOS.map(([grupo, permisos], i) => (
          <div key={grupo} role="group" aria-labelledby={`grupo-permisos-${i}`} className="clear-both flex flex-col gap-2">
            <p id={`grupo-permisos-${i}`} className="text-[12px] font-medium leading-4 text-(--crm-text-2)">
              {grupo}
            </p>
            {permisos.map((p) => (
              <Checkbox
                key={p.clave}
                id={`permiso-${p.clave}`}
                checked={elegidos.has(p.clave)}
                onChange={() => alternar(p.clave)}
                label={p.etiqueta}
                description={p.descripcion}
              />
            ))}
          </div>
        ))}
      </fieldset>
    </FormDrawer>
  );
}
