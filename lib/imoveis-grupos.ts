import { normalizeKey } from "./format";
import { labelPredio } from "./mapa";
import type { Imovel } from "./types";

export type GrupoImovelTipo = "predio" | "casa" | "unidade";

export interface GrupoImoveis {
  key: string;
  tipo: GrupoImovelTipo;
  titulo: string;
  subtitulo: string;
  imoveis: Imovel[];
  ativos: number;
}

function isTipoCasa(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return t === "casa" || t === "chalé" || t === "chale";
}

export function agruparImoveisParaGrid(imoveis: Imovel[]): GrupoImoveis[] {
  const map = new Map<string, Imovel[]>();

  for (const im of imoveis) {
    const predio = im.predio?.trim();
    let key: string;

    if (predio) {
      key = `predio|${normalizeKey(im.estado || "")}|${normalizeKey(im.cidade || "")}|${normalizeKey(predio)}`;
    } else if (isTipoCasa(im.tipo)) {
      key = `casa|${im.id}`;
    } else {
      key = `unidade|${im.id}`;
    }

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(im);
  }

  return [...map.entries()]
    .map(([key, lista]) => {
      const sorted = [...lista].sort((a, b) =>
        a.matricula.localeCompare(b.matricula, "pt-BR")
      );
      const first = sorted[0];
      const predio = first.predio?.trim();
      const ativos = sorted.filter((i) => i.status === "ativo").length;

      if (key.startsWith("predio|")) {
        const cidade = first.cidade?.trim();
        const estado = first.estado?.trim();
        return {
          key,
          tipo: "predio" as const,
          titulo: predio!,
          subtitulo: [
            estado,
            cidade,
            `${sorted.length} unidade${sorted.length !== 1 ? "s" : ""}`,
          ]
            .filter(Boolean)
            .join(" · "),
          imoveis: sorted,
          ativos,
        };
      }

      if (key.startsWith("casa|")) {
        return {
          key,
          tipo: "casa" as const,
          titulo: first.matricula,
          subtitulo: [first.cidade, first.bairro, first.tipo]
            .filter(Boolean)
            .join(" · "),
          imoveis: sorted,
          ativos,
        };
      }

      return {
        key,
        tipo: "unidade" as const,
        titulo: first.matricula,
        subtitulo: [labelPredio(first), first.unidade, first.tipo]
          .filter((s) => s && s !== "(Sem prédio)")
          .join(" · "),
        imoveis: sorted,
        ativos,
      };
    })
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}
