import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { getSesion } from "@/lib/sesion";
import DefinirClaveForm from "./DefinirClaveForm";

export const metadata = { title: "Definir contraseña" };

/**
 * Se llega desde el link del mail, que ya abrio la sesion en /auth/confirm.
 * Sin sesion (link viejo o pestaña reabierta), no hay nada que hacer aca.
 */
export default async function DefinirClavePage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");

  const { modo } = await searchParams;
  const activar = modo === "activar";
  const nombre = sesion.perfil?.nombre?.split(/\s+/)[0];

  return (
    <AuthCard
      titulo={activar ? `¡Hola${nombre ? `, ${nombre}` : ""}!` : "Elegí una nueva contraseña"}
      bajada={
        activar
          ? `Elegí tu contraseña para activar tu cuenta${
              sesion.organizacion ? ` en ${sesion.organizacion.nombre}` : ""
            }.`
          : "Después vas a ingresar con tu email y esta contraseña."
      }
      volver={false}
    >
      <DefinirClaveForm textoBoton={activar ? "Activar mi cuenta" : "Guardar contraseña"} />
    </AuthCard>
  );
}
