import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { actualizarOportunidad } from "../actions";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";

export default async function OportunidadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data: oportunidad } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!oportunidad) notFound();

  const [{ data: empresas }, { data: contactos }, { data: productos }, { data: etapas }, { data: perfiles }] =
    await Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase.from("contactos").select("id, nombre, apellido").order("nombre"),
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("etapas").select("id, nombre").order("orden"),
      supabase.from("perfiles").select("id, nombre, email").order("nombre"),
    ]);

  const actualizarConId = actualizarOportunidad.bind(null, id);

  return (
    <div className="max-w-2xl">
      <Link href="/oportunidades" className="text-sm text-slate-500 hover:underline">
        ← Oportunidades
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{oportunidad.titulo}</h1>

      <form
        action={actualizarConId}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Campo id="titulo" label="Título *" required defaultValue={oportunidad.titulo} />

        <div className="grid grid-cols-2 gap-4">
          <CampoSelect
            id="empresa_id"
            label="Empresa"
            placeholder="Sin empresa"
            defaultValue={oportunidad.empresa_id ?? ""}
            options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
          />
          <CampoSelect
            id="contacto_id"
            label="Contacto"
            placeholder="Sin contacto"
            defaultValue={oportunidad.contacto_id ?? ""}
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
            defaultValue={oportunidad.producto_id ?? ""}
            options={(productos ?? []).map((p) => ({ value: p.id, label: p.nombre }))}
          />
          <CampoSelect
            id="responsable_id"
            label="Responsable"
            placeholder="Sin asignar"
            defaultValue={oportunidad.responsable_id ?? ""}
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
            defaultValue={oportunidad.etapa_id}
            options={(etapas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
          />
          <Campo
            id="monto"
            label="Monto estimado"
            type="number"
            defaultValue={oportunidad.monto}
          />
        </div>

        <CampoTextarea id="notas" label="Notas" defaultValue={oportunidad.notas} />

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {saved ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Cambios guardados.
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
