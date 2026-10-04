"use client";

import * as React from "react";
import { Columns3, Eye, Info, SunMoon, KanbanSquare, List, Pencil, Phone, Plus, Save, Trash2, UserMinus } from "lucide-react";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import { Button, FilterChip, IconButton } from "@/components/crm/Button";
import { Checkbox, Field, Input, Radio, RadioGroup, Switch, Textarea } from "@/components/crm/Field";
import { Select, type SelectOption } from "@/components/crm/Select";
import { Menu } from "@/components/crm/Menu";
import { Popover } from "@/components/crm/Popover";
import { Tooltip } from "@/components/crm/Tooltip";
import { SegmentedControl, TabPanel, Tabs, type TabItem } from "@/components/crm/Tabs";
import { Drawer, FormSection } from "@/components/crm/Drawer";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { CrmToastProvider, useCrmToast } from "@/components/crm/Toast";
import { Pagination } from "@/components/crm/Pagination";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { DefinitionList } from "@/components/crm/Panel";
import {
  CellActions,
  CellDate,
  CellNumber,
  CellPerson,
  CellStatus,
  CellText,
  DataTable,
  TBody,
  THead,
  TableMessage,
  TableSkeleton,
  Td,
  Th,
  Tr,
} from "@/components/crm/DataTable";
import type { Tone } from "@/components/crm/Status";
import { FOCUS, TYPE, cn } from "@/components/crm/cx";

type Props = { tab: string; tabs: TabItem[]; page: number; sel: string; params: ParamsUrl };

