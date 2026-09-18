import AuthCard from "@/components/AuthCard";
import RecuperarForm from "./RecuperarForm";

export const metadata = { title: "Recuperar acceso" };

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      titulo="¿Olvidaste tu contraseña?"
      bajada="Ingresá tu email y te mandamos un link para elegir una nueva."
    >
      <RecuperarForm emailInicial={email} />
    </AuthCard>
  );
}
