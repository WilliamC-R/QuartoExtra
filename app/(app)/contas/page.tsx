import { fetchAppData } from "@/lib/data";
import { ContasView } from "@/components/contas/ContasView";
import { redirect } from "next/navigation";

export default async function ContasPage() {
  const { imoveis, profile } = await fetchAppData();
  if (profile?.role !== "gestor") redirect("/dashboard");
  return <ContasView imoveis={imoveis} />;
}
