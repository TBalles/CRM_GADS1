import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OportunidadesPage() {
  const supabase = await createClient();
  const { data: oportunidades } = await supabase
    .from("oportunidades")
    .select(
      `id, titulo, monto, created_at,
       empresa:empresas(nombre),
       contacto:contactos(nombre, apellido),
       etapa:etapas(nombre, color),
       responsable:perfiles(nombre)`,
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Oportunidades</h1>
          <p className="mt-1 text-sm text-slate-500">
            Negocios en curso con empresas y contactos.
          </p>
        </div>
        <Link
          href="/oportunidades/nueva"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nueva oportunidad
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Título</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">
                Empresa / Contacto
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Etapa</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Responsable</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {oportunidades?.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/oportunidades/${o.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {o.titulo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {o.empresa?.nombre ?? o.contacto?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: o.etapa?.color ?? "#64748b" }}
                  >
                    {o.etapa?.nombre ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.responsable?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {o.monto ? `$${Number(o.monto).toLocaleString("es-AR")}` : "—"}
                </td>
              </tr>
            ))}
            {!oportunidades?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay oportunidades registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