export default function CrmLab(props: Props) {
  return (
    <CrmToastProvider>
      <Lab {...props} />
    </CrmToastProvider>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className={TYPE.section}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Fila de demo: etiqueta a la izquierda, ejemplos a la derecha. */
function Muestra({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-(--crm-border) py-3 last:border-b-0 md:grid-cols-[160px_1fr] md:items-center">
      <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>{etiqueta}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const COLORES = [
  "canvas", "panel", "panel-2", "hover", "selected", "border", "border-strong", "text", "text-2", "text-disabled",
  "accent", "accent-hover", "accent-text", "focus", "success", "warning", "danger", "info", "inverse", "skeleton",
];

const ETAPAS: SelectOption[] = [
  { value: "prospecto", label: "Prospecto", color: "#64748b" },
  { value: "propuesta", label: "Propuesta enviada", color: "#0ea5e9" },
  { value: "negociacion", label: "Negociación", color: "#7c3aed" },
  { value: "ganada", label: "Ganada", color: "#16a34a" },
  { value: "perdida", label: "Perdida", color: "#dc2626", disabled: true },
];

const PROVINCIAS = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa",
  "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta",
].map((p) => ({ value: p, label: p }));

type Fila = { id: string; nombre: string; tipo: string; estado: [string, Tone]; responsable: string | null; origen: string; contactos: number; alta: string };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FILAS: Fila[] = [
  { id: uuid(1), nombre: "Complejo La Tablada", tipo: "Complejo", estado: ["Cliente", "success"], responsable: "Lucía Ferreyra", origen: "Licitación", contactos: 4, alta: "2026-03-12" },
  { id: uuid(2), nombre: "Club Social y Deportivo Villa Ortúzar Juniors de la Comuna 15", tipo: "Club", estado: ["Potencial", "neutral"], responsable: "Martín Ibarra", origen: "Referido", contactos: 2, alta: "2026-05-02" },
  { id: uuid(3), nombre: "Polideportivo Municipal Merlo", tipo: "Municipio", estado: ["Cliente", "success"], responsable: null, origen: "Web", contactos: 7, alta: "2025-11-20" },
  { id: uuid(4), nombre: "Escuela N.º 14 D.E. 9", tipo: "Escuela", estado: ["Dada de baja", "danger"], responsable: "Sofía Benítez", origen: "Feria", contactos: 1, alta: "2025-08-01" },
  { id: uuid(5), nombre: "Fútbol 5 Los Andes", tipo: "Complejo", estado: ["En evaluación", "info"], responsable: "Lucía Ferreyra", origen: "Llamada", contactos: 3, alta: "2026-09-28" },
  { id: uuid(6), nombre: "Asociación Vecinal Barrio Norte", tipo: "Club", estado: ["Por vencer", "warning"], responsable: "Martín Ibarra", origen: "Licitación", contactos: 12, alta: "2024-02-15" },
];
const fecha = (ymd: string) => ymd.split("-").reverse().join("/");

/** Misma mecánica que ThemeToggle: clase `dark` en <html> y `localStorage.theme`. */
function cambiarTema() {
  const oscuro = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("theme", oscuro ? "dark" : "light");
  } catch {
    // modo privado: el cambio vale para esta sesión
  }
}

function Lab({ tab, tabs, page, sel, params }: Props) {
  const { showToast } = useCrmToast();
  const [drawer, setDrawer] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [confirmar, setConfirmar] = React.useState(false);
  const [estadoTabla, setEstadoTabla] = React.useState("datos");
  const [vista, setVista] = React.useState("lista");
  const [tabLocal, setTabLocal] = React.useState("todas");
  const [etapa, setEtapa] = React.useState("propuesta");
  const [provincia, setProvincia] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState("activo");
  const [filtroAbierto, setFiltroAbierto] = React.useState(false);
  const [responsable, setResponsable] = React.useState("");
  const [vistaRapida, setVistaRapida] = React.useState(false);
  const [nombre, setNombre] = React.useState("Complejo La Tablada");
  const [porPagina, setPorPagina] = React.useState("20");

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setTimeout(() => {
      setGuardando(false);
      setDrawer(false);
      showToast("Empresa guardada.", "success", 4000, { label: "Ver la ficha →", href: "/crm-lab?tab=actividad" });
    }, 900);
  };

  const accionesDe = (f: Fila) => [
    { label: "Ver ficha", icon: Eye, onSelect: () => showToast(`Abrir la ficha de ${f.nombre}.`) },
    { label: "Editar", icon: Pencil, onSelect: () => setDrawer(true) },
    { label: "Registrar actividad", icon: Phone, onSelect: () => showToast("Actividad registrada.", "success"), disabled: f.estado[0] === "Dada de baja" },
    { label: "Dar de baja", icon: UserMinus, variant: "danger" as const, onSelect: () => setConfirmar(true) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        {/* No se usa el ThemeToggle legacy: su `title=` lo reescribe el TooltipHost antes de que hidrate esta página. */}
        <Button icon={SunMoon} onClick={cambiarTema}>
          Cambiar tema
        </Button>
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Se guarda igual que el botón de tema del CRM.</p>
      </div>

      <Seccion id="lab-tokens" titulo="Tokens">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {COLORES.map((c) => (
            <div key={c} className="flex items-center gap-2 rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel) p-2">
              <span className="size-7 shrink-0 rounded-(--crm-radius-sm) border border-(--crm-border)" style={{ background: `var(--crm-${c})` }} />
              <code className={cn(TYPE.mono, "truncate text-[12px]")}>--crm-{c}</code>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-3">
          <p className={TYPE.kpi}>$ 12.480.300</p>
          <p className={TYPE.title}>Título de página · 20 / 600</p>
          <p className={TYPE.section}>Sección · 16 / 600</p>
          <p className={TYPE.ui}>Interfaz base · 14 / 400 — Registrá la actividad y seguí la oportunidad.</p>
          <p className={TYPE.table}>Cuerpo de tabla · 13 / 400 — Complejo La Tablada · 30-71234567-9</p>
          <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Meta · 12 / 400 — Actualizado hace 5 min</p>
          <p className={TYPE.th}>Cabecera de tabla · 12 / 500, sentence case</p>
          <p className={cn(TYPE.mono, "text-[13px]")}>Mono · 0123456789 · OP-2026-0042</p>
        </div>
      </Seccion>

      <Seccion id="lab-botones" titulo="Botones">
        <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3">
          {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
            <Muestra key={v} etiqueta={v}>
              <Button variant={v} size="sm">Chico 28</Button>
              <Button variant={v}>Normal 32</Button>
              <Button variant={v} size="lg">Grande 36</Button>
              <Button variant={v} icon={v === "danger" ? Trash2 : Plus}>Con ícono</Button>
              <Button variant={v} loading>Guardando…</Button>
              <Button variant={v} disabled>Deshabilitado</Button>
            </Muestra>
          ))}
          <Muestra etiqueta="IconButton">
            <Tooltip content="Editar empresa">
              <IconButton label="Editar empresa" icon={Pencil} />
            </Tooltip>
            <IconButton label="Llamar" icon={Phone} variant="secondary" />
            <IconButton label="Editar (chico)" icon={Pencil} size="sm" />
            <IconButton label="Deshabilitado" icon={Trash2} disabled />
          </Muestra>
        </div>
      </Seccion>

      <Seccion id="lab-form" titulo="Formulario">
        <div className="grid gap-x-6 gap-y-4 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-4 md:grid-cols-2">
          <Field id="lab-nombre" label="Nombre" required help="Como figura en la factura.">
            {(p) => <Input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
          </Field>
          <Field id="lab-email" label="Email" error="Ingresá un email válido.">
            {(p) => <Input {...p} type="email" defaultValue="compras@latablada" />}
          </Field>
          <Field id="lab-placeholder" label="Buscar">
            {(p) => <Input {...p} placeholder="Buscar empresa o contacto" />}
          </Field>
          <Field id="lab-deshabilitado" label="CUIT (deshabilitado)">
            {(p) => <Input {...p} disabled defaultValue="30-71234567-9" className="font-(family-name:--crm-font-mono)" />}
          </Field>
          <Field id="lab-etapa" label="Etapa">
            {(p, labelId) => (
              <Select id={p.id} aria-labelledby={labelId} aria-describedby={p["aria-describedby"]} value={etapa} onChange={setEtapa} options={ETAPAS} />
            )}
          </Field>
          <Field id="lab-provincia" label="Provincia (con buscador)" help="Más de 8 opciones: aparece el buscador.">
            {(p, labelId) => (
              <Select id={p.id} aria-labelledby={labelId} aria-describedby={p["aria-describedby"]} value={provincia} onChange={setProvincia} options={PROVINCIAS} placeholder="Elegí una provincia" />
            )}
          </Field>
          <Field id="lab-tipo" label="Tipo" required error="Elegí un tipo.">
            {(p, labelId) => (
              <Select
                id={p.id}
                aria-labelledby={labelId}
                aria-describedby={p["aria-describedby"]}
                aria-invalid={p["aria-invalid"]}
                required={p.required}
                value={tipo}
                onChange={setTipo}
                options={["Club", "Complejo", "Escuela", "Municipio"].map((t) => ({ value: t, label: t }))}
              />
            )}
          </Field>
          <Field id="lab-select-off" label="Select deshabilitado">
            {(p, labelId) => <Select id={p.id} aria-labelledby={labelId} value="ganada" onChange={() => {}} options={ETAPAS} disabled />}
          </Field>
          <Field id="lab-notas" label="Notas" className="md:col-span-2">
            {(p) => <Textarea {...p} placeholder="Qué se habló, próximos pasos…" />}
          </Field>
          <div className="flex flex-col gap-2">
            <Checkbox id="lab-check-1" label="Enviar aviso por email" description="Al responsable de la cuenta." defaultChecked />
            <Checkbox id="lab-check-2" label="Ver dadas de baja" />
            <Checkbox id="lab-check-3" label="Deshabilitado" disabled />
            <Switch id="lab-switch-1" label="Recordatorio activo" defaultChecked />
            <Switch id="lab-switch-2" label="Interruptor deshabilitado" disabled />
          </div>
          <RadioGroup legend="Prioridad">
            <Radio id="lab-r-alta" name="lab-prioridad" label="Alta" />
            <Radio id="lab-r-media" name="lab-prioridad" label="Media" defaultChecked />
            <Radio id="lab-r-baja" name="lab-prioridad" label="Baja" description="Sin seguimiento semanal." />
            <Radio id="lab-r-off" name="lab-prioridad-off" label="Deshabilitado" disabled />
          </RadioGroup>
        </div>
      </Seccion>

      <Seccion id="lab-nav" titulo="Navegación">
        <div className="flex flex-col gap-4 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-4">
          <div>
            <p className={cn(TYPE.meta, "mb-1 text-(--crm-text-2)")}>Tabs por URL (<code>?tab=</code>): ←/→ mueven el foco, Enter navega.</p>
            <Tabs id="lab-ficha" label="Secciones de la ficha" items={tabs} value={tab} />
            <TabPanel tabsId="lab-ficha" value={tab} className="py-3">
              <p>
                Panel de <strong>{tabs.find((t) => t.value === tab)?.label}</strong>: lo dibuja el servidor según <code>?tab=</code>. Atrás y
                adelante del navegador cambian de tab.
              </p>
            </TabPanel>
          </div>
          <div>
            <p className={cn(TYPE.meta, "mb-1 text-(--crm-text-2)")}>Tabs controladas: las flechas mueven y activan.</p>
            <Tabs
              id="lab-alertas"
              label="Filtro de alertas"
              value={tabLocal}
              onValueChange={setTabLocal}
              items={[
                { value: "todas", label: "Todas", count: 24 },
                { value: "vencidas", label: "Vencidas", count: 5 },
                { value: "por-vencer", label: "Por vencer", count: 9 },
                { value: "sin-avisar", label: "Sin avisar", count: 3 },
                { value: "archivadas", label: "Archivadas", disabled: true },
              ]}
            />
            <TabPanel tabsId="lab-alertas" value={tabLocal} className="py-3">
              Mostrando alertas: {tabLocal}.
            </TabPanel>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Vista"
              value={vista}
              onValueChange={setVista}
              items={[
                { value: "tablero", label: "Tablero", icon: KanbanSquare },
                { value: "lista", label: "Lista", icon: List },
              ]}
            />
            <SegmentedControl
              label="Estado de la grilla (demo)"
              size="sm"
              value={estadoTabla}
              onValueChange={setEstadoTabla}
              items={[
                { value: "datos", label: "Con datos" },
                { value: "cargando", label: "Cargando" },
                { value: "vacio", label: "Vacía" },
                { value: "error", label: "Error" },
              ]}
            />
            <span className={cn(TYPE.meta, "text-(--crm-text-2)")}>← el segundo control cambia el estado de la grilla de abajo.</span>
          </div>
        </div>
      </Seccion>

      <Seccion id="lab-datos" titulo="Grilla de datos">
        <div className="flex flex-wrap items-center gap-2">
          <Input dense aria-label="Buscar empresa o contacto" placeholder="Buscar empresa o contacto" className="w-64" />
          <Popover
            label="Filtrar por estado"
            open={filtroAbierto}
            onOpenChange={setFiltroAbierto}
            trigger={<FilterChip label="Estado" value={filtroEstado === "activo" ? "Activo" : filtroEstado === "baja" ? "Dado de baja" : undefined} />}
          >
            <RadioGroup legend="Estado">
              {[
                ["", "Todos"],
                ["activo", "Activo"],
                ["baja", "Dado de baja"],
              ].map(([v, l]) => (
                <Radio key={v} id={`lab-fe-${v || "todos"}`} name="lab-filtro-estado" label={l} checked={filtroEstado === v} onChange={() => setFiltroEstado(v)} />
              ))}
            </RadioGroup>
            <div className="mt-3 flex justify-end gap-2 border-t border-(--crm-border) pt-3">
              <Button size="sm" variant="ghost" onClick={() => setFiltroEstado("")}>
                Limpiar
              </Button>
              <Button size="sm" variant="primary" onClick={() => setFiltroAbierto(false)}>
                Aplicar
              </Button>
            </div>
          </Popover>
          <Popover label="Filtrar por responsable" trigger={<FilterChip label="Responsable" value={responsable || undefined} />}>
            <Field id="lab-fr" label="Responsable">
              {(p, labelId) => (
                <Select
                  id={p.id}
                  aria-labelledby={labelId}
                  value={responsable}
                  onChange={setResponsable}
                  placeholder="Todos"
                  options={["Lucía Ferreyra", "Martín Ibarra", "Sofía Benítez"].map((n) => ({ value: n, label: n }))}
                />
              )}
            </Field>
          </Popover>
          <Menu label="Más acciones de la lista" items={[{ label: "Exportar CSV", onSelect: () => showToast("Exportación lista.", "info") }, { label: "Imprimir", onSelect: () => window.print() }]} size="sm">
            <Columns3 aria-hidden="true" />
            Más acciones
          </Menu>
          <div className="ml-auto">
            <Button variant="primary" icon={Plus} onClick={() => setDrawer(true)}>
              Nueva empresa
            </Button>
          </div>
        </div>

        <DataTable label="Empresas" busy={estadoTabla === "cargando"} className="max-h-[420px]">
          <THead>
            <Th>Empresa</Th>
            <Th width={120} hideBelow="sm">Tipo</Th>
            <Th width={140}>Estado</Th>
            <Th width={180} hideBelow="md">Responsable</Th>
            <Th width={120} hideBelow="lg">Origen</Th>
            <Th width={96} align="right" hideBelow="md">Contactos</Th>
            <Th width={104} hideBelow="lg">Alta</Th>
            <Th width={112}>
              <span className="sr-only">Acciones</span>
            </Th>
          </THead>
          <TBody>
            {estadoTabla === "cargando" ? (
              <TableSkeleton columns={8} rows={6} label="Cargando empresas…" />
            ) : estadoTabla === "vacio" ? (
              <TableMessage colSpan={8}>
                <EmptyState
                  compact
                  title="No hay empresas que coincidan con «la tablada»."
                  description="Probá con otro nombre o limpiá los filtros."
                  action={<Button size="sm">Limpiar filtros</Button>}
                />
              </TableMessage>
            ) : estadoTabla === "error" ? (
              <TableMessage colSpan={8}>
                <div className="p-3">
                  <InlineBanner tone="danger" title="No se pudo cargar la lista." action={<Button size="sm">Reintentar</Button>}>
                    El servidor no respondió. Tus filtros se conservan.
                  </InlineBanner>
                </div>
              </TableMessage>
            ) : (
              FILAS.map((f) => (
                <Tr key={f.id} selected={f.id === sel}>
                  <Td>
                    <CellText href={urlConParams("/crm-lab", params, { sel: f.id === sel ? null : f.id })} secondary={f.tipo === "Club" ? "Comuna 15" : undefined}>
                      {f.nombre}
                    </CellText>
                  </Td>
                  <Td hideBelow="sm">{f.tipo}</Td>
                  <Td>
                    <CellStatus tone={f.estado[1]}>{f.estado[0]}</CellStatus>
                  </Td>
                  <Td hideBelow="md">
                    <CellPerson name={f.responsable} />
                  </Td>
                  <Td hideBelow="lg">{f.origen}</Td>
                  <Td align="right" hideBelow="md">
                    <CellNumber unit="ctos.">{f.contactos}</CellNumber>
                  </Td>
                  <Td hideBelow="lg">
                    <CellDate dateTime={f.alta}>{fecha(f.alta)}</CellDate>
                  </Td>
                  <Td align="right">
                    <CellActions menu={<Menu label={`Acciones de ${f.nombre}`} items={accionesDe(f)} size="sm" />}>
                      <IconButton label={`Editar ${f.nombre}`} icon={Pencil} size="sm" onClick={() => setDrawer(true)} />
                      <IconButton label={`Registrar actividad de ${f.nombre}`} icon={Phone} size="sm" onClick={() => showToast("Actividad registrada.", "success")} />
                    </CellActions>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </DataTable>
        <Pagination
          total={134}
          page={page}
          pageSize={Number(porPagina)}
          pathname="/crm-lab"
          params={params}
          pageSizeControl={
            <Select
              dense
              aria-label="Filas por página"
              value={porPagina}
              onChange={setPorPagina}
              options={["10", "20", "50"].map((n) => ({ value: n, label: `${n} por página` }))}
              className="w-36"
            />
          }
        />
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          Clic en un nombre: selecciona la fila por URL (<code>?sel=</code>), como el master-detail de la Etapa 3. Las columnas se esconden por ancho
          del contenedor.
        </p>
      </Seccion>

      <Seccion id="lab-capas" titulo="Capas">
        <div className="flex flex-wrap items-center gap-2 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-4">
          <Button onClick={() => setDrawer(true)}>Abrir drawer</Button>
          <Button onClick={() => setVistaRapida(true)}>Vista rápida (sin footer)</Button>
          <Button variant="danger" icon={UserMinus} onClick={() => setConfirmar(true)}>
            Dar de baja…
          </Button>
          <Menu label="Acciones de Complejo La Tablada" items={accionesDe(FILAS[0])} />
          <Button onClick={() => showToast("Oportunidad marcada como Perdida.", "success")}>Aviso de éxito</Button>
          <Button onClick={() => showToast("No se pudo guardar: revisá tu conexión.", "error", 6000)}>Aviso de error</Button>
          <Button onClick={() => showToast("La alerta vence mañana.", "warning")}>Aviso de atención</Button>
          <Button onClick={() => showToast("Se envió el resumen por email.", "info", 4000, { label: "Ver alertas →", href: "/crm-lab" })}>
            Aviso con link
          </Button>
          <Tooltip content="Último contacto: 02/10/2026 por Lucía Ferreyra">
            <span tabIndex={0} className={cn("rounded-(--crm-radius-sm) border-b border-dotted border-(--crm-text-2) text-(--crm-text-2)", FOCUS)}>
              Hace 2 días
            </span>
          </Tooltip>
        </div>
      </Seccion>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Nueva empresa"
        description="Los campos con * son obligatorios."
        onSubmit={guardar}
        busy={guardando}
        footer={
          <>
            <Button onClick={() => setDrawer(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" icon={Save} loading={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormSection title="Identificación">
            <Field id="nombre" label="Nombre" required>
              {(p) => <Input {...p} defaultValue="" autoComplete="off" />}
            </Field>
            <Field id="cuit" label="CUIT" help="Sin guiones.">
              {(p) => (
                <div className="flex items-center gap-2">
                  <Input {...p} inputMode="numeric" className="font-(family-name:--crm-font-mono)" />
                  <Tooltip content="Se valida con el dígito verificador.">
                    <IconButton label="Cómo se valida el CUIT" icon={Info} size="sm" />
                  </Tooltip>
                </div>
              )}
            </Field>
            <Field id="tipo" label="Tipo">
              {(p, labelId) => <Select id={p.id} aria-labelledby={labelId} value={tipo} onChange={setTipo} options={["Club", "Complejo", "Escuela", "Municipio"].map((t) => ({ value: t, label: t }))} />}
            </Field>
          </FormSection>
          <FormSection title="Contacto">
            <Field id="telefono" label="Teléfono">
              {(p) => <Input {...p} type="tel" />}
            </Field>
            <Field id="notas" label="Notas">
              {(p) => <Textarea {...p} rows={4} />}
            </Field>
          </FormSection>
        </div>
      </Drawer>

      {/* Drawer sin footer cuyo último enfocable es el disparador de un menú: prueba de la cerca de foco. */}
      <Drawer open={vistaRapida} onClose={() => setVistaRapida(false)} title="Vista rápida de Complejo La Tablada" description="Cliente desde 03/2026">
        <div className="flex flex-col gap-4">
          <DefinitionList
            columns={1}
            items={[
              { term: "Responsable", value: "Lucía Ferreyra" },
              { term: "CUIT", value: "30-71234567-9", mono: true },
              { term: "Contactos", value: "4" },
            ]}
          />
          <div className="flex items-center justify-between border-t border-(--crm-border) pt-3">
            <span className={cn(TYPE.meta, "text-(--crm-text-2)")}>Más acciones</span>
            <Menu label="Acciones de la vista rápida" items={accionesDe(FILAS[0])} />
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={() => new Promise<void>((r) => setTimeout(r, 1200)).then(() => showToast("La empresa quedó dada de baja.", "success"))}
        title="Dar de baja la empresa"
        description="Va a dejar de aparecer en las listas. Sus oportunidades y ventas se conservan y la podés reactivar cuando quieras."
        confirmText="Dar de baja"
        variant="danger"
      />
    </div>
  );
}
