"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cambiarEtapa } from "./actions";

type Etapa = { id: string; nombre: string; orden: number; color: string | null };
type Oportunidad = {
  id: string;
  titulo: string;
  monto: number | null;
  etapa_id: string;
  empresa: { nombre: string } | null;
  contacto: { nombre: string; apellido: string | null } | null;
};

export default function EmbudoBoard({
  etapas,
  oportunidades,
}: {
  etapas: Etapa[];
  oportunidades: Oportunidad[];
}) {
  const [items, setItems] = useState(oportunidades);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleChange(oportunidadId: string, etapaId: string) {
    setItems((prev) =>
      prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: etapaId } : o)),
    );
    setPendingId(oportunidadId);
    startTransition(async () => {
      await cambiarEtapa(oportunidadId, etapaId);
      setPendingId(null);
    });
  }

  return (
    <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
      {etapas.map((etapa) => {
        const oportunidadesEtapa = items.filter((o) => o.etapa_id === etapa.id);
        return (
          <div key={etapa.id} className="w-72 flex-shrink-0">
            <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-white px-3 py-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: etapa.color ?? "#64748b" }}
              />
              <h2 className="text-sm font-semibold text-slate-900">{etapa.nombre}</h2>
              <span className="ml-auto text-xs text-slate-400">{oportunidadesEtapa.length}</span>
            </div>
            <div className="min-h-[120px] space-y-2 rounded-b-lg border border-slate-200 bg-slate-100 p-2">
              {oportunidadesEtapa.map((o) => (
                <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <Link
                    href={`/oportunidades/${o.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {o.titulo}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {o.empresa?.nombre ?? o.contacto?.nombre ?? "Sin empresa/contacto"}
                  </p>
                  {o.monto ? (
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      ${Number(o.monto).toLocaleString("es-AR")}
                    </p>
                  ) : null}
                  <select
                    value={o.etapa_id}
                    disabled={isPending && pendingId === o.id}
                    onChange={(e) => handleChange(o.id, e.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    {etapas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {!oportunidadesEtapa.length ? (
                <p className="px-1 py-4 text-center text-xs text-slate-400">Sin oportunidades</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
