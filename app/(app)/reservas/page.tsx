import { fetchAppData } from "@/lib/data";
import { ReservasView } from "@/components/reservas/ReservasView";

export default async function ReservasPage() {
  const { imoveis, reservas, garagens } = await fetchAppData();
  return (
    <ReservasView imoveis={imoveis} reservas={reservas} garagens={garagens} />
  );
}
