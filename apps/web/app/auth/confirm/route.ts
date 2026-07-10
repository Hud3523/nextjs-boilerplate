import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabase/server";

/** Magic-link (OTP) redirect target: verify the token hash. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth-failed", url.origin));
}
