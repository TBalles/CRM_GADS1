import { DetailSkeleton } from "@/components/crm/Skeletons";

/** Carga de la ficha de oportunidad: franja de identidad + recorrido por el embudo + historial y riel "Datos" (MASTER.md §9.1). */
export default function CargandoOportunidad() {
  return <DetailSkeleton pasos={5} />;
}
