import type { Garagem, Imovel, Reserva } from "./types";
import { labelEstado, labelPredio, labelUnidade } from "./mapa";

export type GaragemStatus = Garagem["status"];

export const garagemStatusLabels: Record<GaragemStatus, string> = {
  livre: "Livre",
  ocupada: "Em uso",
  bloqueada: "Bloqueada",
};

export function imovelTemGaragem(im: Imovel): boolean {
  return (im.qtd_garagens ?? 0) > 0;
}

export function chavePredioGaragem(
  estado: string,
  cidade: string,
  predio: string
): string {
  return `${estado}|${cidade}|${predio}`.toLowerCase();
}

export function chavePredioImovel(im: Imovel): string {
  const predio = im.predio?.trim() || "(Sem prédio)";
  return chavePredioGaragem(
    im.estado?.trim() || "",
    im.cidade?.trim() || "",
    predio === "(Sem prédio)" ? "" : predio
  );
}

/** Períodos de reserva se sobrepõem (check-out exclusivo). */
export function periodosReservaSobrepoem(
  checkinA: string,
  checkoutA: string,
  checkinB: string,
  checkoutB: string
): boolean {
  return checkinA < checkoutB && checkinB < checkoutA;
}

export function garagensDoImovel(im: Imovel, garagens: Garagem[]): Garagem[] {
  const estado = labelEstado(im);
  const cidade = im.cidade?.trim() || "—";
  const predio = labelPredio(im);
  return garagens.filter((g) => {
    const gEstado = g.estado?.trim() || "—";
    const gCidade = g.cidade?.trim() || "—";
    const gPredio = g.predio?.trim() || "(Sem prédio)";
    return gEstado === estado && gCidade === cidade && gPredio === predio;
  });
}

