import { MapaView } from "@/components/mapa/MapaView";
import { fetchAppData } from "@/lib/data";

export default async function MapaPage() {
  const { imoveis, reservas } = await fetchAppData();
  return <MapaView imoveis={imoveis} reservas={reservas} />;
}
