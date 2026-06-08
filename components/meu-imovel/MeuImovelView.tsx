"use client";

import { useMemo, type ReactNode } from "react";
import { IconBuildingEstate, IconCalendar, IconChartBar } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { fmtMoeda } from "@/lib/custos";
import { fmtDate, getOcupacao, getMesesValidos, getReceitaMes, MONTHS, occColor } from "@/lib/metrics";
import type { Imovel, Reserva } from "@/lib/types";

const badgeMap: Record<string, string> = {
  ativo: "badge-ok",
  manutencao: "badge-warn",
  bloqueado: "badge-block",
};

const labelMap: Record<string, string> = {
  ativo: "Ativo",
  manutencao: "Manutenção",
  bloqueado: "Bloqueado",
};

export function MeuImovelView({
  imovel,
  reservas,
  nomeCliente,
}: {
  imovel: Imovel | null;
  reservas: Reserva[];
  nomeCliente: string;
}) {
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const ultimos6 = useMemo(() => getMesesValidos(6), []);

  const ocupacaoAtual = imovel
    ? getOcupacao(imovel.id, mesAtual, anoAtual, reservas)
    : 0;

  const receitaAtual = imovel
    ? getReceitaMes(imovel.id, mesAtual, anoAtual, reservas)
    : 0;

  const receitaTotal = useMemo(() => {
    if (!imovel) return 0;
    return ultimos6.reduce((sum, { m, y }) => sum + getReceitaMes(imovel.id, m, y, reservas), 0);
  }, [imovel, reservas, ultimos6]);

  const reservasRecentes = reservas.slice(0, 10);

  if (!imovel) {
    return (
      <>
        <PageHeader title={`Olá, ${nomeCliente}`} description="Seu portal de acompanhamento" />
        <div className="card" style={{ textAlign: "center", padding: 48, color: "#888" }}>
          <IconBuildingEstate size={40} color="#ccc" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum imóvel vinculado</div>
          <div style={{ fontSize: 13 }}>
            Entre em contato com o gestor para vincular seu imóvel a esta conta.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Olá, ${nomeCliente}`}
        description={`Acompanhamento do imóvel · Matrícula ${imovel.matricula}`}
      />

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Ocupação (mês atual)</div>
          <div className="kpi-value" style={{ color: occColor(ocupacaoAtual) }}>
            {ocupacaoAtual}%
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Receita (mês atual)</div>
          <div className="kpi-value">{fmtMoeda(receitaAtual)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Receita (últimos 6 meses)</div>
          <div className="kpi-value">{fmtMoeda(receitaTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Reservas totais</div>
          <div className="kpi-value">{reservas.length}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16, marginBottom: 20 }}>
        {/* Detalhes do imóvel */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconBuildingEstate size={15} />
            Dados do imóvel
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <Row label="Matrícula" value={imovel.matricula} />
            {imovel.predio && <Row label="Empreendimento" value={imovel.predio} />}
            {imovel.unidade && <Row label="Unidade" value={imovel.unidade} />}
            {imovel.bairro && <Row label="Bairro" value={imovel.bairro} />}
            <Row label="Cidade / Estado" value={[imovel.cidade, imovel.estado].filter(Boolean).join(" — ")} />
            <Row label="Tipo" value={imovel.tipo} />
            <Row
              label="Status"
              value={
                <span className={`badge ${badgeMap[imovel.status] ?? "badge-ok"}`} style={{ fontSize: 11 }}>
                  {labelMap[imovel.status] ?? imovel.status}
                </span>
              }
            />
            <Row
              label="Modalidade"
              value={imovel.modalidade_aluguel === "mensal" ? "Aluguel mensal" : "Diária"}
            />
          </div>
        </div>

        {/* Ocupação 6 meses */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconChartBar size={15} />
            Ocupação — últimos 6 meses
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {ultimos6.map(({ m, y }) => {
              const occ = getOcupacao(imovel.id, m, y, reservas);
              return (
                <div
                  key={`${m}-${y}`}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <span style={{ fontSize: 10, color: "#888" }}>{occ}%</span>
                  <div
                    style={{
                      width: "100%",
                      height: Math.max(4, occ),
                      background: occColor(occ),
                      borderRadius: 4,
                      transition: "height 0.3s",
                    }}
                  />
                  <span style={{ fontSize: 10, color: "#888" }}>{MONTHS[m]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reservas recentes */}
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconCalendar size={15} />
          Histórico de reservas
        </div>

        {reservasRecentes.length === 0 ? (
          <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            Nenhuma reserva registrada.
          </div>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th className="th">Hóspede</th>
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th" style={{ textAlign: "right" }}>Valor</th>
                <th className="th">Origem</th>
              </tr>
            </thead>
            <tbody>
              {reservasRecentes.map((r) => (
                <tr key={r.id} className="tr">
                  <td className="td">{r.hospede}</td>
                  <td className="td">{fmtDate(r.checkin)}</td>
                  <td className="td">{fmtDate(r.checkout)}</td>
                  <td className="td" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoeda(r.valor)}
                  </td>
                  <td className="td">
                    <span className="badge badge-ok" style={{ fontSize: 11 }}>{r.origem}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {reservas.length > 10 && (
          <div style={{ textAlign: "right", fontSize: 12, color: "#aaa", marginTop: 8 }}>
            Exibindo 10 de {reservas.length} reservas.
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}
