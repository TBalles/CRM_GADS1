"use client";

import { useState } from "react";
import Drawer from "@/components/Drawer";
import KebabMenu from "@/components/KebabMenu";
import EmpresaForm from "./EmpresaForm";
import ContactoForm from "./ContactoForm";
import type { Tables } from "@/lib/supabase/types";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;

type DrawerState =
  | { type: "empresa"; mode: "create" }
  | { type: "empresa"; mode: "edit"; empresa: Empresa }
  | { type: "contacto"; mode: "create"; empresaId: string }
  | { type: "contacto"; mode: "edit"; contacto: Contacto };

export default function EmpresasList({
  empresas,
  contactos,
}: {
  empresas: Empresa[];
  contactos: Contacto[];
}) {
  const [empresasState, setEmpresasState] = useState(empresas);
  const [contactosState, setContactosState] = useState(contactos);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  function closeDrawer() {
    setDrawer(null);
  }

  function handleEmpresaSaved(saved: Empresa) {
    setEmpresasState((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved];
      return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
    closeDrawer();
  }

  function handleContactoSaved(saved: Contacto) {
    setContactosState((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
    });
    closeDrawer();
  }

  return (
    <div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setDrawer({ type: "empresa", mode: "create" })}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Nueva empresa
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {empresasState.map((empresa) => {
          const empresaContactos = contactosState.filter((c) => c.empresa_id === empresa.id);
          const expanded = expandedId === empresa.id;

          return (
            <div
              key={empresa.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : empresa.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(expanded ? null : empresa.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{empresa.nombre}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {[empresa.cuit, empresa.telefono, empresa.email].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {empresaContactos.length} contacto{empresaContactos.length === 1 ? "" : "s"}
                </span>
                <span onClick={(e) => e.stopPropagation()}>
                  <KebabMenu
                    items={[
                      {
                        label: "Editar",
                        onClick: () => setDrawer({ type: "empresa", mode: "edit", empresa }),
                      },
                    ]}
                  />
                </span>
              </div>

              {expanded ? (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {empresaContactos.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {c.nombre} {c.apellido ?? ""}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {[c.cargo, c.email, c.telefono].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                          </p>
                        </div>
                        <KebabMenu
                          items={[
                            {
                              label: "Editar",
                              onClick: () => setDrawer({ type: "contacto", mode: "edit", contacto: c }),
                            },
                          ]}
                        />
                      </li>
                    ))}
                    {!empresaContactos.length ? (
                      <li className="py-2 text-sm text-slate-400 dark:text-slate-500">Sin contactos asociados.</li>
                    ) : null}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setDrawer({ type: "contacto", mode: "create", empresaId: empresa.id })}
                    className="mt-2 text-sm font-medium text-slate-600 hover:underline dark:text-slate-300"
                  >
                    + Agregar contacto
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {!empresasState.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Todavía no hay empresas registradas.
          </p>
        ) : null}
      </div>

      <Drawer
        open={drawer?.type === "empresa"}
        onClose={closeDrawer}
        title={drawer?.type === "empresa" && drawer.mode === "edit" ? "Editar empresa" : "Nueva empresa"}
      >
        {drawer?.type === "empresa" ? (
          <EmpresaForm
            empresa={drawer.mode === "edit" ? drawer.empresa : undefined}
            onSaved={handleEmpresaSaved}
          />
        ) : null}
      </Drawer>

      <Drawer
        open={drawer?.type === "contacto"}
        onClose={closeDrawer}
        title={drawer?.type === "contacto" && drawer.mode === "edit" ? "Editar contacto" : "Nuevo contacto"}
      >
        {drawer?.type === "contacto" ? (
          <ContactoForm
            contacto={drawer.mode === "edit" ? drawer.contacto : undefined}
            empresaId={drawer.mode === "create" ? drawer.empresaId : undefined}
            empresas={empresasState}
            onSaved={handleContactoSaved}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
