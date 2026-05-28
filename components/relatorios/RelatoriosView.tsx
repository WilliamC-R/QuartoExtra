"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { IconDownload, IconFileTypePdf } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { PDFExportModal } from "@/components/relatorios/PDFExportModal";
import {
  CUSTO_LIMPEZA_POR_RESERVA,
  ENERGIA_CUSTO_DIA,
  ENERGIA_CUSTO_KWH,
  ENERGIA_KWH_DIA,
  fmtMoeda,
  getCustoVariavelReserva,
  getResumoCustos,
} from "@/lib/custos";
import {
  cdiMensal,
  fmtRentabilidadeMensal,
  rentabilidadeMensal,
} from "@/lib/rentabilidade";
import {
  filterReservasPorPeriodo,
  getMesesAno,
  getMesesValidos,
  getOcupacao,
  getReceitaMes,
  getReceitaNoPeriodo,
  noitesEntre,
  occColor,
  parseDate,
} from "@/lib/metrics";
import type { Imovel, Reserva } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const CDI = 10.5;
const CDI_MENSAL = cdiMensal(CDI); // ~0.84% a.m.

export function RelatoriosView({
  imoveis,
  reservas,
}: {
  imoveis: Imovel[];
  reservas: Reserva[];
}) {
  const [periodoKey, setPeriodoKey] = useState("6");
  const [showPDFModal, setShowPDFModal] = useState(false);
  const now = new Date();

  const { mesesValidos, numMeses } = useMemo(() => {
    const ano = parseInt(periodoKey, 10);
    if (periodoKey === "3") return { mesesValidos: getMesesValidos(3, now), numMeses: 3 };
    if (periodoKey === "6") return { mesesValidos: getMesesValidos(6, now), numMeses: 6 };
    if (periodoKey === "12") return { mesesValidos: getMesesValidos(12, now), numMeses: 12 };
    return { mesesValidos: getMesesAno(ano), numMeses: 12 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoKey]);

  const resFiltradas = useMemo(
    () => filterReservasPorPeriodo(reservas, mesesValidos),
    [reservas, mesesValidos]
  );

  const totalReceita = resFiltradas.reduce(
    (s, r) => s + getReceitaNoPeriodo(r, mesesValidos),
    0
  );
  const custosFixosPeriodo = imoveis.reduce(
    (s, i) => s + getResumoCustos(i).custoLiquido * numMeses,
    0
  );
  const custoVariavelTotal = resFiltradas.reduce(
    (s, r) => s + getCustoVariavelReserva(r, mesesValidos),
    0
  );
  const custosPeriodo = custosFixosPeriodo + custoVariavelTotal;
  const resultadoLiquido = totalReceita - custosPeriodo;
  const totalReservas = resFiltradas.length;
  const totalNoites = resFiltradas.reduce(
    (s, r) => s + noitesEntre(r.checkin, r.checkout),
    0
  );
  const ativosRel = imoveis.filter((i) => i.status === "ativo");
  const avgOcc2 = ativosRel.length && mesesValidos.length
    ? Math.round(
        ativosRel
          .map((i) =>
            mesesValidos
              .map(({ m, y }) => getOcupacao(i.id, m, y, reservas))
              .reduce((a, b) => a + b, 0) / mesesValidos.length
          )
          .reduce((a, b) => a + b, 0) / ativosRel.length
      )
    : 0;

  const recPorImovel = imoveis
    .map((i) => ({
      nome: i.nome.length > 16 ? i.nome.slice(0, 16) + "…" : i.nome,
      rec: resFiltradas
        .filter((r) => r.imovel_id === i.id)
        .reduce((s, r) => s + getReceitaNoPeriodo(r, mesesValidos), 0),
    }))
    .filter((x) => x.rec > 0)
    .sort((a, b) => b.rec - a.rec)
    .slice(0, 10);

  const origens: Record<string, number> = {};
  resFiltradas.forEach((r) => {
    origens[r.origem] = (origens[r.origem] || 0) + 1;
  });
  const origLabels = Object.keys(origens);
  const origVals = Object.values(origens);

  const diasPeriodo = mesesValidos.reduce(
    (sum, { m, y }) => sum + new Date(y, m + 1, 0).getDate(),
    0
  );

  const ultimoMes = mesesValidos.length > 0
    ? mesesValidos[mesesValidos.length - 1]
    : { m: now.getMonth(), y: now.getFullYear() };

  const rows = imoveis
    .map((i) => {
      const rs = resFiltradas.filter((r) => r.imovel_id === i.id);
      const rec = rs.reduce((s, r) => s + getReceitaNoPeriodo(r, mesesValidos), 0);
      const nightsSet = new Set<string>();
      for (const r of rs) {
        const ci = parseDate(r.checkin);
        const co = parseDate(r.checkout);
        for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
          if (mesesValidos.some(({ m, y }) => d.getMonth() === m && d.getFullYear() === y))
            nightsSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
      const noites = nightsSet.size;
      const occ = diasPeriodo > 0 ? Math.min(100, Math.round((noites / diasPeriodo) * 100)) : 0;
      const custosMes = getResumoCustos(i).custoLiquido;
      const custosFixos = custosMes * numMeses;
      const custoVariavel = rs.reduce(
        (s, r) => s + getCustoVariavelReserva(r, mesesValidos),
        0
      );
      const custosNoPeriodo = custosFixos + custoVariavel;
      const resultado = rec - custosNoPeriodo;

      // Rentabilidade do ultimo mes do periodo selecionado
      const valorImovel = Number(i.valor_imovel) || 0;
      const recUM = getReceitaMes(i.id, ultimoMes.m, ultimoMes.y, reservas);
      const custoVarUM = reservas
        .filter((r) => r.imovel_id === i.id)
        .reduce((acc, r) => acc + getCustoVariavelReserva(r, [ultimoMes]), 0);
      const resultadoUM = recUM - custosMes - custoVarUM;
      const retMensal = rentabilidadeMensal(resultadoUM, valorImovel);

      return {
        nome: i.nome,
        predio: i.predio,
        unidade: i.unidade,
        valorImovel,
        reservas: rs.length,
        noites,
        occ,
        rec,
        ticket: rs.length ? Math.round(rec / rs.length) : 0,
        retMensal,
        custosMes,
        custosFixos,
        custoVariavel,
        custosNoPeriodo,
        resultado,
      };
    })
    .filter((x) => x.reservas > 0 || x.custosMes > 0)
    .sort((a, b) => b.rec - a.rec);

  function exportCSV() {
    const rs = resFiltradas;
    const header =
      "Imóvel,Bairro,Hóspede,Check-in,Check-out,Noites,Valor,Origem\n";
    const csvRows = rs
      .map((r) => {
        const im = imoveis.find((i) => i.id === r.imovel_id);
        const noites = noitesEntre(r.checkin, r.checkout);
        return `"${im ? im.nome : ""}","${im ? im.bairro : ""}","${r.hospede}","${r.checkin}","${r.checkout}",${noites},${r.valor},"${r.origem}"`;
      })
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + csvRows], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vacancia_relatorio.csv";
    a.click();
  }

  const chartHeight = Math.max(200, recPorImovel.length * 36 + 60);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Análise de performance por período"
      />
      <div className="toolbar">
        <div className="filter-row">
          <select
            value={periodoKey}
            onChange={(e) => setPeriodoKey(e.target.value)}
          >
            <optgroup label="Rolante">
              <option value="3">Últimos 3 meses</option>
              <option value="6">Últimos 6 meses</option>
              <option value="12">Últimos 12 meses</option>
            </optgroup>
            <optgroup label="Ano calendário">
              <option value="2023">Ano 2023</option>
              <option value="2024">Ano 2024</option>
              <option value="2025">Ano 2025</option>
              <option value="2026">Ano 2026</option>
            </optgroup>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={exportCSV}>
            <IconDownload size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            className="pdf-open-btn"
            onClick={() => setShowPDFModal(true)}
          >
            <IconFileTypePdf size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="mc">
          <div className="mc-label">Receita total</div>
          <div className="mc-val">R$ {Math.round(totalReceita / 1000)}k</div>
          <div className="mc-sub">{numMeses} meses</div>
        </div>
        <div className="mc">
          <div className="mc-label">Reservas</div>
          <div className="mc-val">{totalReservas}</div>
          <div className="mc-sub">no período</div>
        </div>
        <div className="mc">
          <div className="mc-label">Noites vendidas</div>
          <div className="mc-val">{totalNoites}</div>
          <div className="mc-sub">total</div>
        </div>
        <div className="mc">
          <div className="mc-label">Ocupação média</div>
          <div className="mc-val" style={{ color: occColor(avgOcc2) }}>
            {avgOcc2}%
          </div>
          <div className="mc-sub">imóveis ativos</div>
        </div>
        <div className="mc">
          <div className="mc-label">Ticket médio</div>
          <div className="mc-val">
            R${" "}
            {totalReservas
              ? Math.round(totalReceita / totalReservas).toLocaleString(
                  "pt-BR"
                )
              : 0}
          </div>
          <div className="mc-sub">por reserva</div>
        </div>
        <div className="mc">
          <div className="mc-label">Receita/mês</div>
          <div className="mc-val">
            R$ {Math.round(totalReceita / numMeses / 1000)}k
          </div>
          <div className="mc-sub">média mensal</div>
        </div>
        <div className="mc">
          <div className="mc-label">Custos/mês</div>
          <div className="mc-val">
            R$ {fmtMoeda(Math.round(custosPeriodo / numMeses))}
          </div>
          <div className="mc-sub">líquido (após repasse)</div>
        </div>
        <div className="mc">
          <div className="mc-label">Resultado líquido</div>
          <div
            className="mc-val"
            style={{ color: resultadoLiquido >= 0 ? "#1D9E75" : "#E24B4A" }}
          >
            R$ {fmtMoeda(Math.round(resultadoLiquido))}
          </div>
          <div className="mc-sub">receita − custos no período</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Receita por imóvel</div>
          <div style={{ position: "relative", height: chartHeight }}>
            <Bar
              data={{
                labels: recPorImovel.map((x) => x.nome),
                datasets: [
                  {
                    label: "Receita",
                    data: recPorImovel.map((x) => Math.round(x.rec / 1000)),
                    backgroundColor: "rgba(29,158,117,0.75)",
                    borderWidth: 0,
                    borderRadius: 3,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: {
                      callback: (v) => "R$" + v + "k",
                      font: { size: 10 },
                    },
                    grid: { color: "rgba(0,0,0,0.05)" },
                  },
                  y: { ticks: { font: { size: 10 } }, grid: { display: false } },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-title">Reservas por origem</div>
          <div style={{ position: "relative", height: 260 }}>
            {origLabels.length > 0 ? (
              <Doughnut
                data={{
                  labels: origLabels,
                  datasets: [
                    {
                      data: origVals,
                      backgroundColor: [
                        "#1D9E75",
                        "#378ADD",
                        "#EF9F27",
                        "#888780",
                      ].slice(0, origLabels.length),
                      borderWidth: 2,
                      borderColor: "#fff",
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: { font: { size: 11 }, padding: 14, boxWidth: 10 },
                    },
                  },
                }}
              />
            ) : (
              <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", paddingTop: 80 }}>
                Sem dados no período
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl relatorio-table">
          <thead>
            <tr>
              <th style={{ width: "20%" }}>Imóvel</th>
              <th style={{ width: "9%" }}>Reservas</th>
              <th style={{ width: "9%" }}>Noites</th>
              <th style={{ width: "9%" }}>Ocupação</th>
              <th style={{ width: "12%" }}>Receita</th>
              <th style={{ width: "12%" }}>Custos</th>
              <th style={{ width: "12%" }}>Resultado</th>
              <th style={{ width: "9%" }}>Ticket</th>
              <th style={{ width: "8%" }}>Rent. a.m.<div style={{ fontSize: 9, fontWeight: 400, color: "#aaa" }}>último mês</div></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#aaa", padding: 24 }}>
                  Nenhum dado no período
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.nome}>
                  <td style={{ fontWeight: 500 }}>{r.nome}</td>
                  <td>{r.reservas}</td>
                  <td>{r.noites}</td>
                  <td>
                    <span
                      className={`badge ${r.occ >= 70 ? "badge-ok" : r.occ >= 40 ? "badge-warn" : "badge-bad"}`}
                    >
                      {r.occ}%
                    </span>
                  </td>
                  <td>R$ {r.rec.toLocaleString("pt-BR")}</td>
                  <td>R$ {fmtMoeda(r.custosNoPeriodo)}</td>
                  <td
                    style={{
                      color: r.resultado >= 0 ? "#1D9E75" : "#E24B4A",
                      fontWeight: 500,
                    }}
                  >
                    R$ {fmtMoeda(Math.round(r.resultado))}
                  </td>
                  <td>R$ {r.ticket.toLocaleString("pt-BR")}</td>
                  <td>
                    {r.valorImovel > 0 ? (
                      <span
                        className={`badge ${r.retMensal >= CDI_MENSAL ? "badge-ok" : "badge-bad"}`}
                        title={`CDI: ${CDI_MENSAL.toFixed(2).replace(".", ",")}% a.m.`}
                      >
                        {fmtRentabilidadeMensal(r.retMensal)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#aaa" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>
        * Rent. a.m. = resultado do último mês ÷ valor do imóvel. Verde se ≥ CDI de {CDI}% a.a. ({CDI_MENSAL.toFixed(2).replace(".", ",")}% a.m.).
        Custos incluem fixos (condomínio, IPTU, internet) + variáveis automáticos: limpeza R$ {CUSTO_LIMPEZA_POR_RESERVA}/reserva
        e energia {ENERGIA_KWH_DIA} kWh/dia × R$ {ENERGIA_CUSTO_KWH.toFixed(2)}/kWh (= R$ {ENERGIA_CUSTO_DIA.toFixed(2)}/noite).
      </p>

      {showPDFModal && (
        <PDFExportModal
          imoveis={imoveis}
          reservas={reservas}
          onClose={() => setShowPDFModal(false)}
        />
      )}
    </>
  );
}
