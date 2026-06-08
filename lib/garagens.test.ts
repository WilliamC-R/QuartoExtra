import { describe, it, expect } from "vitest";
import {
  periodosReservaSobrepoem,
  imovelTemGaragem,
  chavePredioGaragem,
  chavePredioImovel,
  garagemEstaLivre,
  listarGaragensLivres,
  contarVagasLivres,
  primeiraGaragemLivre,
  codigoGaragem,
  garagensDoImovel,
} from "./garagens";
import type { Garagem, Imovel, Reserva } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImovel(overrides: Partial<Imovel> = {}): Imovel {
  return {
    id: "i1",
    user_id: "u1",
    matricula: "AP-101",
    estado: "SP",
    cidade: "São Paulo",
    bairro: "Centro",
    predio: "Ed. Alfa",
    unidade: "101",
    valor_imovel: 0,
    tipo: "apartamento",
    modalidade_aluguel: "diaria",
    diaria: 0,
    cap: 0,
    status: "ativo",
    obs: "",
    custo_condominio: 0, custo_energia: 0, custo_internet: 0, custo_limpeza: 0,
    repasse_condominio: 0, repasse_energia: 0, repasse_internet: 0, repasse_limpeza: 0,
    iptu_anual: 0, repasse_iptu_anual: 0, itbi: 0,
    qtd_garagens: 1,
    ...overrides,
  };
}

function makeGaragem(overrides: Partial<Garagem> = {}): Garagem {
  return {
    id: "g1",
    user_id: "u1",
    estado: "SP",
    cidade: "São Paulo",
    predio: "Ed. Alfa",
    codigo: "G01",
    status: "livre",
    obs: "",
    ...overrides,
  };
}

function makeReserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r1",
    user_id: "u1",
    imovel_id: "i1",
    hospede: "Hóspede",
    checkin: "2024-06-10",
    checkout: "2024-06-15",
    valor: 500,
    origem: "airbnb",
    obs: "",
    precisa_garagem: true,
    garagem_id: "g1",
    custo_limpeza: 0,
    custo_energia: 0,
    custo_outros: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// periodosReservaSobrepoem
// ---------------------------------------------------------------------------

