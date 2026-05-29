import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/integracoes?erro=acesso_negado`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/integracoes?erro=nao_autenticado`);

  // Verify state matches current user
  const stateUserId = Buffer.from(state, "base64url").toString("utf-8");
  if (stateUserId !== user.id) {
    return NextResponse.redirect(`${appUrl}/integracoes?erro=state_invalido`);
  }

  try {
    const redirectUri = `${appUrl}/api/gmail/callback`;
    const tokens = await exchangeCode(code, redirectUri);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await supabase.from("gmail_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(`${appUrl}/integracoes?sucesso=gmail_conectado`);
  } catch {
    return NextResponse.redirect(`${appUrl}/integracoes?erro=token_falhou`);
  }
}
