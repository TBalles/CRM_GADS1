import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: empresas }, { count: contactos }, { count: oportunidades }] =
    await Promise.all([
      supabase.from("empresas").select("*", { count: "exact", head: true }),
      supabase.from("contactos").select("*", { count: "exact", head: true }),
      supabase.from("oportunidades").select("*", { count: "exact", head: true }),
    ]);

  const cards = [
    { label: "Empresas", value: empresas ?? 0, href: "/empresas" },
    { label: "Contactos", value: contactos ?? 0, href: "/contactos" },
    { label: "Oportunidades", value: oportunidades ?? 0, href: "/oportunidades" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Inicio</h1>
      <p className="mt-1 text-sm text-slate-500">Resumen general del CRM.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Próximos pasos</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Registrá una empresa y un contacto asociado.</li>
          <li>Creá una oportunidad y asignale un responsable y un producto.</li>
          <li>
            Visualizala en el{" "}
            <Link href="/embudo" className="underline">
              embudo comercial
            </Link>{" "}
            y cambiala de etapa.
          </li>
        </ul>
      </div>
    </div>
  );
}
