import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that work without a session.
// /mcp checks its own bearer token; /.well-known tells connectors where to sign in;
// /offline and /sw.js must load without a session (they are what works when you have no signal).
const PUBLIC = [/^\/login$/, /^\/auth\//, /^\/manifest\.webmanifest$/, /^\/icons\//, /^\/splash\//, /^\/mcp$/, /^\/\.well-known\//, /^\/offline$/, /^\/sw\.js$/];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Verifies the JWT and refreshes the cookie when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  if (!signedIn && !PUBLIC.some((r) => r.test(path))) {
    const url = request.nextUrl.clone();
    const back = path === "/" ? "" : `${path}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = back ? `?next=${encodeURIComponent(back)}` : "";
    return NextResponse.redirect(url);
  }
  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    // Same-site paths only.
    const target = next && next.startsWith("/") && !next.startsWith("//") ? new URL(next, request.url) : null;
    url.pathname = target?.pathname ?? "/";
    url.search = target?.search ?? "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
