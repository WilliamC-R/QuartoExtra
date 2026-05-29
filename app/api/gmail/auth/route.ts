import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/gmail";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const redirectUri = `${appUrl}/api/gmail/callback`;

  // state encodes the user_id to verify on callback
  const state = Buffer.from(user.id).toString("base64url");
  const url = buildAuthUrl(redirectUri, state);

  return NextResponse.redirect(url);
}
