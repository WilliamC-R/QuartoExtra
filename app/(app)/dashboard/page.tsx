import { fetchAppData } from "@/lib/data";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const { imoveis, reservas } = await fetchAppData();
  return <DashboardView imoveis={imoveis} reservas={reservas} />;
}
