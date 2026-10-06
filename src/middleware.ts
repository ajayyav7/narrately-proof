import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return new NextResponse("Supabase authentication is not configured for this app.", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/proof";
  const path = request.nextUrl.pathname;
  const appPath = path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
  const authPage = appPath === "/login" || appPath === "/register" || appPath === "/forgot-password";

  if (!user && !authPage && appPath !== "/auth/callback") {
    return NextResponse.redirect(new URL(`${basePath}/login`, request.url));
  }
  if (user && authPage) {
    return NextResponse.redirect(new URL(`${basePath}/`, request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
