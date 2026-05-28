"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { PageHeader } from "@/components/PageHeader";
import { fmtMoeda, getResumoCustos } from "@/lib/custos";
import {
  MONTHS,
  getOcupacao,
  getReceitaMes,
  occColor,
} from "@/lib/metrics";
import type { Imovel, Reserva } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

export function DashboardView({
  imoveis,
  reservas,
}: {
  imoveis: Imovel[];
  reservas: Reserva[];
}) {
  const now = new Date();
  const curMes = now.getMonth();
  const curYear = now.getFullYear();
  const ativos = imoveis.filter((i) => i.status === "ativo");

  const occs = ativos.map((i) => getOcupacao(i.id, curMes, curYear, reservas));
  const avgOcc = occs.length
    ? Math.round(occs.reduce((a, b) => a + b, 0) / occs.length)
    : 0;
  const receitaMes = getReceitaMes(null, curMes, curYear, reservas);
  const custosMes = ativos.reduce(
    (s, i) => s + getResumoCustos(i).custoLiquido,
    0
  );
  const resultadoMes = receitaMes - custosMes;
  const reservasMes = reservas.filter((r) => {
    const ci = new Date(r.checkin);
    return ci.getMonth() === curMes && ci.getFullYear() === curYear;
  }).length;

  const sorted = ativos
    .map((i) => ({
      i,
      occ: getOcupacao(i.id, curMes, curYear, reservas),
    }))
    .sort((a, b) => b.occ - a.occ);

  const trend = useMemo(() => {
    const labels: string[] = [];
    const trendOcc: number[] = [];
    const trendRec: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const mesIdx = now.getMonth() - i;
      const m = (mesIdx + 12) % 12;
      const y = mesIdx < 0 ? curYear - 1 : curYear;
      labels.push(MONTHS[m]);
      const o = ativos.map((im) => getOcupacao(im.id, m, y, reservas));
      trendOcc.push(
        o.length ? Math.round(o.reduce((a, b) => a + b, 0) / o.length) : 0
      );
      trendRec.push(Math.round(getReceitaMes(null, m, y, reservas) / 1000));
    }
    return { labels, trendOcc, trendRec };
  }, [ativos, reservas, curYear, now]);

  const alertas: { tipo: string; msg: string }[] = [];
  ativos.forEach((i) => {
    const occ = getOcupacao(i.id, curMes, curYear, reservas);
    if (occ < 30)
      alertas.push({
        tipo: "danger",
        msg: `<strong>${i.nome}</strong> — ocupação muito baixa: ${occ}%`,
      });
  });
  imoveis
    .filter((i) => i.status === "manutencao")
    .forEach((i) =>
      alertas.push({
        tipo: "warn",
        msg: `<strong>${i.nome}</strong> — em manutenção${i.obs ? ": " + i.obs : ""}`,
      })
    );
  imoveis
    .filter((i) => i.status === "bloqueado")
    .forEach((i) =>
      alertas.push({
        tipo: "warn",
        msg: `<strong>${i.nome}</strong> — bloqueado`,
      })
    );
  if (!alertas.length)
    alertas.push({
      tipo: "success",
      msg: "Nenhum alerta no momento. Portfólio saudável.",
    });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão consolidada de todos os imóveis"
      />
      <div className="metrics-grid">
        <div className="mc">
          <div className="mc-label">Imóveis ativos</div>
          <div className="mc-val">{ativos.length}</div>
          <div className="mc-sub">de {imoveis.length} total</div>
        </div>
        <div className="mc">
          <div className="mc-label">Ocupação média</div>
          <div className="mc-val" style={{ color: occColor(avgOcc) }}>
            {avgOcc}%
          </div>
          <div className="mc-sub">{MONTHS[curMes]}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Vacância média</div>
          <div className="mc-val">{100 - avgOcc}%</div>
          <div className="mc-sub">{MONTHS[curMes]}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Receita do mês</div>
          <div className="mc-val">R$ {Math.round(receitaMes / 1000)}k</div>
          <div className="mc-sub">{reservasMes} reservas</div>
        </div>
        <div className="mc">
          <div className="mc-label">Custos do mês</div>
          <div className="mc-val">R$ {fmtMoeda(custosMes)}</div>
          <div className="mc-sub">líquido (após repasse)</div>
        </div>
        <div className="mc">
          <div className="mc-label">Resultado líquido</div>
          <div
            className="mc-val"
            style={{ color: resultadoMes >= 0 ? "#1D9E75" : "#E24B4A" }}
          >
            R$ {fmtMoeda(Math.round(resultadoMes))}
          </div>
          <div className="mc-sub">{MONTHS[curMes]}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Em manutenção</div>
          <div className="mc-val">
            {imoveis.filter((i) => i.status === "manutencao").length}
          </div>
          <div className="mc-sub">imóveis</div>
        </div>
        <div className="mc">
          <div className="mc-label">Bloqueados</div>
          <div className="mc-val">
            {imoveis.filter((i) => i.status === "bloqueado").length}
          </div>
          <div className="mc-sub">imóveis</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Ocupação por imóvel — mês atual</div>
          {sorted.map(({ i, occ }) => (
            <div key={i.id} className="rank-bar">
              <span className="rank-name" title={i.nome}>
                {i.nome}
              </span>
              <div className="rank-track">
                <div
                  className="rank-fill"
                  style={{ width: `${occ}%`, background: occColor(occ) }}
                />
              </div>
              <span className="rank-val">{occ}%</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Tendência — últimos 6 meses</div>
          <div className="chart-legend">
            <span>
              <span
                className="legend-dot"
                style={{ background: "#1D9E75" }}
              />
              Ocupação %
            </span>
            <span>
              <span
                className="legend-dot"
                style={{ background: "#378ADD" }}
              />
              Receita (R$ mil)
            </span>
          </div>
          <div style={{ position: "relative", height: 220 }}>
            <Chart
              type="bar"
              data={{
                labels: trend.labels,
                datasets: [
                  {
                    label: "Ocupação %",
                    data: trend.trendOcc,
                    backgroundColor: "rgba(29,158,117,0.7)",
                    yAxisID: "y",
                  },
                  {
                    label: "Receita (R$k)",
                    data: trend.trendRec,
                    type: "line",
                    borderColor: "#378ADD",
                    backgroundColor: "rgba(55,138,221,0.1)",
                    tension: 0.3,
                    yAxisID: "y2",
                    pointRadius: 3,
                    pointBackgroundColor: "#378ADD",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    position: "left",
                    ticks: { callback: (v) => v + "%", font: { size: 11 } },
                    grid: { color: "rgba(0,0,0,0.05)" },
                    max: 100,
                    min: 0,
                  },
                  y2: {
                    position: "right",
                    ticks: {
                      callback: (v) => "R$" + v + "k",
                      font: { size: 11 },
                    },
                    grid: { display: false },
                  },
                  x: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Alertas</div>
        {alertas.map((a, idx) => (
          <div
            key={idx}
            className={`alert alert-${a.tipo}`}
            dangerouslySetInnerHTML={{ __html: a.msg }}
          />
        ))}
      </div>
    </>
  );
}
