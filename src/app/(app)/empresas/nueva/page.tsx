import { crearEmpresa } from "../actions";
import { Campo, CampoTextarea } from "@/components/form";

export default async function NuevaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Nueva empresa</h1>

      <form
        action={crearEmpresa}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Campo id="nombre" label="Nombre *" required />
        <Campo id="cuit" label="CUIT" />
        <Campo id="telefono" label="Teléfono" />
        <Campo id="email" label="Email" type="email" />
        <Campo id="direccion" label="Dirección" />
        <CampoTextarea id="notas" label="Notas" />

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
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
