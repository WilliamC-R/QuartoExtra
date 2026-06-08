import { fetchAppData } from "@/lib/data";
import { ImoveisView } from "@/components/imoveis/ImoveisView";

export default async function ImoveisPage() {
  const { imoveis, reservas } = await fetchAppData();
  return <ImoveisView imoveis={imoveis} reservas={reservas} />;
}
