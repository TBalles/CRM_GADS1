"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import Drawer from "@/components/Drawer";
import KebabMenu from "@/components/KebabMenu";
import OportunidadForm from "./OportunidadForm";
import type { Tables } from "@/lib/supabase/types";

type Etapa = Tables<"etapas">;
type Oportunidad = Tables<"oportunidades">;
type Opcion = { id: string; label: string };

type OportunidadRow = Oportunidad & {
  empresa: { id: string; nombre: string } | null;
  contacto: { id: string; nombre: string; apellido: string | null } | null;
  producto: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string | null } | null;
};

function formatMonto(monto: number | null) {
  return monto ? `$${Number(monto).toLocaleString("es-AR")}` : "—";
}

export default function OportunidadesView({
  etapas,
  oportunidades,
  empresas,
  contactos,
  productos,
  perfiles,
}: {
  etapas: Etapa[];
  oportunidades: OportunidadRow[];
  empresas: Opcion[];
  contactos: Opcion[];
  productos: Opcion[];
  perfiles: Opcion[];
}) {
  const [items, setItems] = useState(oportunidades);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [drawerOportunidad, setDrawerOportunidad] = useState<Oportunidad | "new" | null>(null);

  const etapaOptions: Opcion[] = etapas.map((e) => ({ id: e.id, label: e.nombre }));

  function handleChangeEtapa(oportunidadId: string, etapaId: string) {
    setItems((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: etapaId } : o)));
    setPendingId(oportunidadId);
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("oportunidades").update({ etapa_id: etapaId }).eq("id", oportunidadId);
      setPendingId(null);
    });
  }

  function closeDrawer() {
    setDrawerOportunidad(null);
  }

  function buildDisplayRow(raw: Oportunidad): OportunidadRow {
    const empresa = empresas.find((e) => e.id === raw.empresa_id);
    const contacto = contactos.find((c) => c.id === raw.contacto_id);
    const producto = productos.find((p) => p.id === raw.producto_id);
    const responsable = perfiles.find((p) => p.id === raw.responsable_id);
    return {
      ...raw,
      empresa: empresa ? { id: empresa.id, nombre: empresa.label } : null,
      contacto: contacto ? { id: contacto.id, nombre: contacto.label, apellido: null } : null,
      producto: producto ? { id: producto.id, nombre: producto.label } : null,
      responsable: responsable ? { id: responsable.id, nombre: responsable.label } : null,
    };
  }

  function handleOportunidadSaved(saved: Oportunidad) {
    const display = buildDisplayRow(saved);
    setItems((prev) => {
      const exists = prev.some((o) => o.id === saved.id);
      return exists ? prev.map((o) => (o.id === saved.id ? display : o)) : [display, ...prev];
    });
    closeDrawer();
  }

  return (
    <div>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {etapas.map((etapa) => {
          const etapaItems = items.filter((o) => o.etapa_id === etapa.id);
          return (
            <div key={etapa.id} className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: etapa.color ?? "#64748b" }} />
                <h2 className="min-w-0 truncate text-xs font-semibold text-slate-900 sm:text-sm dark:text-slate-100">
                  {etapa.nombre}
                </h2>
                <span className="ml-auto flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {etapaItems.length}
                </span>
              </div>
              <div className="flex max-h-[26rem] flex-1 flex-col gap-1.5 overflow-y-auto rounded-b-lg border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-950/50">
                {etapaItems.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setDrawerOportunidad(o)}
                        className="truncate text-left text-xs font-medium text-slate-900 hover:underline sm:text-sm dark:text-slate-100"
                      >
                        {o.titulo}
                      </button>
                      <KebabMenu items={[{ label: "Editar", onClick: () => setDrawerOportunidad(o) }]} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {o.empresa?.nombre ?? o.contacto?.nombre ?? "Sin empresa/contacto"}
                    </p>
                    {o.monto ? (
                      <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {formatMonto(o.monto)}
                      </p>
                    ) : null}
                    <select
                      value={o.etapa_id}
                      disabled={isPending && pendingId === o.id}
                      onChange={(e) => handleChangeEtapa(o.id, e.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {etapas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {!etapaItems.length ? (
                  <p className="px-1 py-4 text-center text-xs text-slate-400 dark:text-slate-500">Sin oportunidades</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Listado</h2>
        <button
          type="button"
          onClick={() => setDrawerOportunidad("new")}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Nueva oportunidad
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Título</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">
                Empresa / Contacto
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Etapa</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Responsable</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Monto</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((o) => {
              const etapa = etapas.find((e) => e.id === o.etapa_id);
              return (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDrawerOportunidad(o)}
                      className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                    >
                      {o.titulo}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {o.empresa?.nombre ?? o.contacto?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: etapa?.color ?? "#64748b" }}
                    >
                      {etapa?.nombre ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{o.responsable?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatMonto(o.monto)}</td>
                  <td className="px-2 py-3">
                    <KebabMenu items={[{ label: "Editar", onClick: () => setDrawerOportunidad(o) }]} />
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                  Todavía no hay oportunidades registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer
        open={drawerOportunidad !== null}
        onClose={closeDrawer}
        title={drawerOportunidad === "new" ? "Nueva oportunidad" : "Editar oportunidad"}
      >
        {drawerOportunidad !== null ? (
          <OportunidadForm
            oportunidad={drawerOportunidad === "new" ? undefined : drawerOportunidad}
            empresas={empresas}
            contactos={contactos}
            productos={productos}
            etapas={etapaOptions}
            perfiles={perfiles}
            onSaved={handleOportunidadSaved}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
