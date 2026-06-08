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

  const { email, password, nome_completo, imovel_id } = await req.json();

  if (!email || !password || !nome_completo) {
    return NextResponse.json(
      { error: "email, password e nome_completo são obrigatórios" },
      { status: 400 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Configuração de servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente)" },
      { status: 500 }
    );
  }

  // Verificar se o imóvel solicitado está livre e pertence a este gestor
  if (imovel_id) {
    const { data: imovelCheck } = await supabase
      .from("imoveis")
      .select("id, cliente_id")
      .eq("id", imovel_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!imovelCheck) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });
    }
    if (imovelCheck.cliente_id) {
      return NextResponse.json(
        { error: "Este imóvel já possui um cliente vinculado." },
        { status: 409 }
      );
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "cliente", nome_completo },
  });

  if (createError) {
    const msg = createError.message.includes("already registered")
      ? "Este email já está cadastrado."
      : createError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Upsert profile (trigger pode já ter criado)
  const { error: profileError } = await admin.from("profiles").upsert({
    user_id: newUser.user.id,
    role: "cliente",
    nome_completo,
  });

  if (profileError) {
    // Usuário criado mas perfil falhou — limpar para evitar conta órfã
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: "Erro ao criar perfil do cliente." }, { status: 500 });
  }

  // Vincular imóvel
  if (imovel_id) {
    const { error: linkError } = await admin
      .from("imoveis")
      .update({ cliente_id: newUser.user.id })
      .eq("id", imovel_id)
      .eq("user_id", user.id)
      .is("cliente_id", null); // garantia extra de imóvel livre

    if (linkError) {
      // Conta criada com sucesso mas vínculo falhou — retornar 207 com aviso
      return NextResponse.json(
        {
          user_id: newUser.user.id,
          email: newUser.user.email,
          warning: "Conta criada, mas o vínculo com o imóvel falhou. Vincule manualmente em Contas.",
        },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ user_id: newUser.user.id, email: newUser.user.email });
}
