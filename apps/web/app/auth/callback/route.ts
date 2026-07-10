import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/** OAuth (PKCE) redirect target: exchange the code for a session. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth-failed", url.origin));
}
