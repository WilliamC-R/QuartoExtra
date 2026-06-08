import { parseDate } from "./metrics";
import type { Imovel, MesAno, Reserva } from "./types";

export const CATEGORIAS_CUSTO = [
  {
    key: "condominio" as const,
    label: "Condomínio",
    custo: "custo_condominio",
    repasse: "repasse_condominio",
  },
  {
    key: "energia" as const,
    label: "Energia",
    custo: "custo_energia",
    repasse: "repasse_energia",
  },
  {
    key: "internet" as const,
    label: "Internet",
    custo: "custo_internet",
    repasse: "repasse_internet",
  },
  {
    key: "limpeza" as const,
    label: "Limpeza",
    custo: "custo_limpeza",
    repasse: "repasse_limpeza",
  },
] as const;

// Custos variáveis por reserva (calculados automaticamente)
export const CUSTO_LIMPEZA_POR_RESERVA = 70;       // R$ por fim de reserva
export const ENERGIA_KWH_DIA = 7;                   // kWh/dia estimado por hóspede
export const ENERGIA_CUSTO_KWH = 0.9;               // R$/kWh
export const ENERGIA_CUSTO_DIA = ENERGIA_KWH_DIA * ENERGIA_CUSTO_KWH; // R$ 6,30/noite

/**
 * Custo variável de uma reserva, contando apenas as noites dentro do período.
 * Usa valores salvos quando disponíveis (> 0); caso contrário aplica a fórmula.
 * - Limpeza e Outros: atribuídos ao mês do check-in.
 * - Energia: distribuída proporcionalmente pelas noites do período.
 */
export function getCustoVariavelReserva(r: Reserva, mesesValidos: MesAno[]): number {
  const ci = parseDate(r.checkin);
  const co = parseDate(r.checkout);

  let totalNoites = 0;
  let noitesNoPeriodo = 0;
  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
    totalNoites++;
    if (mesesValidos.some(({ m, y }) => d.getMonth() === m && d.getFullYear() === y))
      noitesNoPeriodo++;
  }
  if (noitesNoPeriodo === 0 || totalNoites === 0) return 0;

  const energiaTotal =
    Number(r.custo_energia) > 0 ? Number(r.custo_energia) : totalNoites * ENERGIA_CUSTO_DIA;
  const energiaPeriodo = (energiaTotal / totalNoites) * noitesNoPeriodo;

  const checkinNoPeriodo = mesesValidos.some(
    ({ m, y }) => ci.getMonth() === m && ci.getFullYear() === y
  );
  const limpeza = checkinNoPeriodo
    ? (Number(r.custo_limpeza) > 0 ? Number(r.custo_limpeza) : CUSTO_LIMPEZA_POR_RESERVA)
    : 0;
  const outros = checkinNoPeriodo ? (Number(r.custo_outros) || 0) : 0;

  return limpeza + energiaPeriodo + outros;
}

/** Custo variável total de uma reserva (sem filtro de período). */
export function getCustoVariavelTotal(r: Reserva): number {
  const ci = parseDate(r.checkin);
  const co = parseDate(r.checkout);
  let noites = 0;
  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) noites++;
  const energia =
    Number(r.custo_energia) > 0 ? Number(r.custo_energia) : noites * ENERGIA_CUSTO_DIA;
  const limpeza =
    Number(r.custo_limpeza) > 0 ? Number(r.custo_limpeza) : CUSTO_LIMPEZA_POR_RESERVA;
  return limpeza + energia + (Number(r.custo_outros) || 0);
}

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

export interface ResumoCustos {
  totalCustos: number;
  totalRepasse: number;
  custoLiquido: number;
}

type CampoCusto = (typeof CATEGORIAS_CUSTO)[number]["custo"];
type CampoRepasse = (typeof CATEGORIAS_CUSTO)[number]["repasse"];

export function getResumoCustos(imovel: Imovel): ResumoCustos {
  const iptuMensal = n(imovel.iptu_anual) / 12;
  const repasse_iptu_mensal = n(imovel.repasse_iptu_anual) / 12;
  const totalCustos = CATEGORIAS_CUSTO.reduce(
    (s, c) => s + n(imovel[c.custo as CampoCusto]),
    iptuMensal
  );
  const totalRepasse = CATEGORIAS_CUSTO.reduce(
    (s, c) => s + n(imovel[c.repasse as CampoRepasse]),
    repasse_iptu_mensal
  );
  return {
    totalCustos,
    totalRepasse,
    custoLiquido: Math.max(0, totalCustos - totalRepasse),
  };
}

export function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
