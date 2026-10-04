import { Boxes } from "lucide-react";
import { IconoEquipo } from "@/components/Equipamiento";
import { RelojRecambio } from "@/components/RelojRecambio";
import { Seccion } from "@/components/cliente";
import { Badge, Pill, type Tono } from "@/components/ui/UIComponents";
import { formatFecha } from "@/lib/clientes";
import { textoVidaUtil, type EstadoParque, type GrupoParque } from "@/lib/parque";

/**
 * Parque instalado: lo que la empresa nos compró, con la vida útil que le queda a
 * cada equipo, agrupado por urgencia. Los números salen de `agruparParque`
 * (src/lib/parque.ts), la misma cuenta que la vista `alertas_vida_util`, y el
 * reloj es el de /alertas. Sin estado ni hooks: lo dibuja igual el servidor y el cliente.
 */

const TONO: Record<EstadoParque, Tono> = {
  vencido: "rojo",
  por_vencer: "ambar",
  vigente: "verde",
  sin_seguimiento: "gris",
};

export function ParqueInstalado({ grupos }: { grupos: GrupoParque[] }) {
  const unidades = grupos.reduce((acc, g) => acc + g.unidades, 0);
  const vencidas = grupos.find((g) => g.estado === "vencido")?.unidades ?? 0;
  const porVencer = grupos.find((g) => g.estado === "por_vencer")?.unidades ?? 0;

  return (
    <Seccion icon={Boxes} titulo="Parque instalado" cantidad={unidades}>
      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay equipamiento instalado. Cuando cargues una venta con entrega, acá se ve lo que tiene este
          cliente y cuándo le toca el recambio.
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            <strong className="font-semibold tabular-nums text-foreground">{unidades}</strong>{" "}
            {unidades === 1 ? "unidad entregada" : "unidades entregadas"}
            {vencidas > 0 && (
              <>
                {" · "}
                <span className="font-medium text-destructive tabular-nums">{vencidas} para recambiar ya</span>
              </>
            )}
            {porVencer > 0 && (
              <>
                {" · "}
                <span className="tabular-nums">{porVencer} por vencer</span>
              </>
            )}
          </p>

          {grupos.map((g) => (
            <section key={g.estado} aria-label={`${g.titulo}: ${g.unidades} unidades`}>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Pill tono={TONO[g.estado]}>{g.titulo}</Pill>
                <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {g.unidades} {g.unidades === 1 ? "unidad" : "unidades"}
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {g.filas.map((f) => (
                  <li key={f.id} className="flex gap-3 py-3 first:pt-2 last:pb-0">
                    <IconoEquipo nombre={f.producto} categoria={f.categoria} tono={f.estado === "vencido" ? "rojo" : "brand"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                        <span className="min-w-0 break-words">{f.producto}</span>
                        <Badge variant="outline" className="tabular-nums">
                          ×{f.cantidad}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {f.fechaEntrega ? `Entregado el ${formatFecha(f.fechaEntrega)}` : "Sin fecha de entrega"}
                        {f.venceEl && f.vidaUtilMeses && ` · vida útil ${f.vidaUtilMeses} meses · vence ${formatFecha(f.venceEl)}`}
                      </p>
                      <p
                        className={
                          f.estado === "vencido"
                            ? "mt-0.5 text-xs font-semibold text-destructive"
                            : "mt-0.5 text-xs font-medium"
                        }
                      >
                        {textoVidaUtil(f)}
                      </p>
                      {f.diasRestantes != null && (
                        <RelojRecambio
                          entrega={f.fechaEntrega}
                          vence={f.venceEl}
                          dias={f.diasRestantes}
                          vencida={f.estado === "vencido"}
                          className="mt-2 sm:w-72"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Seccion>
  );
}
