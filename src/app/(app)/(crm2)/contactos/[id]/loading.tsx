import { DetailSkeleton } from "@/components/crm/Skeletons";

/** Carga de la ficha de contacto: franja de identidad + tabs + Resumen en esqueleto (MASTER.md §9.1). */
export default function CargandoFicha() {
  return <DetailSkeleton tabs={["w-16", "w-16", "w-24", "w-14"]} />;
}
