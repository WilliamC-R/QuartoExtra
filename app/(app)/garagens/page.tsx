import { GaragensView } from "@/components/garagens/GaragensView";
import { fetchAppData } from "@/lib/data";

export default async function GaragensPage({
  searchParams,
}: {
  searchParams: Promise<{ predio?: string }>;
}) {
  const { imoveis, garagens, reservas } = await fetchAppData();
  const params = await searchParams;
  return (
    <GaragensView
      imoveis={imoveis}
      garagens={garagens}
      reservas={reservas}
      filtroPredioInicial={params.predio ?? ""}
    />
  );
}
