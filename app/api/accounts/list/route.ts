import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Imóveis deste gestor (RLS garante user_id = gestor logado)
  const { data: imoveis } = await supabase
    .from("imoveis")
    .select("id, matricula, unidade, predio, cliente_id")
    .eq("user_id", user.id);

  if (!imoveis) return NextResponse.json([]);

  // IDs dos clientes vinculados a imóveis DESTE gestor
  const clienteIds = [...new Set(
    imoveis.filter((im) => im.cliente_id).map((im) => im.cliente_id as string)
  )];

  if (clienteIds.length === 0) return NextResponse.json([]);

  // Busca perfis apenas dos clientes vinculados a este gestor
  const { data: clientes } = await admin
    .from("profiles")
    .select("user_id, nome_completo, created_at")
    .in("user_id", clienteIds)
    .eq("role", "cliente")
    .order("nome_completo");

  if (!clientes || clientes.length === 0) return NextResponse.json([]);

  // Emails via admin API (apenas os IDs que precisamos)
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(usersPage.users.map((u) => [u.id, u.email ?? ""]));

  const result = clientes.map((c) => ({
    user_id: c.user_id,
    nome_completo: c.nome_completo,
    email: emailMap.get(c.user_id) ?? "",
    created_at: c.created_at,
    imovel: imoveis.find((im) => im.cliente_id === c.user_id) ?? null,
  }));

  return NextResponse.json(result);
}
