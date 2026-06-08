import { describe, it, expect } from "vitest";
import {
  rentabilidadeAnual,
  rentabilidadeMensal,
  cdiMensal,
  anualizarReceita,
  fmtRentabilidade,
  fmtRentabilidadeMensal,
} from "./rentabilidade";

describe("rentabilidadeAnual", () => {
  it("calcula retorno anual corretamente", () => {
    expect(rentabilidadeAnual(60_000, 1_000_000)).toBeCloseTo(6, 5);
  });

  it("retorna 0 quando valor do imóvel é 0", () => {
    expect(rentabilidadeAnual(60_000, 0)).toBe(0);
  });

  it("retorna 0 quando valor do imóvel é negativo", () => {
    expect(rentabilidadeAnual(60_000, -1)).toBe(0);
  });
});

describe("rentabilidadeMensal", () => {
  it("calcula rentabilidade mensal", () => {
    expect(rentabilidadeMensal(5_000, 1_000_000)).toBeCloseTo(0.5, 5);
  });

  it("retorna 0 com valor do imóvel 0", () => {
    expect(rentabilidadeMensal(5_000, 0)).toBe(0);
  });
});

describe("cdiMensal", () => {
  it("calcula CDI mensal de 13,75% a.a. (juros compostos)", () => {
    const mensal = cdiMensal(13.75);
    expect(mensal).toBeGreaterThan(1.07);
    expect(mensal).toBeLessThan(1.10);
  });

  it("CDI 0% a.a. → 0% a.m.", () => {
    expect(cdiMensal(0)).toBeCloseTo(0, 10);
  });
});

describe("anualizarReceita", () => {
  it("anualiza receita de 6 meses", () => {
    expect(anualizarReceita(30_000, 6)).toBeCloseTo(60_000, 5);
  });

  it("retorna 0 para 0 meses", () => {
    expect(anualizarReceita(30_000, 0)).toBe(0);
  });
});

describe("fmtRentabilidade", () => {
  it("formata 6.5 como '6.5% a.a.'", () => {
    expect(fmtRentabilidade(6.5)).toBe("6.5% a.a.");
  });

  it("retorna '-' para 0", () => {
    expect(fmtRentabilidade(0)).toBe("-");
  });

  it("retorna '-' para valor negativo", () => {
    expect(fmtRentabilidade(-1)).toBe("-");
  });
});

describe("fmtRentabilidadeMensal", () => {
  it("formata 0.5 como '0,50% a.m.'", () => {
    expect(fmtRentabilidadeMensal(0.5)).toBe("0,50% a.m.");
  });

  it("retorna '-' para 0", () => {
    expect(fmtRentabilidadeMensal(0)).toBe("-");
  });
});
