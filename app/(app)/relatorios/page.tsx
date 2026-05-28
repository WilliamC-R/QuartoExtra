import { fetchAppData } from "@/lib/data";
import { RelatoriosView } from "@/components/relatorios/RelatoriosView";

export default async function RelatoriosPage() {
  const { imoveis, reservas } = await fetchAppData();
  return <RelatoriosView imoveis={imoveis} reservas={reservas} />;
}
