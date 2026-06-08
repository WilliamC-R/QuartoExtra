import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GESTOR_DEFAULT = "/dashboard";
const CLIENTE_DEFAULT = "/meu-imovel";

const GESTOR_ONLY = [
  "/dashboard", "/mapa", "/imoveis", "/garagens",
  "/reservas", "/relatorios", "/importar", "/integracoes", "/contas",
];

const CLIENTE_ONLY = ["/meu-imovel"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    // Perfil não existe → conta incompleta, forçar logout
    if (!profile) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const role = profile.role as "gestor" | "cliente";

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = role === "cliente" ? CLIENTE_DEFAULT : GESTOR_DEFAULT;
      return NextResponse.redirect(url);
    }

    // Block cliente from gestor-only pages
    if (role === "cliente" && GESTOR_ONLY.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = CLIENTE_DEFAULT;
      return NextResponse.redirect(url);
    }

    // Block gestor from cliente-only pages
    if (role === "gestor" && CLIENTE_ONLY.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = GESTOR_DEFAULT;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
