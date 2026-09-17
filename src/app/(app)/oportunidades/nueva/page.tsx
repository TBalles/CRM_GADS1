import { createClient } from "@/lib/supabase/server";
import { crearOportunidad } from "../actions";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";

export default async function NuevaOportunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; empresa_id?: string; contacto_id?: string }>;
}) {
  const { error, empresa_id, contacto_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: empresas }, { data: contactos }, { data: productos }, { data: etapas }, { data: perfiles }] =
    await Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase.from("contactos").select("id, nombre, apellido").order("nombre"),
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("etapas").select("id, nombre").order("orden"),
      supabase.from("perfiles").select("id, nombre, email").order("nombre"),
    ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Nueva oportunidad</h1>

      <form
        action={crearOportunidad}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Campo id="titulo" label="Título *" required />

        <div className="grid grid-cols-2 gap-4">
          <CampoSelect
            id="empresa_id"
            label="Empresa"
            placeholder="Sin empresa"
            defaultValue={empresa_id}
            options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
          />
          <CampoSelect
            id="contacto_id"
            label="Contacto"
            placeholder="Sin contacto"
            defaultValue={contacto_id}
            options={(contactos ?? []).map((c) => ({
              value: c.id,
              label: `${c.nombre} ${c.apellido ?? ""}`.trim(),
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CampoSelect
            id="producto_id"
            label="Producto / servicio"
            placeholder="Sin producto"
            options={(productos ?? []).map((p) => ({ value: p.id, label: p.nombre }))}
          />
          <CampoSelect
            id="responsable_id"
            label="Responsable"
            placeholder="Sin asignar"
            options={(perfiles ?? []).map((p) => ({
              value: p.id,
              label: p.nombre ?? p.email ?? p.id,
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CampoSelect
            id="etapa_id"
            label="Etapa *"
            required
            placeholder="Seleccioná una etapa"
            options={(etapas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
          />
          <Campo id="monto" label="Monto estimado" type="number" />
        </div>

        <CampoTextarea id="notas" label="Notas" />

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
