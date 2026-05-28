import { fetchAppData } from "@/lib/data";
import { ImportarView } from "@/components/importar/ImportarView";

export default async function ImportarPage() {
  const { imoveis } = await fetchAppData();
  return <ImportarView imoveis={imoveis} />;
}
