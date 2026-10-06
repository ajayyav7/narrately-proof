import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/proof";
  const code = request.nextUrl.searchParams.get("code");
  const defaultNext = `${basePath}/`;
  const next = request.nextUrl.searchParams.get("next") || defaultNext;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : defaultNext;
  const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const redirectOrigin = publicSiteUrl ? new URL(publicSiteUrl).origin : request.nextUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, redirectOrigin));
  }

  const failurePath = safeNext.endsWith("/reset-password")
    ? `${safeNext}?error=expired`
    : `${basePath}/login?error=confirmation`;
  return NextResponse.redirect(new URL(failurePath, redirectOrigin));
}
