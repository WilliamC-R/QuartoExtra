import { describe, it, expect } from "vitest";
import {
  parseDate,
  getOcupacao,
  getReceitaNoPeriodo,
  getReceitaMes,
  getMesesValidos,
  getMesesAno,
  filterReservasPorPeriodo,
  noitesEntre,
  fmtDate,
  calcValorSugeridoAluguel,
} from "./metrics";
import type { Reserva } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r1",
    user_id: "u1",
    imovel_id: "im1",
    hospede: "Hóspede Teste",
    checkin: "2025-01-10",
    checkout: "2025-01-15",
    valor: 500,
    origem: "Airbnb",
    obs: "",
    precisa_garagem: false,
    garagem_id: null,
    custo_limpeza: 0,
    custo_energia: 0,
    custo_outros: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------

describe("parseDate", () => {
  it("retorna data local correta sem deslocamento de fuso", () => {
    const d = parseDate("2025-03-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2); // 0-indexed → março
    expect(d.getDate()).toBe(15);
  });

  it("primeiro dia do ano", () => {
    const d = parseDate("2024-01-01");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// noitesEntre
// ---------------------------------------------------------------------------

describe("noitesEntre", () => {
  it("calcula noites corretamente", () => {
    expect(noitesEntre("2025-01-10", "2025-01-15")).toBe(5);
  });

  it("retorna 1 para estadia de 1 noite", () => {
    expect(noitesEntre("2025-06-01", "2025-06-02")).toBe(1);
  });

  it("retorna 0 quando checkin === checkout", () => {
    expect(noitesEntre("2025-06-01", "2025-06-01")).toBe(0);
  });

  it("traversa virada de mês", () => {
    expect(noitesEntre("2025-01-28", "2025-02-03")).toBe(6);
  });

  it("traversa virada de ano", () => {
    expect(noitesEntre("2024-12-28", "2025-01-04")).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// fmtDate
// ---------------------------------------------------------------------------

describe("fmtDate", () => {
  it("formata para DD/MM/YYYY", () => {
    expect(fmtDate("2025-03-05")).toBe("05/03/2025");
  });

  it("padding de dia e mês com zero", () => {
    expect(fmtDate("2025-01-09")).toBe("09/01/2025");
  });
});

// ---------------------------------------------------------------------------
// calcValorSugeridoAluguel
// ---------------------------------------------------------------------------

describe("calcValorSugeridoAluguel", () => {
  it("diária × número de noites", () => {
    expect(calcValorSugeridoAluguel(200, "diaria", "2025-01-10", "2025-01-15")).toBe(1000);
  });

  it("mensal com estadia de 1 mês exato", () => {
    expect(calcValorSugeridoAluguel(2000, "mensal", "2025-01-01", "2025-01-31")).toBe(2000);
  });

  it("mensal com estadia de 45 noites → 2 meses", () => {
    expect(calcValorSugeridoAluguel(2000, "mensal", "2025-01-01", "2025-02-15")).toBe(4000);
  });

  it("retorna 0 se checkout === checkin", () => {
    expect(calcValorSugeridoAluguel(200, "diaria", "2025-01-10", "2025-01-10")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getOcupacao
// ---------------------------------------------------------------------------

describe("getOcupacao", () => {
  it("retorna 0 sem reservas para o imóvel", () => {
    const occ = getOcupacao("im1", 0, 2025, []);
    expect(occ).toBe(0);
  });

  it("calcula ocupação correta para reserva no mês inteiro", () => {
    // Janeiro tem 31 dias; reserva do dia 1 ao 31 ocupa 30 noites
    const r = makeReserva({ checkin: "2025-01-01", checkout: "2025-01-31" });
    const occ = getOcupacao("im1", 0, 2025, [r]);
    expect(occ).toBe(Math.round((30 / 31) * 100));
  });

  it("ignora reservas de outros imóveis", () => {
    const r = makeReserva({ imovel_id: "outro" });
    expect(getOcupacao("im1", 0, 2025, [r])).toBe(0);
  });

  it("não excede 100%", () => {
    // Duas reservas sobrepostas no mesmo mês
    const r1 = makeReserva({ checkin: "2025-01-01", checkout: "2025-01-31" });
    const r2 = makeReserva({ id: "r2", checkin: "2025-01-01", checkout: "2025-01-31" });
    expect(getOcupacao("im1", 0, 2025, [r1, r2])).toBeLessThanOrEqual(100);
  });

  it("reserva que atravessa meses conta só as noites do mês pedido", () => {
    // Reserva 25/jan–5/fev:
    //   Janeiro: dias 25,26,27,28,29,30,31 = 7 noites (loop d < checkout)
    //   Fevereiro: dias 1,2,3,4 = 4 noites (5/fev é o checkout, não conta)
    const r = makeReserva({ checkin: "2025-01-25", checkout: "2025-02-05" });
    const occJan = getOcupacao("im1", 0, 2025, [r]);
    const occFev = getOcupacao("im1", 1, 2025, [r]);
    expect(occJan).toBe(Math.round((7 / 31) * 100));
    expect(occFev).toBe(Math.round((4 / 28) * 100));
  });
});

// ---------------------------------------------------------------------------
// getReceitaNoPeriodo
// ---------------------------------------------------------------------------

describe("getReceitaNoPeriodo", () => {
  it("retorna valor total quando reserva está inteiramente no período", () => {
    const r = makeReserva({ checkin: "2025-01-10", checkout: "2025-01-15", valor: 500 });
    const receita = getReceitaNoPeriodo(r, [{ m: 0, y: 2025 }]);
    expect(receita).toBe(500);
  });

  it("pro-rateia reserva que atravessa dois meses", () => {
    // 5 noites em jan, 5 noites em fev → 10 no total; valor 600
    const r = makeReserva({ checkin: "2025-01-27", checkout: "2025-02-06", valor: 600 });
    const receitaJan = getReceitaNoPeriodo(r, [{ m: 0, y: 2025 }]);
    const receitaFev = getReceitaNoPeriodo(r, [{ m: 1, y: 2025 }]);
    expect(receitaJan).toBeCloseTo(300, 0);
    expect(receitaFev).toBeCloseTo(300, 0);
  });

  it("retorna 0 quando o período não contém nenhuma noite da reserva", () => {
    const r = makeReserva({ checkin: "2025-01-10", checkout: "2025-01-15", valor: 500 });
    expect(getReceitaNoPeriodo(r, [{ m: 5, y: 2025 }])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getReceitaMes
// ---------------------------------------------------------------------------

describe("getReceitaMes", () => {
  it("soma receitas de múltiplas reservas no mês", () => {
    const r1 = makeReserva({ valor: 300, checkin: "2025-01-01", checkout: "2025-01-06" });
    const r2 = makeReserva({ id: "r2", valor: 200, checkin: "2025-01-10", checkout: "2025-01-15" });
    expect(getReceitaMes("im1", 0, 2025, [r1, r2])).toBeCloseTo(500, 0);
  });

  it("com imovelId null soma todos os imóveis", () => {
    const r1 = makeReserva({ valor: 300, imovel_id: "im1" });
    const r2 = makeReserva({ id: "r2", valor: 200, imovel_id: "im2" });
    expect(getReceitaMes(null, 0, 2025, [r1, r2])).toBeCloseTo(500, 0);
  });

  it("retorna 0 quando não há reservas no mês", () => {
    const r = makeReserva({ checkin: "2025-03-01", checkout: "2025-03-05", valor: 400 });
    expect(getReceitaMes("im1", 0, 2025, [r])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMesesValidos
// ---------------------------------------------------------------------------

describe("getMesesValidos", () => {
  it("retorna exatamente N meses em ordem cronológica", () => {
    const agora = new Date(2025, 5, 1); // junho 2025
    const meses = getMesesValidos(3, agora);
    expect(meses).toHaveLength(3);
    expect(meses[0]).toEqual({ m: 3, y: 2025 }); // abril
    expect(meses[1]).toEqual({ m: 4, y: 2025 }); // maio
    expect(meses[2]).toEqual({ m: 5, y: 2025 }); // junho
  });

  it("traversa virada de ano corretamente", () => {
    const agora = new Date(2025, 1, 1); // fevereiro 2025
    const meses = getMesesValidos(3, agora);
    expect(meses[0]).toEqual({ m: 11, y: 2024 }); // dez 2024
    expect(meses[1]).toEqual({ m: 0, y: 2025 });  // jan 2025
    expect(meses[2]).toEqual({ m: 1, y: 2025 });  // fev 2025
  });
});

// ---------------------------------------------------------------------------
// getMesesAno
// ---------------------------------------------------------------------------

describe("getMesesAno", () => {
  it("retorna 12 meses do ano", () => {
    const meses = getMesesAno(2025);
    expect(meses).toHaveLength(12);
    expect(meses[0]).toEqual({ m: 0, y: 2025 });
    expect(meses[11]).toEqual({ m: 11, y: 2025 });
  });
});

// ---------------------------------------------------------------------------
// filterReservasPorPeriodo
// ---------------------------------------------------------------------------

describe("filterReservasPorPeriodo", () => {
  it("inclui reserva totalmente dentro do período", () => {
    const r = makeReserva({ checkin: "2025-01-10", checkout: "2025-01-15" });
    const filtered = filterReservasPorPeriodo([r], [{ m: 0, y: 2025 }]);
    expect(filtered).toHaveLength(1);
  });

  it("inclui reserva que atravessa a borda do período", () => {
    const r = makeReserva({ checkin: "2025-01-28", checkout: "2025-02-05" });
    const filtered = filterReservasPorPeriodo([r], [{ m: 0, y: 2025 }]);
    expect(filtered).toHaveLength(1);
  });

  it("exclui reserva fora do período", () => {
    const r = makeReserva({ checkin: "2025-03-01", checkout: "2025-03-10" });
    const filtered = filterReservasPorPeriodo([r], [{ m: 0, y: 2025 }]);
    expect(filtered).toHaveLength(0);
  });

  it("filtra múltiplos períodos ao mesmo tempo", () => {
    const rJan = makeReserva({ id: "r1", checkin: "2025-01-05", checkout: "2025-01-10" });
    const rMar = makeReserva({ id: "r2", checkin: "2025-03-05", checkout: "2025-03-10" });
    const rJun = makeReserva({ id: "r3", checkin: "2025-06-01", checkout: "2025-06-05" });
    const filtered = filterReservasPorPeriodo(
      [rJan, rMar, rJun],
      [{ m: 0, y: 2025 }, { m: 2, y: 2025 }]
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toContain("r1");
    expect(filtered.map((r) => r.id)).toContain("r2");
  });
});
