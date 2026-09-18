import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los links de los mails (activacion y recuperacion).
 *
 * Canjea el `token_hash` por una sesion con `verifyOtp`, que deja la cookie
 * seteada, y redirige a `next`. El token es de un solo uso: un segundo clic
 * cae en el error y la persona puede pedir otro.
 */

const TIPOS_VALIDOS: EmailOtpType[] = ["magiclink", "recovery"];

/**
 * `next` solo puede ser una ruta INTERNA. Sin este chequeo, alguien podria
 * mandar un link nuestro real con `next=https://sitio-falso.com`: un link
 * legitimo de nuestro dominio que termina en un sitio de phishing (open
 * redirect). `//dominio` y `/\dominio` tambien los interpretan los navegadores
 * como otro sitio.
 */
function destinoSeguro(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const destino = destinoSeguro(searchParams.get("next"));

  if (tokenHash && type && TIPOS_VALIDOS.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
    console.error("[auth/confirm] verifyOtp fallo:", error.message);
  }

  const login = new URL("/login", request.url);
  login.searchParams.set(
    "error",
    "El link venció o ya se usó. Ingresá tu email abajo o pedí uno nuevo desde «¿Olvidaste tu contraseña?».",
  );
  return NextResponse.redirect(login);
}
