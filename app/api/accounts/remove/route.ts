import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "gestor") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Configuração de servidor incompleta" }, { status: 500 });
  }

  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: "client_id obrigatório" }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Unlink imoveis from this client (gestor's imoveis only)
  await supabase
    .from("imoveis")
    .update({ cliente_id: null })
    .eq("cliente_id", client_id)
    .eq("user_id", user.id);

  // Delete the auth user (cascades to profiles via FK)
  const { error } = await admin.auth.admin.deleteUser(client_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