describe("periodosReservaSobrepoem", () => {
  it("detecta sobreposição normal", () => {
    expect(periodosReservaSobrepoem("2024-06-10", "2024-06-15", "2024-06-12", "2024-06-17")).toBe(true);
  });

  it("check-out de A = check-in de B → não sobrepõe (exclusivo)", () => {
    expect(periodosReservaSobrepoem("2024-06-10", "2024-06-15", "2024-06-15", "2024-06-20")).toBe(false);
  });

  it("períodos disjuntos", () => {
    expect(periodosReservaSobrepoem("2024-06-01", "2024-06-05", "2024-06-10", "2024-06-15")).toBe(false);
  });

  it("A contém B", () => {
    expect(periodosReservaSobrepoem("2024-06-01", "2024-06-30", "2024-06-10", "2024-06-15")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// imovelTemGaragem
// ---------------------------------------------------------------------------

describe("imovelTemGaragem", () => {
  it("retorna true quando qtd_garagens > 0", () => {
    expect(imovelTemGaragem(makeImovel({ qtd_garagens: 2 }))).toBe(true);
  });

  it("retorna false quando qtd_garagens = 0", () => {
    expect(imovelTemGaragem(makeImovel({ qtd_garagens: 0 }))).toBe(false);
  });

  it("retorna false quando qtd_garagens é undefined", () => {
    expect(imovelTemGaragem(makeImovel({ qtd_garagens: undefined as unknown as number }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chavePredioGaragem / chavePredioImovel
// ---------------------------------------------------------------------------

describe("chaves de prédio", () => {
  it("gera chave lowercase", () => {
    expect(chavePredioGaragem("SP", "São Paulo", "Ed. Alfa")).toBe("sp|são paulo|ed. alfa");
  });

  it("chavePredioImovel usa predio do imóvel", () => {
    const im = makeImovel();
    const chave = chavePredioImovel(im);
    expect(chave).toBe("sp|são paulo|ed. alfa");
  });
});

// ---------------------------------------------------------------------------
// garagensDoImovel
// ---------------------------------------------------------------------------

describe("garagensDoImovel", () => {
  it("retorna garagem do mesmo prédio", () => {
    const im = makeImovel();
    const g = makeGaragem();
    expect(garagensDoImovel(im, [g])).toHaveLength(1);
  });

  it("exclui garagem de outro prédio", () => {
    const im = makeImovel();
    const g = makeGaragem({ predio: "Ed. Beta" });
    expect(garagensDoImovel(im, [g])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// garagemEstaLivre
// ---------------------------------------------------------------------------

describe("garagemEstaLivre", () => {
  it("garagem livre sem reservas", () => {
    expect(garagemEstaLivre(makeGaragem(), [])).toBe(true);
  });

  it("garagem bloqueada é sempre ocupada", () => {
    expect(garagemEstaLivre(makeGaragem({ status: "bloqueada" }), [])).toBe(false);
  });

  it("reserva que se sobrepõe ocupa a garagem", () => {
    const r = makeReserva({ checkin: "2024-06-10", checkout: "2024-06-15" });
    expect(garagemEstaLivre(makeGaragem(), [r], "2024-06-12", "2024-06-14")).toBe(false);
  });

  it("reserva fora do período — garagem livre", () => {
    const r = makeReserva({ checkin: "2024-06-20", checkout: "2024-06-25" });
    expect(garagemEstaLivre(makeGaragem(), [r], "2024-06-10", "2024-06-15")).toBe(true);
  });

  it("reserva sem precisa_garagem não bloqueia", () => {
    const r = makeReserva({ precisa_garagem: false });
    expect(garagemEstaLivre(makeGaragem(), [r], "2024-06-12", "2024-06-14")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listarGaragensLivres / contarVagasLivres / primeiraGaragemLivre
// ---------------------------------------------------------------------------

describe("listarGaragensLivres / contarVagasLivres / primeiraGaragemLivre", () => {
  const im = makeImovel();
  const g1 = makeGaragem({ id: "g1", codigo: "G01" });
  const g2 = makeGaragem({ id: "g2", codigo: "G02" });
  const r1 = makeReserva({ garagem_id: "g1", checkin: "2024-06-10", checkout: "2024-06-15" });

  it("retorna garagens livres ordenadas por código", () => {
    const livres = listarGaragensLivres(im, [g1, g2], [r1], "2024-06-11", "2024-06-14");
    expect(livres.map((g) => g.codigo)).toEqual(["G02"]);
  });

  it("contarVagasLivres retorna contagem", () => {
    expect(contarVagasLivres(im, [g1, g2], [r1], "2024-06-11", "2024-06-14")).toBe(1);
  });

  it("primeiraGaragemLivre retorna a primeira livre", () => {
    const g = primeiraGaragemLivre(im, [g1, g2], [r1], "2024-06-11", "2024-06-14");
    expect(g?.codigo).toBe("G02");
  });

  it("primeiraGaragemLivre retorna null se nenhuma livre", () => {
    const r2 = makeReserva({ id: "r2", garagem_id: "g2", checkin: "2024-06-10", checkout: "2024-06-15" });
    expect(primeiraGaragemLivre(im, [g1, g2], [r1, r2], "2024-06-11", "2024-06-14")).toBeNull();
  });

  it("excluirReservaId ignora a reserva excluída", () => {
    const livres = listarGaragensLivres(im, [g1, g2], [r1], "2024-06-11", "2024-06-14", "r1");
    expect(livres).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// codigoGaragem
// ---------------------------------------------------------------------------

describe("codigoGaragem", () => {
  const garagens = [makeGaragem({ id: "g1", codigo: "G01" })];

  it("retorna código da garagem pelo id", () => {
    expect(codigoGaragem("g1", garagens)).toBe("G01");
  });

  it("retorna string vazia para null", () => {
    expect(codigoGaragem(null, garagens)).toBe("");
  });

  it("retorna string vazia para id inexistente", () => {
    expect(codigoGaragem("g99", garagens)).toBe("");
  });
});
