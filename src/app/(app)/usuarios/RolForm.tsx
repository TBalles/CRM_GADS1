"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Campo, CampoTextarea, FormActions, FormBanner } from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import { PERMISOS, conDependencias, type Permiso } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import { guardarRol } from "./actions";

export type RolFila = {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_admin: boolean;
  permisos: string[];
};

/** Permisos que dependen (directa o indirectamente) de `p`. */
function dependientesDe(p: Permiso): Permiso[] {
  return PERMISOS.filter((x) => x.clave !== p && conDependencias([x.clave]).includes(p)).map((x) => x.clave);
}

export default function RolForm({
  rol,
  esMiRol,
  onSaved,
  onCancel,
}: {
  rol?: RolFila;
  /** Es el rol de quien edita: no puede sacarle la gestión de usuarios. */
  esMiRol: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [elegidos, setElegidos] = useState<Set<Permiso>>(
    () => new Set((rol?.permisos ?? []).filter((p): p is Permiso => PERMISOS.some((x) => x.clave === p))),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const grupos = useMemo(() => {
    const m = new Map<string, typeof PERMISOS>();
    for (const p of PERMISOS) m.set(p.grupo, [...(m.get(p.grupo) ?? []), p]);
    return [...m.entries()];
  }, []);

  /**
   * Tildar un permiso tilda lo que necesita; destildarlo destilda lo que
   * depende de el. Asi no se puede armar un rol que no funcione (ej. "registrar
   * ventas" sin poder ver los clientes). El servidor aplica la misma regla.
   */
  function alternar(p: Permiso) {
    setElegidos((prev) => {
      if (prev.has(p)) {
        const next = new Set(prev);
        next.delete(p);
        for (const d of dependientesDe(p)) next.delete(d);
        return next;
      }
      return new Set(conDependencias([...prev, p]));
    });
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Ponele un nombre al rol.");
      return;
    }
    if (!elegidos.size) {
      setError("Elegí al menos un permiso.");
      return;
    }
    if (esMiRol && !elegidos.has("usuarios.gestionar")) {
      setError("No podés quitarle a tu propio rol la gestión de usuarios.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await guardarRol({
      id: rol?.id ?? null,
      nombre,
      descripcion,
      permisos: [...elegidos],
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    showToast(rol ? "Rol actualizado." : "Rol creado.", "success");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="rol-nombre"
        label="Nombre"
        required
        autoFocus
        placeholder="RRHH, Logística, Atención al cliente…"
        value={nombre}
        onChange={setNombre}
      />
      <CampoTextarea
        id="rol-descripcion"
        label="Descripción"
        rows={2}
        maxLength={200}
        placeholder="Para qué sirve este rol"
        value={descripcion}
        onChange={setDescripcion}
      />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Qué puede hacer</legend>
        {grupos.map(([grupo, permisos]) => (
          <div key={grupo} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{grupo}</p>
            <div className="space-y-1.5">
              {permisos.map((p) => {
                const activo = elegidos.has(p.clave);
                return (
                  <label
                    key={p.clave}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent",
                      activo && "bg-brand/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => alternar(p.clave)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
                        activo ? "border-brand bg-brand text-brand-foreground" : "border-input bg-background",
                      )}
                    >
                      {activo && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">{p.descripcion}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <FormActions saving={saving} onCancel={onCancel} submitLabel={rol ? "Guardar rol" : "Crear rol"} />
    </form>
  );
}
