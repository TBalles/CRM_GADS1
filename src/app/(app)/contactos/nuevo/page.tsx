import { createClient } from "@/lib/supabase/server";
import { crearContacto } from "../actions";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";

export default async function NuevoContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; empresa_id?: string }>;
}) {
  const { error, empresa_id } = await searchParams;
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nombre").order("nombre");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Nuevo contacto</h1>

      <form
        action={crearContacto}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-4">
          <Campo id="nombre" label="Nombre *" required />
          <Campo id="apellido" label="Apellido" />
        </div>
        <CampoSelect
          id="empresa_id"
          label="Empresa"
          placeholder="Sin empresa asociada"
          defaultValue={empresa_id}
          options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
        />
        <Campo id="cargo" label="Cargo" />
        <div className="grid grid-cols-2 gap-4">
          <Campo id="email" label="Email" type="email" />
          <Campo id="telefono" label="Teléfono" />
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
