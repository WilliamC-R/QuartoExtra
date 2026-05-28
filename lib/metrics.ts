import type { Imovel, MesAno, ModalidadeAluguel, Reserva } from "./types";

export const modalidadeAluguelLabels: Record<ModalidadeAluguel, string> = {
  diaria: "Diária",
  mensal: "Mensal",
};

export function labelValorAluguel(modalidade: ModalidadeAluguel): string {
  return modalidade === "mensal"
    ? "Aluguel mensal (R$)"
    : "Diária padrão (R$)";
}

export function calcValorSugeridoAluguel(
  valor: number,
  modalidade: ModalidadeAluguel,
  checkin: string,
  checkout: string
): number {
  const noites = noitesEntre(checkin, checkout);
  if (noites <= 0) return 0;
  if (modalidade === "mensal") {
    const meses = Math.max(1, Math.ceil(noites / 30));
    return Math.round(valor * meses);
  }
  return Math.round(valor * noites);
}

export const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function occColor(occ: number): string {
  return occ >= 70 ? "#1D9E75" : occ >= 40 ? "#EF9F27" : "#E24B4A";
}

/** Interpreta "YYYY-MM-DD" como data local (evita bug de fuso UTC-3). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getOcupacao(
  imovelId: string,
  mes: number,
  ano: number,
  reservas: Reserva[]
): number {
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  let ocupados = 0;
  reservas
    .filter((r) => r.imovel_id === imovelId)
    .forEach((r) => {
      const ci = parseDate(r.checkin);
      const co = parseDate(r.checkout);
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === ano && d.getMonth() === mes) ocupados++;
      }
    });
  return Math.min(100, Math.round((ocupados / diasNoMes) * 100));
}

/**
 * Valor pro-rateado da reserva que cai dentro dos meses indicados.
 * Ex: reserva dez/jan com valor 600 → retorna 300 para cada mês.
 */
export function getReceitaNoPeriodo(r: Reserva, mesesValidos: MesAno[]): number {
  const ci = parseDate(r.checkin);
  const co = parseDate(r.checkout);
  const totalNoites = Math.round((co.getTime() - ci.getTime()) / 864e5);
  if (totalNoites <= 0) return 0;
  let noitesNoPeriodo = 0;
  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
    if (mesesValidos.some(({ m, y }) => d.getMonth() === m && d.getFullYear() === y))
      noitesNoPeriodo++;
  }
  return (Number(r.valor) * noitesNoPeriodo) / totalNoites;
}

/** Receita pro-rateada de um mês/ano específico. */
export function getReceitaMes(
  imovelId: string | null,
  mes: number,
  ano: number,
  reservas: Reserva[]
): number {
  return reservas
    .filter((r) => imovelId == null || r.imovel_id === imovelId)
    .reduce((s, r) => s + getReceitaNoPeriodo(r, [{ m: mes, y: ano }]), 0);
}

export function getMesesValidos(meses: number, now = new Date()): MesAno[] {
  const curMes = now.getMonth();
  const curYear = now.getFullYear();
  const result: MesAno[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const mesIdx = curMes - i;
    result.push({
      m: ((mesIdx % 12) + 12) % 12,
      y: curYear + Math.floor(mesIdx / 12),
    });
  }
  return result;
}

/** Todos os 12 meses de um ano calendário. */
export function getMesesAno(ano: number): MesAno[] {
  return Array.from({ length: 12 }, (_, m) => ({ m, y: ano }));
}

/**
 * Inclui qualquer reserva que tenha ao menos uma noite dentro do período,
 * independente de quando o checkin foi feito.
 */
export function filterReservasPorPeriodo(
  reservas: Reserva[],
  mesesValidos: MesAno[]
): Reserva[] {
  return reservas.filter((r) => {
    const ci = parseDate(r.checkin);
    const co = parseDate(r.checkout);
    return mesesValidos.some(({ m, y }) => {
      const inicioMes = new Date(y, m, 1);
      const fimMes = new Date(y, m + 1, 0);
      return ci <= fimMes && co > inicioMes;
    });
  });
}

export function noitesEntre(checkin: string, checkout: string): number {
  return Math.round(
    (parseDate(checkout).getTime() - parseDate(checkin).getTime()) / 864e5
  );
}

export function fmtDate(d: string): string {
  const dt = parseDate(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
