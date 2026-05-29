import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listNewMessages, getMessage, refreshAccessToken } from "@/lib/gmail";
import { parseAirbnbEmail } from "@/lib/parsers/airbnb-email";
import { parseBookingEmail } from "@/lib/parsers/booking-email";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Load stored tokens
  const { data: tokenRow } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "Gmail não conectado" }, { status: 400 });
  }

  // Refresh token if expired
  let accessToken = tokenRow.access_token;
  const isExpired =
    tokenRow.token_expires_at &&
    new Date(tokenRow.token_expires_at) <= new Date(Date.now() + 60_000);

  if (isExpired && tokenRow.refresh_token) {
    try {
      const fresh = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = fresh.access_token;
      const expiresAt = fresh.expires_in
        ? new Date(Date.now() + fresh.expires_in * 1000).toISOString()
        : null;
      await supabase
        .from("gmail_tokens")
        .update({ access_token: accessToken, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    } catch {
      return NextResponse.json({ error: "Token do Gmail expirado. Reconecte o Gmail." }, { status: 401 });
    }
  }

  // Fetch properties so we can match against listing names
  const { data: imoveis } = await supabase
    .from("imoveis")
    .select("id, nome")
    .eq("user_id", user.id);

  const afterDate = tokenRow.last_sync_at ? new Date(tokenRow.last_sync_at) : undefined;

  let messages;
  try {
    messages = await listNewMessages(accessToken, afterDate);
  } catch {
    return NextResponse.json({ error: "Falha ao buscar emails. Reconecte o Gmail." }, { status: 502 });
  }

  const results = { imported: 0, skipped: 0, errors: 0, total: messages.length };

  for (const msg of messages) {
    // Skip already processed emails
    const { data: existing } = await supabase
      .from("reservas")
      .select("id")
      .eq("user_id", user.id)
      .eq("gmail_message_id", msg.id)
      .maybeSingle();

    if (existing) { results.skipped++; continue; }

    try {
      const detail = await getMessage(accessToken, msg.id);
      const from = detail.from.toLowerCase();

      let parsed = null;
      if (from.includes("airbnb")) {
        parsed = parseAirbnbEmail(detail.subject, detail.textBody, detail.htmlBody);
      } else if (from.includes("booking")) {
        parsed = parseBookingEmail(detail.subject, detail.textBody, detail.htmlBody);
      }

      if (!parsed) { results.skipped++; continue; }

      // Best-effort property matching by name in email body
      const body = (detail.textBody || detail.htmlBody).toLowerCase();
      let imovelId: string | null = null;
      if (imoveis) {
        const match = imoveis.find((im) => body.includes(im.nome.toLowerCase()));
        if (match) imovelId = match.id;
        // Fallback: use first active property if only one exists
        if (!imovelId && imoveis.length === 1) imovelId = imoveis[0].id;
      }

      await supabase.from("reservas").insert({
        user_id: user.id,
        imovel_id: imovelId,
        hospede: parsed.hospede,
        checkin: parsed.checkin,
        checkout: parsed.checkout,
        valor: parsed.valor,
        origem: parsed.origem,
        obs: parsed.obs,
        precisa_garagem: false,
        garagem_id: null,
        custo_limpeza: 0,
        custo_energia: 0,
        custo_outros: 0,
        gmail_message_id: msg.id,
      });

      results.imported++;
    } catch {
      results.errors++;
    }
  }

  // Update last sync timestamp
  await supabase
    .from("gmail_tokens")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json(results);
}
