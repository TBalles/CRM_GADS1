import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { actualizarContacto } from "../actions";
import { Campo, CampoTextarea, CampoSelect } from "@/components/form";

export default async function ContactoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data: contacto } = await supabase
    .from("contactos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contacto) notFound();

  const { data: empresas } = await supabase.from("empresas").select("id, nombre").order("nombre");
  const { data: oportunidades } = await supabase
    .from("oportunidades")
    .select("id, titulo, etapa:etapas(nombre)")
    .eq("contacto_id", id)
    .order("created_at", { ascending: false });

  const actualizarConId = actualizarContacto.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/contactos" className="text-sm text-slate-500 hover:underline">
          ← Contactos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {contacto.nombre} {contacto.apellido ?? ""}
        </h1>
      </div>

      <form
        action={actualizarConId}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-4">
          <Campo id="nombre" label="Nombre *" required defaultValue={contacto.nombre} />
          <Campo id="apellido" label="Apellido" defaultValue={contacto.apellido} />
        </div>
        <CampoSelect
          id="empresa_id"
          label="Empresa"
          placeholder="Sin empresa asociada"
          defaultValue={contacto.empresa_id ?? ""}
          options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nombre }))}
        />
        <Campo id="cargo" label="Cargo" defaultValue={contacto.cargo} />
        <div className="grid grid-cols-2 gap-4">
          <Campo id="email" label="Email" type="email" defaultValue={contacto.email} />
          <Campo id="telefono" label="Teléfono" defaultValue={contacto.telefono} />
        </div>
        <CampoTextarea id="notas" label="Notas" defaultValue={contacto.notas} />

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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Oportunidades</h2>
          <Link
            href={`/oportunidades/nueva?contacto_id=${id}`}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            + Nueva oportunidad
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {oportunidades?.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2 text-sm">
              <Link
                href={`/oportunidades/${o.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {o.titulo}
              </Link>
              <span className="text-slate-500">{o.etapa?.nombre}</span>
            </li>
          ))}
          {!oportunidades?.length ? (
            <li className="py-2 text-sm text-slate-400">Sin oportunidades asociadas.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
