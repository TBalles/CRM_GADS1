import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { actualizarEmpresa } from "../actions";
import { Campo, CampoTextarea } from "@/components/form";

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!empresa) notFound();

  const { data: contactos } = await supabase
    .from("contactos")
    .select("id, nombre, apellido, email")
    .eq("empresa_id", id)
    .order("nombre");

  const { data: oportunidades } = await supabase
    .from("oportunidades")
    .select("id, titulo, etapa:etapas(nombre, color)")
    .eq("empresa_id", id)
    .order("created_at", { ascending: false });

  const actualizarConId = actualizarEmpresa.bind(null, id);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/empresas" className="text-sm text-slate-500 hover:underline">
          ← Empresas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{empresa.nombre}</h1>
      </div>

      <form
        action={actualizarConId}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Campo id="nombre" label="Nombre *" required defaultValue={empresa.nombre} />
        <Campo id="cuit" label="CUIT" defaultValue={empresa.cuit} />
        <Campo id="telefono" label="Teléfono" defaultValue={empresa.telefono} />
        <Campo id="email" label="Email" type="email" defaultValue={empresa.email} />
        <Campo id="direccion" label="Dirección" defaultValue={empresa.direccion} />
        <CampoTextarea id="notas" label="Notas" defaultValue={empresa.notas} />

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
          <h2 className="text-lg font-medium text-slate-900">Contactos</h2>
          <Link
            href={`/contactos/nuevo?empresa_id=${id}`}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            + Agregar contacto
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {contactos?.map((c) => (
            <li key={c.id} className="py-2 text-sm">
              <Link
                href={`/contactos/${c.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {c.nombre} {c.apellido ?? ""}
              </Link>
              <span className="ml-2 text-slate-500">{c.email}</span>
            </li>
          ))}
          {!contactos?.length ? (
            <li className="py-2 text-sm text-slate-400">Sin contactos asociados.</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">Oportunidades</h2>
          <Link
            href={`/oportunidades/nueva?empresa_id=${id}`}
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