export function reservaOcupaGaragem(
  r: Reserva,
  garagemId: string,
  checkin?: string,
  checkout?: string,
  excluirReservaId?: string
): boolean {
  if (!r.precisa_garagem || r.garagem_id !== garagemId) return false;
  if (excluirReservaId && r.id === excluirReservaId) return false;
  if (checkin && checkout) {
    return periodosReservaSobrepoem(r.checkin, r.checkout, checkin, checkout);
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  return periodosReservaSobrepoem(r.checkin, r.checkout, hoje, amanha);
}

export function garagemEstaLivre(
  g: Garagem,
  reservas: Reserva[],
  checkin?: string,
  checkout?: string,
  excluirReservaId?: string
): boolean {
  if (g.status === "bloqueada") return false;
  const ocupada = reservas.some((r) =>
    reservaOcupaGaragem(r, g.id, checkin, checkout, excluirReservaId)
  );
  return !ocupada;
}

export function listarGaragensLivres(
  im: Imovel,
  garagens: Garagem[],
  reservas: Reserva[],
  checkin: string,
  checkout: string,
  excluirReservaId?: string
): Garagem[] {
  return garagensDoImovel(im, garagens)
    .filter((g) =>
      garagemEstaLivre(g, reservas, checkin, checkout, excluirReservaId)
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
}

export function contarVagasLivres(
  im: Imovel,
  garagens: Garagem[],
  reservas: Reserva[],
  checkin: string,
  checkout: string,
  excluirReservaId?: string
): number {
  return listarGaragensLivres(
    im,
    garagens,
    reservas,
    checkin,
    checkout,
    excluirReservaId
  ).length;
}

export function primeiraGaragemLivre(
  im: Imovel,
  garagens: Garagem[],
  reservas: Reserva[],
  checkin: string,
  checkout: string,
  excluirReservaId?: string
): Garagem | null {
  return (
    listarGaragensLivres(
      im,
      garagens,
      reservas,
      checkin,
      checkout,
      excluirReservaId
    )[0] ?? null
  );
}

export function reservaVinculadaGaragem(
  g: Garagem,
  reservas: Reserva[],
  checkin?: string,
  checkout?: string
): Reserva | undefined {
  const hoje = new Date().toISOString().slice(0, 10);
  return reservas
    .filter((r) => {
      if (!r.precisa_garagem || r.garagem_id !== g.id) return false;
      if (checkin && checkout) {
        return periodosReservaSobrepoem(r.checkin, r.checkout, checkin, checkout);
      }
      return r.checkout > hoje;
    })
    .sort((a, b) => a.checkin.localeCompare(b.checkin))[0];
}

export function codigoGaragem(
  garagemId: string | null,
  garagens: Garagem[]
): string {
  if (!garagemId) return "";
  return garagens.find((g) => g.id === garagemId)?.codigo ?? "";
}

export interface VagaOverview {
  garagem: Garagem;
  livre: boolean;
  bloqueada: boolean;
  reserva?: Reserva;
}

export interface UnidadeOverview {
  imovel: Imovel;
  label: string;
  qtdGaragem: number;
}

export interface PredioGaragemOverview {
  key: string;
  estado: string;
  cidade: string;
  predioLabel: string;
  vagas: VagaOverview[];
  unidades: UnidadeOverview[];
  demandaCadastro: number;
  livres: number;
  ocupadas: number;
}

export function montarOverviewGaragens(
  imoveis: Imovel[],
  garagens: Garagem[],
  reservas: Reserva[],
  periodo?: { checkin: string; checkout: string; excluirReservaId?: string }
): PredioGaragemOverview[] {
  const imoveisComGaragem = imoveis.filter(imovelTemGaragem);
  const predioKeys = new Set<string>();

  for (const im of imoveisComGaragem) {
    predioKeys.add(chavePredioImovel(im));
  }
  for (const g of garagens) {
    const predio = g.predio?.trim() || "(Sem prédio)";
    predioKeys.add(
      chavePredioGaragem(g.estado || "", g.cidade || "", predio)
    );
  }

  const checkin = periodo?.checkin;
  const checkout = periodo?.checkout;
  const excluir = periodo?.excluirReservaId;

  return [...predioKeys]
    .map((key) => {
      const vagasPredio = garagens.filter((g) => {
        const predio = g.predio?.trim() || "(Sem prédio)";
        return (
          chavePredioGaragem(g.estado || "", g.cidade || "", predio) === key
        );
      });

      const unidades = imoveisComGaragem
        .filter((im) => chavePredioImovel(im) === key)
        .map((im) => ({
          imovel: im,
          label: labelUnidade(im),
          qtdGaragem: im.qtd_garagens ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

      const g0 = vagasPredio[0];
      const predioLabel =
        g0?.predio?.trim() ||
        (unidades[0] ? labelPredio(unidades[0].imovel) : "(Sem prédio)");
      const estado =
        g0?.estado?.trim() ||
        unidades[0]?.imovel.estado?.trim() ||
        "—";
      const cidade =
        g0?.cidade?.trim() ||
        unidades[0]?.imovel.cidade?.trim() ||
        "—";

      const demandaCadastro = unidades.reduce((s, u) => s + u.qtdGaragem, 0);

      const vagas: VagaOverview[] = [...vagasPredio]
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
        .map((garagem) => {
          const bloqueada = garagem.status === "bloqueada";
          const livre =
            !bloqueada &&
            garagemEstaLivre(garagem, reservas, checkin, checkout, excluir);
          const reserva = reservaVinculadaGaragem(
            garagem,
            reservas,
            checkin,
            checkout
          );
          return { garagem, livre, bloqueada, reserva };
        });

      const livres = vagas.filter((v) => v.livre).length;
      const ocupadas = vagas.filter((v) => !v.livre && !v.bloqueada).length;

      return {
        key,
        estado: estado || "—",
        cidade: cidade || "—",
        predioLabel,
        vagas,
        unidades,
        demandaCadastro,
        livres,
        ocupadas,
      };
    })
    .filter((p) => p.unidades.length > 0 || p.vagas.length > 0)
    .sort((a, b) =>
      `${a.estado}${a.cidade}${a.predioLabel}`.localeCompare(
        `${b.estado}${b.cidade}${b.predioLabel}`,
        "pt-BR"
      )
    );
}

export function overviewDoImovel(
  im: Imovel,
  imoveis: Imovel[],
  garagens: Garagem[],
  reservas: Reserva[],
  periodo?: { checkin: string; checkout: string }
): PredioGaragemOverview | undefined {
  const key = chavePredioImovel(im);
  return montarOverviewGaragens(imoveis, garagens, reservas, periodo).find(
    (p) => p.key === key
  );
}
