"use client";

import { useMemo, useState } from "react";
import {
  IconFileTypePdf,
  IconX,
  IconBuilding,
  IconCalendarStats,
  IconChartBar,
} from "@tabler/icons-react";
import { exportarRelatorioMensalPDF, exportarRelatoriosPDF } from "@/lib/exportPDF";
import {
  filterReservasPorPeriodo,
  getMesesAno,
  getMesesValidos,
  getReceitaNoPeriodo,
  MONTHS,
} from "@/lib/metrics";
import {
  fmtMoeda,
  getCustoVariavelReserva,
  getResumoCustos,
} from "@/lib/custos";
import type { Imovel, Reserva } from "@/lib/types";

type ReportMode = "portfolio" | "unidade" | "mensal";

interface Props {
  imoveis: Imovel[];
  reservas: Reserva[];
  onClose: () => void;
}

function buildMesesOpts() {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
    });
  }
  return opts;
}

const MESES_OPTS = buildMesesOpts();

export function PDFExportModal({ imoveis, reservas, onClose }: Props) {
  const now = new Date();
  const defaultMes = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${d.getMonth()}`;
  })();

  const [mode, setMode] = useState<ReportMode>("portfolio");
  const [periodoKey, setPeriodoKey] = useState("6");
  const [mesSel, setMesSel] = useState(defaultMes);
  const [imovelId, setImovelId] = useState(imoveis[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);

  const mesesValidos = useMemo(() => {
    if (mode === "mensal") {
      const [y, m] = mesSel.split("-").map(Number);
      return [{ m, y }];
    }
    if (periodoKey === "3") return getMesesValidos(3, now);
    if (periodoKey === "6") return getMesesValidos(6, now);
    if (periodoKey === "12") return getMesesValidos(12, now);
    return getMesesAno(Number(periodoKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, periodoKey, mesSel]);

  const imoveisParaPDF = useMemo(() => {
    if (mode === "unidade") {
      const im = imoveis.find((i) => i.id === imovelId);
      return im ? [im] : [];
    }
    return imoveis.filter((i) => i.status === "ativo");
  }, [mode, imovelId, imoveis]);

  const preview = useMemo(() => {
    const resFilt = filterReservasPorPeriodo(reservas, mesesValidos);
    const imIds = new Set(imoveisParaPDF.map((i) => i.id));
    const resIM = resFilt.filter((r) => imIds.has(r.imovel_id));
    const receita = resIM.reduce(
      (s, r) => s + getReceitaNoPeriodo(r, mesesValidos),
      0
    );
    const custos = imoveisParaPDF.reduce((s, im) => {
      const fixo = getResumoCustos(im).custoLiquido * mesesValidos.length;
      const varC = resIM
        .filter((r) => r.imovel_id === im.id)
        .reduce((a, r) => a + getCustoVariavelReserva(r, mesesValidos), 0);
      return s + fixo + varC;
    }, 0);
    return {
      receita,
      resultado: receita - custos,
      nReservas: resIM.length,
    };
  }, [imoveisParaPDF, mesesValidos, reservas]);

  function periodoDesc() {
    if (mode === "mensal") {
      const [y, m] = mesSel.split("-").map(Number);
      return `${MONTHS[m]}/${String(y).slice(-2)}`;
    }
    if (periodoKey === "3") return "Últimos 3 meses";
    if (periodoKey === "6") return "Últimos 6 meses";
    if (periodoKey === "12") return "Últimos 12 meses";
    return `Ano ${periodoKey}`;
  }

  function escopoDesc() {
    if (mode === "unidade") {
      return imoveis.find((i) => i.id === imovelId)?.matricula ?? "—";
    }
    return `${imoveisParaPDF.length} imóvel${imoveisParaPDF.length !== 1 ? "is" : ""}`;
  }

  async function gerar() {
    if (imoveisParaPDF.length === 0) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 40));
    try {
      if (mode === "mensal") {
        exportarRelatorioMensalPDF({
          imoveis: imoveisParaPDF,
          reservas,
          mesesValidos,
          numMeses: 1,
        });
      } else {
        exportarRelatoriosPDF({
          imoveis: imoveisParaPDF,
          reservas,
          mesesValidos,
          numMeses: mesesValidos.length,
        });
      }
    } finally {
      setGenerating(false);
      onClose();
    }
  }

  const modes: {
    key: ReportMode;
    icon: React.ReactNode;
    label: string;
    desc: string;
  }[] = [
    {
      key: "portfolio",
      icon: <IconChartBar size={20} />,
      label: "Portfolio",
      desc: "Todos os imóveis",
    },
    {
      key: "unidade",
      icon: <IconBuilding size={20} />,
      label: "Por unidade",
      desc: "Um imóvel",
    },
    {
      key: "mensal",
      icon: <IconCalendarStats size={20} />,
      label: "Mensal",
      desc: "Um mês",
    },
  ];

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="pdf-modal-header">
          <div className="pdf-modal-header-left">
            <div className="pdf-modal-icon">
              <IconFileTypePdf size={22} />
            </div>
            <div>
              <div className="pdf-modal-title">Gerar Relatório PDF</div>
              <div className="pdf-modal-subtitle">
                Selecione o tipo e o período
              </div>
            </div>
          </div>
          <button
            type="button"
            className="pdf-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconX size={15} />
          </button>
        </div>

        {/* Corpo */}
        <div className="pdf-modal-body">
          {/* Tipo */}
          <div>
            <div className="pdf-modal-section-label">Tipo de relatório</div>
            <div className="pdf-mode-grid">
              {modes.map((mc) => (
                <button
                  key={mc.key}
                  type="button"
                  className={`pdf-mode-card${mode === mc.key ? " active" : ""}`}
                  onClick={() => setMode(mc.key)}
                >
                  <div className="pdf-mode-icon">{mc.icon}</div>
                  <div className="pdf-mode-name">{mc.label}</div>
                  <div className="pdf-mode-desc">{mc.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filtros dinâmicos */}
          {mode === "mensal" ? (
            <div>
              <div className="pdf-modal-section-label">Mês</div>
              <select
                className="pdf-modal-select"
                value={mesSel}
                onChange={(e) => setMesSel(e.target.value)}
              >
                {MESES_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="pdf-modal-section-label">Período</div>
              <select
                className="pdf-modal-select"
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
          )}

          {mode === "unidade" && (
            <div>
              <div className="pdf-modal-section-label">Imóvel</div>
              <select
                className="pdf-modal-select"
                value={imovelId}
                onChange={(e) => setImovelId(e.target.value)}
              >
                {imoveis.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.matricula}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          <div className="pdf-preview">
            <div className="pdf-preview-label">
              Preview · {escopoDesc()} · {periodoDesc()}
            </div>
            <div className="pdf-preview-grid">
              <div>
                <div className="pdf-preview-item-label">Receita est.</div>
                <div className="pdf-preview-item-val">
                  R$ {fmtMoeda(Math.round(preview.receita))}
                </div>
              </div>
              <div>
                <div className="pdf-preview-item-label">Resultado est.</div>
                <div
                  className="pdf-preview-item-val"
                  style={{
                    color: preview.resultado >= 0 ? "#1D9E75" : "#E24B4A",
                  }}
                >
                  R$ {fmtMoeda(Math.round(Math.abs(preview.resultado)))}
                </div>
              </div>
              <div>
                <div className="pdf-preview-item-label">Reservas</div>
                <div className="pdf-preview-item-val">{preview.nReservas}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="pdf-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pdf-gerar-btn"
            onClick={gerar}
            disabled={generating || imoveisParaPDF.length === 0}
          >
            <IconFileTypePdf size={16} />
            {generating ? "Gerando…" : "Gerar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
