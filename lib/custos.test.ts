import { describe, it, expect } from "vitest";
import {
  getCustoVariavelReserva,
  getCustoVariavelTotal,
  getResumoCustos,
  fmtMoeda,
  CUSTO_LIMPEZA_POR_RESERVA,
  ENERGIA_CUSTO_DIA,
} from "./custos";
import type { Imovel, MesAno, Reserva } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r1",
    user_id: "u1",
    imovel_id: "i1",
    hospede: "Hóspede",
    checkin: "2024-01-10",
    checkout: "2024-01-13",
    valor: 900,
    origem: "airbnb",
    obs: "",
    precisa_garagem: false,
    garagem_id: null,
    custo_limpeza: 0,
    custo_energia: 0,
    custo_outros: 0,
    ...overrides,
  };
}

function makeImovel(overrides: Partial<Imovel> = {}): Imovel {
  return {
    id: "i1",
    user_id: "u1",
    matricula: "AP-101",
    estado: "SP",
    cidade: "São Paulo",
    bairro: "Centro",
    predio: "Edifício A",
    unidade: "101",
    valor_imovel: 500_000,
    tipo: "apartamento",
    modalidade_aluguel: "diaria",
    diaria: 300,
    cap: 0,
    status: "ativo",
    obs: "",
    custo_condominio: 600,
    custo_energia: 120,
    custo_internet: 80,
    custo_limpeza: 200,
    repasse_condominio: 600,
    repasse_energia: 0,
    repasse_internet: 80,
    repasse_limpeza: 0,
    iptu_anual: 1200,
    repasse_iptu_anual: 1200,
    itbi: 0,
    qtd_garagens: 1,
    ...overrides,
  };
}

const jan2024: MesAno = { m: 0, y: 2024 };
const fev2024: MesAno = { m: 1, y: 2024 };

// ---------------------------------------------------------------------------
// getCustoVariavelReserva
// ---------------------------------------------------------------------------

describe("getCustoVariavelReserva", () => {
  it("usa fórmula quando custos são 0 — 3 noites em jan/24", () => {
    const r = makeReserva({
      checkin: "2024-01-10",
      checkout: "2024-01-13",
    });
    const custo = getCustoVariavelReserva(r, [jan2024]);
    const energia = 3 * ENERGIA_CUSTO_DIA;
    expect(custo).toBeCloseTo(CUSTO_LIMPEZA_POR_RESERVA + energia, 5);
  });

  it("usa valores salvos quando custo_energia > 0", () => {
    const r = makeReserva({
      checkin: "2024-01-10",
      checkout: "2024-01-13",
      custo_energia: 60,
      custo_limpeza: 100,
    });
    const custo = getCustoVariavelReserva(r, [jan2024]);
    expect(custo).toBeCloseTo(100 + 60, 5);
  });

  it("distribui energia pro-rata em reserva que cruza meses", () => {
    // 2024-01-30 a 2024-02-02 → 3 noites: noites de jan/30, jan/31 (2 em jan) e fev/01 (1 em fev)
    const r = makeReserva({
      checkin: "2024-01-30",
      checkout: "2024-02-02",
    });
    const custoJan = getCustoVariavelReserva(r, [jan2024]);
    const custoFev = getCustoVariavelReserva(r, [fev2024]);

    // limpeza só no mês do checkin (jan); energia proporcional: jan=2/3, fev=1/3
    const energiaTotal = 3 * ENERGIA_CUSTO_DIA;
    expect(custoJan).toBeCloseTo(CUSTO_LIMPEZA_POR_RESERVA + (energiaTotal / 3) * 2, 5);
    expect(custoFev).toBeCloseTo((energiaTotal / 3) * 1, 5);
  });

  it("retorna 0 quando nenhuma noite está no período", () => {
    const r = makeReserva({ checkin: "2024-03-01", checkout: "2024-03-05" });
    expect(getCustoVariavelReserva(r, [jan2024])).toBe(0);
  });

  it("inclui custo_outros quando checkin está no período", () => {
    const r = makeReserva({
      checkin: "2024-01-05",
      checkout: "2024-01-07",
      custo_outros: 50,
    });
    const custo = getCustoVariavelReserva(r, [jan2024]);
    expect(custo).toBeCloseTo(CUSTO_LIMPEZA_POR_RESERVA + 2 * ENERGIA_CUSTO_DIA + 50, 5);
  });
});

// ---------------------------------------------------------------------------
// getCustoVariavelTotal
// ---------------------------------------------------------------------------

describe("getCustoVariavelTotal", () => {
  it("3 noites com valores padrão", () => {
    const r = makeReserva();
    const custo = getCustoVariavelTotal(r);
    expect(custo).toBeCloseTo(CUSTO_LIMPEZA_POR_RESERVA + 3 * ENERGIA_CUSTO_DIA, 5);
  });

  it("usa custo_limpeza salvo quando > 0", () => {
    const r = makeReserva({ custo_limpeza: 120, custo_energia: 0 });
    const custo = getCustoVariavelTotal(r);
    expect(custo).toBeCloseTo(120 + 3 * ENERGIA_CUSTO_DIA, 5);
  });

  it("inclui custo_outros", () => {
    const r = makeReserva({ custo_outros: 30 });
    const custo = getCustoVariavelTotal(r);
    expect(custo).toBeCloseTo(CUSTO_LIMPEZA_POR_RESERVA + 3 * ENERGIA_CUSTO_DIA + 30, 5);
  });
});

// ---------------------------------------------------------------------------
// getResumoCustos
// ---------------------------------------------------------------------------

describe("getResumoCustos", () => {
  it("calcula totalCustos, totalRepasse e custoLiquido", () => {
    const im = makeImovel();
    const res = getResumoCustos(im);
    // custos: condominio 600 + energia 120 + internet 80 + limpeza 200 + iptu_mensal (1200/12=100) = 1100
    expect(res.totalCustos).toBeCloseTo(1100, 5);
    // repasse: condominio 600 + energia 0 + internet 80 + limpeza 0 + iptu_mensal 100 = 780
    expect(res.totalRepasse).toBeCloseTo(780, 5);
    expect(res.custoLiquido).toBeCloseTo(1100 - 780, 5);
  });

  it("custoLiquido nunca negativo quando repasse > custo", () => {
    const im = makeImovel({ repasse_condominio: 9999 });
    const res = getResumoCustos(im);
    expect(res.custoLiquido).toBe(0);
  });

  it("trata campos nulos/undefined como zero", () => {
    const im = makeImovel({
      custo_condominio: undefined as unknown as number,
      repasse_condominio: undefined as unknown as number,
      iptu_anual: 0,
      repasse_iptu_anual: 0,
    });
    const res = getResumoCustos(im);
    expect(typeof res.totalCustos).toBe("number");
    expect(isNaN(res.totalCustos)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fmtMoeda
// ---------------------------------------------------------------------------

describe("fmtMoeda", () => {
  it("formata 1234 como '1.234'", () => {
    expect(fmtMoeda(1234)).toBe("1.234");
  });

  it("arredonda decimais", () => {
    expect(fmtMoeda(1234.9)).toBe("1.235");
  });

  it("retorna '0' para zero", () => {
    expect(fmtMoeda(0)).toBe("0");
  });
});
