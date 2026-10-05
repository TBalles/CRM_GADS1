import * as React from "react";
import Link from "next/link";
import { DataTable, TBody, THead, Td, Th, Tr, CellDate, CellNumber, CellText } from "../DataTable";
import { EmptyState } from "../Feedback";
import { SectionBar } from "../PageBar";
import { DefinitionList, type Definition } from "../Panel";
import { StatStrip, type Stat } from "../StatStrip";
import { FOCUS, TYPE, cn } from "../cx";
import { EstadoOportunidad } from "./estados";
import { MovimientosRecientes, type FuentesHistoria } from "./HistoriaCuenta";
import { formatFecha } from "@/lib/clientes";
import { TOPES, type EtapaCuenta, type OportunidadCuenta, type VentaCuenta } from "@/lib/cuenta360";
import { formatMoney } from "@/lib/money";

/**
 * Secciones de la ficha 360 y de la vista previa que comparten empresa y contacto (MASTER.md §10.13–§10.14): mismas
 * tablas, mismos vacíos y mismos topes. Sin "use client" ni hooks: las dibuja la ficha (cliente) o la vista previa
 * (servidor). Los datos los trae quien llama (`leerCuenta360`).
 */

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);
const LINK_TEXTO = cn("rounded-[2px] underline-offset-2 hover:underline", FOCUS);

