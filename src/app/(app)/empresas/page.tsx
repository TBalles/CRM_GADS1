import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nombre, cuit, telefono, email")
    .order("nombre");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clubes, canchas, complejos y escuelas de fútbol.
          </p>
        </div>
        <Link
          href="/empresas/nueva"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nueva empresa
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">CUIT</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Teléfono</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empresas?.map((empresa) => (
              <tr key={empresa.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/empresas/${empresa.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {empresa.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{empresa.cuit ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{empresa.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{empresa.email ?? "—"}</td>
              </tr>
            ))}
            {!empresas?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay empresas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
