import { createClient } from "@/lib/supabase/server";
import { IntegracoesView } from "@/components/integracoes/IntegracoesView";

export default async function IntegracoesPage() {
  const supabase = await createClient();
  const { data: tokenRow } = await supabase
    .from("gmail_tokens")
    .select("last_sync_at, token_expires_at, created_at")
    .maybeSingle();

  return <IntegracoesView gmailToken={tokenRow ?? null} />;
}