/** Monto en pesos: símbolo en gris, cifra mono; sin monto, "—". */
export function Monto({ valor }: { valor: number }) {
  if (!valor) return <span className="text-(--crm-text-2)">—</span>;
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

/** "Resumen de la cuenta": la franja de cifras sin título visible (el h2 y la nota quedan para lectores de pantalla). */
export function ResumenStats({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-labelledby="resumen-cuenta">
      <h2 id="resumen-cuenta" className="sr-only">
        Resumen de la cuenta
      </h2>
      <p id="resumen-cuenta-nota" className="sr-only">
        Calculado con lo que está cargado en el CRM, sin estimaciones.
      </p>
      <StatStrip items={stats} describedBy="resumen-cuenta-nota" />
    </section>
  );
}

/** Oportunidades abiertas del Resumen: tabla (oportunidad, etapa, monto) y "Ver todas" a la tab. */
export function OportunidadesAbiertas({
  oportunidades,
  etapas,
  verTodas,
}: {
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  /** Link a la tab de oportunidades (solo si hay alguna, abierta o no). */
  verTodas: string;
}) {
  const abiertas = oportunidades.filter((o) => o.estado === "abierta");
  const nombreEtapa = new Map(etapas.map((e) => [e.id, e.nombre]));
  return (
    <section className="flex min-w-0 flex-col">
      <SectionBar
        title="Oportunidades abiertas"
        count={abiertas.length}
        actions={
          oportunidades.length > 0 && (
            <Link href={verTodas} className={cn(TYPE.table, LINK)}>
              Ver todas
            </Link>
          )
        }
      />
      {abiertas.length ? (
        <DataTable label="Oportunidades abiertas">
          <THead>
            <Th>Oportunidad</Th>
            <Th width={200} hideBelow="sm">
              Etapa
            </Th>
            <Th width={136} align="right">
              Monto
            </Th>
          </THead>
          <TBody>
            {abiertas.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <CellText href={`/oportunidades/${o.id}`}>{o.titulo}</CellText>
                </Td>
                <Td hideBelow="sm">{nombreEtapa.get(o.etapa_id) ?? <span className="text-(--crm-text-2)">Sin etapa</span>}</Td>
                <Td align="right">
                  <Monto valor={o.monto ? Number(o.monto) : 0} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      ) : (
        <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Ninguna abierta.</p>
      )}
    </section>
  );
}

/** "Actividad reciente" del Resumen: los 5 últimos movimientos y "Ver toda la actividad". */
export function ActividadReciente({ href, fuentes }: { href: string; fuentes: FuentesHistoria }) {
  return (
    <section className="flex min-w-0 flex-col">
      <SectionBar
        title="Actividad reciente"
        actions={
          <Link href={href} className={cn(TYPE.table, LINK)}>
            Ver toda la actividad
          </Link>
        }
      />
      <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3">
        <MovimientosRecientes limite={5} {...fuentes} />
      </div>
    </section>
  );
}

/** Riel de propiedades del Resumen (desde 1280): "Datos" en una columna, término a la izquierda, + Observaciones. */
export function RielDatos({ label, items, notas }: { label: string; items: Definition[]; notas: string | null }) {
  return (
    <aside aria-label={label} className="flex min-w-0 flex-col border-(--crm-border) xl:border-l xl:pl-6">
      <SectionBar title="Datos" />
      <DefinitionList inline columns={1} items={items} />
      {notas && (
        <div className="mt-3 flex flex-col gap-1">
          <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Observaciones</p>
          <p className="max-w-prose whitespace-pre-line text-[13px] leading-[1.55]">{notas}</p>
        </div>
      )}
    </aside>
  );
}

/** Tab "Oportunidades": todas (con estado), con "+" y el aviso si la lectura llegó al tope. */
export function OportunidadesTab({
  label,
  oportunidades,
  etapas,
  truncado,
}: {
  /** Nombre accesible de la tabla ("Oportunidades de la empresa"). */
  label: string;
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  truncado: boolean;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <SectionBar title="Oportunidades" count={truncado ? `${oportunidades.length}+` : oportunidades.length} />
      <DataTable label={label}>
        <THead>
          <Th>Oportunidad</Th>
          <Th width={200} hideBelow="sm">
            Etapa
          </Th>
          <Th width={112}>Estado</Th>
          <Th width={136} align="right">
            Monto
          </Th>
        </THead>
        <TBody>
          {oportunidades.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-0">
                <EmptyState
                  compact
                  title="Todavía no hay oportunidades."
                  description={
                    <>
                      Se cargan desde{" "}
                      <Link href="/oportunidades" className={LINK}>
                        Oportunidades
                      </Link>
                      .
                    </>
                  }
                />
              </td>
            </tr>
          ) : (
            oportunidades.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <CellText href={`/oportunidades/${o.id}`}>{o.titulo}</CellText>
                </Td>
                <Td hideBelow="sm">{etapas.find((e) => e.id === o.etapa_id)?.nombre ?? <span className="text-(--crm-text-2)">Sin etapa</span>}</Td>
                <Td>
                  <EstadoOportunidad estado={o.estado} />
                </Td>
                <Td align="right">
                  <Monto valor={o.monto ? Number(o.monto) : 0} />
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </DataTable>
      {truncado && <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>Se muestran las {TOPES.oportunidades} más recientes.</p>}
    </section>
  );
}

/** Tab "Ventas": fecha, comprobante y total, con "+" y el aviso si la lectura llegó al tope. */
export function VentasTab({ label, ventas, truncado }: { label: string; ventas: VentaCuenta[]; truncado: boolean }) {
  return (
    <section className="flex min-w-0 flex-col">
      <SectionBar title="Ventas" count={truncado ? `${ventas.length}+` : ventas.length} />
      <DataTable label={label}>
        <THead>
          <Th width={120}>Fecha</Th>
          <Th>Comprobante</Th>
          <Th width={160} align="right">
            Total
          </Th>
        </THead>
        <TBody>
          {ventas.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-0">
                <EmptyState
                  compact
                  title="Todavía no compró."
                  description={
                    <>
                      Las entregas se cargan desde{" "}
                      <Link href="/ventas" className={LINK}>
                        Ventas
                      </Link>
                      .
                    </>
                  }
                />
              </td>
            </tr>
          ) : (
            ventas.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <CellDate dateTime={v.fecha}>{formatFecha(v.fecha)}</CellDate>
                </Td>
                <Td>{v.comprobante ? <span className={TYPE.mono}>{v.comprobante}</span> : <span className="text-(--crm-text-2)">—</span>}</Td>
                <Td align="right">
                  <Monto valor={v.total} />
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </DataTable>
      {truncado && <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>Se muestran las {TOPES.ventas} más recientes.</p>}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Vista previa
   ------------------------------------------------------------------------ */

/** Cuántas oportunidades y movimientos entran en la vista previa: el panel cabe sin scroll en 1440 × 900. */
export const TOPE_PREVIA = 3;

/** Hasta 3 oportunidades abiertas (título, etapa, monto) en la vista previa. */
export function OportunidadesPrevia({ abiertas, etapas }: { abiertas: OportunidadCuenta[]; etapas: EtapaCuenta[] }) {
  const nombreEtapa = new Map(etapas.map((e) => [e.id, e.nombre]));
  return (
    <section>
      <SectionBar as="h3" title="Oportunidades abiertas" count={abiertas.length} className="h-8" />
      {abiertas.length ? (
        <ul className="border-t border-(--crm-border)">
          {abiertas.slice(0, TOPE_PREVIA).map((o) => (
            <li key={o.id} className={cn(TYPE.table, "flex h-8 items-center gap-2 border-b border-(--crm-border)")}>
              <Link href={`/oportunidades/${o.id}`} className={cn(LINK_TEXTO, "min-w-0 truncate font-medium")}>
                {o.titulo}
              </Link>
              <span className="min-w-0 flex-1 truncate text-(--crm-text-2)">{nombreEtapa.get(o.etapa_id)}</span>
              <span className={cn(TYPE.mono, "shrink-0")}>
                {o.monto ? (
                  <>
                    <span className={TYPE.unit}>$</span> {formatMoney(Number(o.monto)).replace(/^\$/, "")}
                  </>
                ) : (
                  <span className="text-(--crm-text-2)">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Ninguna abierta.</p>
      )}
    </section>
  );
}

/** Los 3 últimos movimientos en la vista previa, con "Ver toda la actividad" (la tab de la ficha). */
export function MovimientosPrevia({ href, fuentes }: { href: string; fuentes: FuentesHistoria }) {
  return (
    <section>
      <SectionBar
        as="h3"
        title="Últimos movimientos"
        className="h-8"
        actions={
          <Link href={href} className={cn(TYPE.table, LINK)}>
            Ver toda la actividad
          </Link>
        }
      />
      <div className="border-t border-(--crm-border)">
        <MovimientosRecientes limite={TOPE_PREVIA} {...fuentes} />
      </div>
    </section>
  );
}
