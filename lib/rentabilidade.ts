/** Retorno anual liquido sobre o valor do imovel (% a.a.) */
export function rentabilidadeAnual(
  receitaLiquidaAnual: number,
  valorImovel: number
): number {
  if (valorImovel <= 0) return 0;
  return (receitaLiquidaAnual / valorImovel) * 100;
}

/** Retorno mensal liquido sobre o valor do imovel (% a.m.) */
export function rentabilidadeMensal(
  resultadoMes: number,
  valorImovel: number
): number {
  if (valorImovel <= 0) return 0;
  return (resultadoMes / valorImovel) * 100;
}

/** CDI mensal equivalente ao CDI anual em % (juros compostos) */
export function cdiMensal(cdiAnual: number): number {
  return (Math.pow(1 + cdiAnual / 100, 1 / 12) - 1) * 100;
}

/** Receita do periodo anualizada */
export function anualizarReceita(
  receitaPeriodo: number,
  mesesPeriodo: number
): number {
  if (mesesPeriodo <= 0) return 0;
  return (receitaPeriodo / mesesPeriodo) * 12;
}

export function fmtRentabilidade(pct: number): string {
  if (pct <= 0) return "-";
  return `${pct.toFixed(1)}% a.a.`;
}

export function fmtRentabilidadeMensal(pct: number): string {
  if (pct === 0) return "-";
  return `${pct.toFixed(2).replace(".", ",")}% a.m.`;
}
