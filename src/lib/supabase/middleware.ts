import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Rutas que se sirven sin sesion.
 *
 * `/` (la landing) NO puede estar en esta lista: el chequeo de abajo usa
 * `startsWith`, y TODO pathname empieza con "/", asi que agregarlo abriria la
 * app entera. Por eso la home se compara aparte, por igualdad exacta.
 */
const PUBLIC_PREFIXES = ["/login", "/recuperar"];

/**
 * Publicas que NO rebotan a /dashboard con sesion: /auth/confirm canjea el
 * token del mail, y si un admin prueba un link de invitacion en su propio
 * navegador (ya logueado), rebotarlo impediria canjearlo.
 */
const PASSTHROUGH_PREFIXES = ["/auth/confirm"];

/**
 * Rutas publicas que ademas NO rebotan a /dashboard cuando ya hay sesion: la
 * landing tiene que poder verse estando logueado (el boton cambia a "Ir al
 * CRM"), a diferencia de /login, donde quedarse logueado no tiene sentido.
 */
function esLanding(pathname: string) {
  return pathname === "/";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPath = PUBLIC_PREFIXES.some((path) => pathname.startsWith(path));
  const isPublic =
    isAuthPath || esLanding(pathname) || PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
