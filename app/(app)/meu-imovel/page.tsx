import { createClient } from "@/lib/supabase/server";
import { MeuImovelView } from "@/components/meu-imovel/MeuImovelView";
import { redirect } from "next/navigation";
import type { Imovel, Reserva } from "@/lib/types";

export default async function MeuImovelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nome_completo")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "cliente") redirect("/dashboard");

  const { data: imovel } = await supabase
    .from("imoveis")
    .select("*")
    .eq("cliente_id", user.id)
    .maybeSingle();

  let reservas: Reserva[] = [];
  if (imovel) {
    const { data } = await supabase
      .from("reservas")
      .select("*")
      .eq("imovel_id", imovel.id)
      .order("checkin", { ascending: false });
    reservas = (data ?? []) as Reserva[];
  }

  return (
    <MeuImovelView
      imovel={imovel as Imovel | null}
      reservas={reservas}
      nomeCliente={profile?.nome_completo ?? ""}
    />
  );
}
