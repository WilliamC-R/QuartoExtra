"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { BuildingIcon } from "@/components/icons/BuildingIcon";
import { PageHeader } from "@/components/PageHeader";
import { fmtMoeda, getResumoCustos } from "@/lib/custos";
import {
  buildMapaHierarchy,
  filtrarImoveisMapa,
  listarCidades,
  listarEstados,
  listarPredios,
} from "@/lib/mapa";
import { getReceitaMes } from "@/lib/metrics";
import {
  anualizarReceita,
  fmtRentabilidade,
  rentabilidadeAnual,
} from "@/lib/rentabilidade";
import type { Imovel, Reserva } from "@/lib/types";

function rentabImovel(
  im: Imovel,
  receitaMes: number,
  custoLiquidoMes: number
): number {
  const liquidaAnual = anualizarReceita(receitaMes - custoLiquidoMes, 1);
  return rentabilidadeAnual(liquidaAnual, Number(im.valor_imovel) || 0);
}

export function MapaView({
  imoveis,
  reservas,
}: {
  imoveis: Imovel[];
  reservas: Reserva[];
}) {
  const now = new Date();
  const curMes = now.getMonth();
  const curYear = now.getFullYear();

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroPredio, setFiltroPredio] = useState("");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const estadosOpts = useMemo(() => listarEstados(imoveis), [imoveis]);
  const cidadesOpts = useMemo(
    () => listarCidades(imoveis, filtroEstado || undefined),
    [imoveis, filtroEstado]
  );
  const prediosOpts = useMemo(
    () =>
      listarPredios(
        imoveis,
        filtroEstado || undefined,
        filtroCidade || undefined
      ),
    [imoveis, filtroEstado, filtroCidade]
  );

  const filtrados = useMemo(
    () =>
      filtrarImoveisMapa(imoveis, {
        estado: filtroEstado || undefined,
        cidade: filtroCidade || undefined,
        predio: filtroPredio || undefined,
      }),
    [imoveis, filtroEstado, filtroCidade, filtroPredio]
  );

  const arvore = useMemo(() => buildMapaHierarchy(filtrados), [filtrados]);

  function toggle(key: string) {
    setAbertos((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isOpen(key: string, defaultOpen = false) {
    if (key in abertos) return abertos[key];
    return defaultOpen;
  }

  return (
    <>
      <PageHeader
        title="Mapa de imóveis"
        description="Estado → cidade → prédio → unidades (mesma unidade agrupa automaticamente)"
      />

      <div className="toolbar">
        <div className="filter-row">
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setFiltroCidade("");
              setFiltroPredio("");
            }}
          >
            <option value="">Todos os estados</option>
            {estadosOpts.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select
            value={filtroCidade}
            onChange={(e) => {
              setFiltroCidade(e.target.value);
              setFiltroPredio("");
            }}
          >
            <option value="">Todas as cidades</option>
            {cidadesOpts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filtroPredio}
            onChange={(e) => setFiltroPredio(e.target.value)}
          >
            <option value="">Todos os prédios</option>
            {prediosOpts.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 12, color: "#888" }}>
          {filtrados.length} imóvel(is) · {arvore.length} estado(s)
        </span>
      </div>

      {arvore.length === 0 ? (
        <div className="card" style={{ color: "#888", fontSize: 13 }}>
          Nenhum imóvel para exibir com os filtros atuais.
        </div>
      ) : (
        <div className="mapa-tree">
          {arvore.map((est) => {
            const kEst = `est-${est.estadoLabel}`;
            const openEst = isOpen(kEst, true);
            return (
              <div key={kEst} className="mapa-node mapa-node-estado">
                <button
                  type="button"
                  className="mapa-node-head"
                  onClick={() => toggle(kEst)}
                >
                  {openEst ? (
                    <IconChevronDown size={16} />
                  ) : (
                    <IconChevronRight size={16} />
                  )}
                  <span className="mapa-node-title">{est.estadoLabel}</span>
                  <span className="mapa-node-meta">
                    {est.cidades.length} cidade(s)
                  </span>
                </button>
                {openEst &&
                  est.cidades.map((cid) => {
                    const kCid = `${kEst}-cid-${cid.cidadeLabel}`;
                    const openCid = isOpen(kCid, filtroCidade !== "");
                    return (
                      <div key={kCid} className="mapa-node mapa-node-cidade">
                        <button
                          type="button"
                          className="mapa-node-head"
                          onClick={() => toggle(kCid)}
                        >
                          {openCid ? (
                            <IconChevronDown size={14} />
                          ) : (
                            <IconChevronRight size={14} />
                          )}
                          <span className="mapa-node-title">
                            {cid.cidadeLabel}
                          </span>
                          <span className="mapa-node-meta">
                            {cid.predios.length} prédio(s)
                          </span>
                        </button>
                        {openCid &&
                          cid.predios.map((pr) => {
                            const kPr = `${kCid}-pr-${pr.predioLabel}`;
                            const openPr = isOpen(kPr, filtroPredio !== "");
                            const recPredio = pr.grupos.reduce((s, g) => {
                              return (
                                s +
                                g.imoveis.reduce(
                                  (s2, im) =>
                                    s2 +
                                    getReceitaMes(
                                      im.id,
                                      curMes,
                                      curYear,
                                      reservas
                                    ),
                                  0
                                )
                              );
                            }, 0);
                            const custoPredio = pr.grupos.reduce((s, g) => {
                              return (
                                s +
                                g.imoveis.reduce(
                                  (s2, im) =>
                                    s2 + getResumoCustos(im).custoLiquido,
                                  0
                                )
                              );
                            }, 0);
                            const rentabPr = rentabilidadeAnual(
                              anualizarReceita(recPredio - custoPredio, 1),
                              pr.totalValor
                            );

                            return (
                              <div
                                key={kPr}
                                className="mapa-node mapa-node-predio"
                              >
                                <button
                                  type="button"
                                  className="mapa-node-head"
                                  onClick={() => toggle(kPr)}
                                >
                                  {openPr ? (
                                    <IconChevronDown size={14} />
                                  ) : (
                                    <IconChevronRight size={14} />
                                  )}
                                  <span className="mapa-node-title">
                                    {pr.predioLabel}
                                  </span>
                                  <span className="mapa-node-meta">
                                    {pr.qtdUnidades} unidade(s) · Valor R${" "}
                                    {fmtMoeda(pr.totalValor)}
                                    {pr.totalValor > 0 && (
                                      <> · {fmtRentabilidade(rentabPr)}</>
                                    )}
                                  </span>
                                </button>
                                {openPr && (
                                  <div className="mapa-unidades">
                                    {pr.grupos.map((gr) => (
                                      <div
                                        key={gr.unidadeLabel + gr.imoveis[0].id}
                                        className={`mapa-unidade-card${gr.imoveis.length > 1 ? " mapa-unidade-agrupada" : ""}`}
                                      >
                                        <div className="mapa-unidade-head">
                                          <span style={{ fontWeight: 500 }}>
                                            {gr.unidadeLabel}
                                          </span>
                                          {gr.imoveis.length > 1 && (
                                            <span className="badge badge-blue">
                                              {gr.imoveis.length} no mesmo
                                              grupo
                                            </span>
                                          )}
                                        </div>
                                        <div className="mapa-buildings-row">
                                          {gr.imoveis.map((im) => (
                                            <BuildingIcon
                                              key={im.id}
                                              label={
                                                im.unidade?.trim() ||
                                                im.matricula.slice(0, 12)
                                              }
                                              sublabel={
                                                (im.qtd_garagens ?? 0) > 0
                                                  ? `${im.qtd_garagens} gar.`
                                                  : undefined
                                              }
                                              active={im.status === "ativo"}
                                            />
                                          ))}
                                        </div>
                                        {gr.imoveis.map((im) => {
                                          const rec = getReceitaMes(
                                            im.id,
                                            curMes,
                                            curYear,
                                            reservas
                                          );
                                          const custo =
                                            getResumoCustos(im).custoLiquido;
                                          const rentab = rentabImovel(
                                            im,
                                            rec,
                                            custo
                                          );
                                          return (
                                            <div
                                              key={im.id}
                                              className="mapa-imovel-linha"
                                            >
                                              <div>
                                                <div>{im.matricula}</div>
                                                <div
                                                  style={{
                                                    fontSize: 11,
                                                    color: "#888",
                                                  }}
                                                >
                                                  {im.bairro}
                                                  {im.tipo
                                                    ? ` · ${im.tipo}`
                                                    : ""}
                                                </div>
                                              </div>
                                              <div className="mapa-imovel-stats">
                                                <span>
                                                  Valor R${" "}
                                                  {fmtMoeda(
                                                    Number(im.valor_imovel) ||
                                                      0
                                                  )}
                                                </span>
                                                <span>
                                                  Rec. mês R${" "}
                                                  {fmtMoeda(rec)}
                                                </span>
                                                <span
                                                  style={{
                                                    color:
                                                      rentab >= 10.5
                                                        ? "#1D9E75"
                                                        : rentab > 0
                                                          ? "#EF9F27"
                                                          : "#888",
                                                  }}
                                                >
                                                  {Number(im.valor_imovel) > 0
                                                    ? fmtRentabilidade(rentab)
                                                    : "Informe valor"}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>
        Unidades com o mesmo estado, cidade, prédio e código de unidade são
        agrupadas automaticamente. Rentabilidade usa receita líquida do mês
        atual anualizada ÷ valor do imóvel.
      </p>
    </>
  );
}
