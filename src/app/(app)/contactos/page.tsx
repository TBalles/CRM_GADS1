import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ContactosPage() {
  const supabase = await createClient();
  const { data: contactos } = await supabase
    .from("contactos")
    .select("id, nombre, apellido, email, telefono, cargo, empresa:empresas(id, nombre)")
    .order("nombre");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contactos</h1>
          <p className="mt-1 text-sm text-slate-500">Personas de contacto en cada empresa.</p>
        </div>
        <Link
          href="/contactos/nuevo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nuevo contacto
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Cargo</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Teléfono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contactos?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/contactos/${c.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {c.nombre} {c.apellido ?? ""}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.empresa ? (
                    <Link href={`/empresas/${c.empresa.id}`} className="hover:underline">
                      {c.empresa.nombre}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.cargo ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.telefono ?? "—"}</td>
              </tr>
            ))}
            {!contactos?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay contactos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
