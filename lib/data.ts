import { createClient } from "@/lib/supabase/server";
import type { AppData, Garagem, Imovel, Profile, Reserva } from "@/lib/types";

export async function fetchProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  return (data as Profile) ?? null;
}

export async function fetchAppData(): Promise<AppData> {
  const supabase = await createClient();

  const profile = await fetchProfile();

  const [imoveisRes, reservasRes, garagensRes] = await Promise.all([
    supabase.from("imoveis").select("*").order("matricula"),
    supabase.from("reservas").select("*").order("checkin", { ascending: false }),
    supabase.from("garagens").select("*").order("predio").order("codigo"),
  ]);

  if (imoveisRes.error) throw imoveisRes.error;
  if (reservasRes.error) throw reservasRes.error;
  if (garagensRes.error) throw garagensRes.error;

  return {
    imoveis: (imoveisRes.data ?? []) as Imovel[],
    reservas: (reservasRes.data ?? []) as Reserva[],
    garagens: (garagensRes.data ?? []) as Garagem[],
    profile,
  };
}
