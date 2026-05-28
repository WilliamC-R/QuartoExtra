import { createClient } from "@/lib/supabase/server";
import type { AppData, Garagem, Imovel, Reserva } from "@/lib/types";

export async function fetchAppData(): Promise<AppData> {
  const supabase = await createClient();

  const [imoveisRes, reservasRes, garagensRes] = await Promise.all([
    supabase.from("imoveis").select("*").order("nome"),
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
  };
}
