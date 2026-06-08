import type { Imovel } from "./types";

const SEM_PREDIO = "(Sem prédio)";
const SEM_UNIDADE = "(Sem unidade)";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function labelEstado(im: Imovel): string {
  const e = im.estado?.trim();
  return e || "—";
}

export function labelPredio(im: Imovel): string {
  const p = im.predio?.trim();
  return p || SEM_PREDIO;
}

export function labelUnidade(im: Imovel): string {
  const u = im.unidade?.trim();
  return u || im.matricula?.trim() || SEM_UNIDADE;
}

/** Chave para agrupar unidades iguais no mesmo prédio (auto-agrupa mesma unidade) */
export function chaveGrupoUnidade(im: Imovel): string {
  const predio = labelPredio(im);
  const u = im.unidade?.trim();
  let unidadeKey: string;
  if (u && norm(u) === norm(predio)) {
    unidadeKey = `ref-predio-${norm(predio)}`;
  } else {
    unidadeKey = norm(u || im.matricula || im.id);
  }
  return [
    norm(im.estado || ""),
    norm(im.cidade || ""),
    norm(predio),
    unidadeKey,
  ].join("|");
}

export interface MapaUnidadeGrupo {
  unidadeLabel: string;
  imoveis: Imovel[];
}

export interface MapaPredioNode {
  predioLabel: string;
  grupos: MapaUnidadeGrupo[];
  totalValor: number;
  qtdUnidades: number;
}

export interface MapaCidadeNode {
  cidadeLabel: string;
  predios: MapaPredioNode[];
}

export interface MapaEstadoNode {
  estadoLabel: string;
  cidades: MapaCidadeNode[];
}

export interface FiltrosMapa {
  estado?: string;
  cidade?: string;
  predio?: string;
}

export function filtrarImoveisMapa(
  imoveis: Imovel[],
  filtros: FiltrosMapa
): Imovel[] {
  return imoveis.filter((im) => {
    if (filtros.estado && labelEstado(im) !== filtros.estado) return false;
    if (filtros.cidade && (im.cidade?.trim() || "—") !== filtros.cidade)
      return false;
    if (filtros.predio && labelPredio(im) !== filtros.predio) return false;
    return true;
  });
}

export function listarEstados(imoveis: Imovel[]): string[] {
  return [...new Set(imoveis.map(labelEstado))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function listarCidades(imoveis: Imovel[], estado?: string): string[] {
  const base = estado
    ? imoveis.filter((i) => labelEstado(i) === estado)
    : imoveis;
  return [...new Set(base.map((i) => i.cidade?.trim() || "—"))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function listarPredios(
  imoveis: Imovel[],
  estado?: string,
  cidade?: string
): string[] {
  let base = imoveis;
  if (estado) base = base.filter((i) => labelEstado(i) === estado);
  if (cidade) base = base.filter((i) => (i.cidade?.trim() || "—") === cidade);
  return [...new Set(base.map(labelPredio))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function buildMapaHierarchy(imoveis: Imovel[]): MapaEstadoNode[] {
  const porEstado = new Map<string, Imovel[]>();

  for (const im of imoveis) {
    const est = labelEstado(im);
    if (!porEstado.has(est)) porEstado.set(est, []);
    porEstado.get(est)!.push(im);
  }

  const estados: MapaEstadoNode[] = [];

  for (const [estadoLabel, imsEstado] of [...porEstado.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  )) {
    const porCidade = new Map<string, Imovel[]>();
    for (const im of imsEstado) {
      const cid = im.cidade?.trim() || "—";
      if (!porCidade.has(cid)) porCidade.set(cid, []);
      porCidade.get(cid)!.push(im);
    }

    const cidades: MapaCidadeNode[] = [];

    for (const [cidadeLabel, imsCidade] of [...porCidade.entries()].sort(
      (a, b) => a[0].localeCompare(b[0], "pt-BR")
    )) {
      const porPredio = new Map<string, Imovel[]>();
      for (const im of imsCidade) {
        const pr = labelPredio(im);
        if (!porPredio.has(pr)) porPredio.set(pr, []);
        porPredio.get(pr)!.push(im);
      }

      const predios: MapaPredioNode[] = [];

      for (const [predioLabel, imsPredio] of [...porPredio.entries()].sort(
        (a, b) => a[0].localeCompare(b[0], "pt-BR")
      )) {
        const porUnidade = new Map<string, Imovel[]>();
        for (const im of imsPredio) {
          const key = chaveGrupoUnidade(im);
          if (!porUnidade.has(key)) porUnidade.set(key, []);
          porUnidade.get(key)!.push(im);
        }

        const grupos: MapaUnidadeGrupo[] = [...porUnidade.values()]
          .map((lista) => ({
            unidadeLabel: labelUnidade(lista[0]),
            imoveis: lista.sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR")),
          }))
          .sort((a, b) =>
            a.unidadeLabel.localeCompare(b.unidadeLabel, "pt-BR")
          );

        const totalValor = imsPredio.reduce(
          (s, i) => s + Number(i.valor_imovel || 0),
          0
        );
        const qtdUnidades = grupos.length;

        predios.push({ predioLabel, grupos, totalValor, qtdUnidades });
      }

      cidades.push({ cidadeLabel, predios });
    }

    estados.push({ estadoLabel, cidades });
  }

  return estados;
}
