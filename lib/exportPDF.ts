import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtMoeda, getCustoVariavelReserva, getResumoCustos, CUSTO_LIMPEZA_POR_RESERVA, ENERGIA_CUSTO_DIA, CATEGORIAS_CUSTO } from "./custos";
import { toTitleCase } from "./format";
import { filterReservasPorPeriodo, getReceitaMes, MONTHS, parseDate } from "./metrics";
import type { Imovel, MesAno, Reserva } from "./types";

const CDI_ANUAL = 10.5;
const CDI_MENSAL_PCT = (Math.pow(1 + CDI_ANUAL / 100, 1 / 12) - 1) * 100;

const VERDE        = [29, 158, 117]  as [number, number, number];
const VERDE_ESCURO = [22, 128, 96]   as [number, number, number];
const VERDE_BG     = [236, 252, 244] as [number, number, number];
const CINZA_ESCURO = [40, 40, 45]    as [number, number, number];
const CINZA_MEDIO  = [100, 100, 105] as [number, number, number];
const CINZA_CLARO  = [245, 246, 248] as [number, number, number];
const BRANCO       = [255, 255, 255] as [number, number, number];
const VERMELHO     = [226, 75, 74]   as [number, number, number];
const VERMELHO_BG  = [252, 238, 238] as [number, number, number];
const AZUL         = [55, 138, 221]  as [number, number, number];
const AZUL_BG      = [235, 243, 252] as [number, number, number];
const PORTFOLIO_BG = [248, 250, 248] as [number, number, number];


export interface PDFReportInput {
  imoveis: Imovel[];
  reservas: Reserva[];
  mesesValidos: MesAno[];
  numMeses: number;
}

function roiPct(resultado: number, capital: number): number {
  if (capital <= 0) return 0;
  return (resultado / capital) * 100;
}

function fmtPct(pct: number, comSinal = false): string {
  const abs = Math.abs(pct).toFixed(2).replace(".", ",") + "%";
  if (comSinal) return (pct >= 0 ? "+" : "-") + abs;
  return (pct < 0 ? "-" : "") + abs;
}

function fmtMes(m: number, y: number): string {
  return `${MONTHS[m]}/${String(y).slice(-2)}`;
}

function periodoLabel(meses: MesAno[]): string {
  if (!meses.length) return "";
  return `${fmtMes(meses[0].m, meses[0].y)} – ${fmtMes(meses[meses.length - 1].m, meses[meses.length - 1].y)}`;
}

function imovelLabel(i: Imovel): string {
  if (i.predio && i.unidade) return toTitleCase(`${i.predio} ${i.unidade}`.trim());
  return toTitleCase(i.nome);
}

export function exportarRelatoriosPDF(input: PDFReportInput) {
  const now = new Date();
  const { mesesValidos } = input;
  const nMeses = mesesValidos.length;
  const resFiltradas = filterReservasPorPeriodo(input.reservas, mesesValidos);
  const imoveisAtivos = input.imoveis.filter((i) => i.status === "ativo");

  // ── Dados por imóvel ───────────────────────────────────────────────────────
  const porImovel = imoveisAtivos
    .map((imovel) => {
      const capital = Number(imovel.valor_imovel) || 0;
      const custoFixoMes = getResumoCustos(imovel).custoLiquido;

      const roisMes: (number | null)[] = mesesValidos.map(({ m, y }) => {
        const rec = getReceitaMes(imovel.id, m, y, resFiltradas);
        const custoVar = input.reservas
          .filter((r) => r.imovel_id === imovel.id)
          .reduce((acc, r) => acc + getCustoVariavelReserva(r, [{ m, y }]), 0);
        const resultado = rec - custoFixoMes - custoVar;
        if (rec === 0 && custoVar === 0) return null; // sem atividade
        return capital > 0 ? roiPct(resultado, capital) : null;
      });

      const receita = mesesValidos.reduce(
        (s, { m, y }) => s + getReceitaMes(imovel.id, m, y, resFiltradas),
        0
      );
      const mesesAtivos = roisMes.filter((r) => r !== null).length;
      const custoVarTotal = input.reservas
        .filter((r) => r.imovel_id === imovel.id)
        .reduce((acc, r) => acc + getCustoVariavelReserva(r, mesesValidos), 0);
      const despesas = custoFixoMes * mesesAtivos + custoVarTotal;
      const resultado = receita - despesas;
      const totalRoi = capital > 0 && mesesAtivos > 0
        ? roiPct(resultado, capital)
        : null;

      return { imovel, label: imovelLabel(imovel), capital, receita, despesas, resultado, roisMes, totalRoi };
    })
    .filter((p) => p.receita > 0 || p.despesas > 0);

  const capitalTotal   = porImovel.reduce((s, p) => s + p.capital, 0);
  const receitaTotal   = porImovel.reduce((s, p) => s + p.receita, 0);
  const despesasTotal  = porImovel.reduce((s, p) => s + p.despesas, 0);
  const resultadoTotal = receitaTotal - despesasTotal;
  const portfolioRoiTotal = capitalTotal > 0 ? roiPct(resultadoTotal, capitalTotal) : 0;

  // ROI do portfólio por mês
  const portfolioRoisMes = mesesValidos.map(({ m, y }) => {
    let resMes = 0;
    porImovel.forEach((p) => {
      const custoVar = input.reservas
        .filter((r) => r.imovel_id === p.imovel.id)
        .reduce((acc, r) => acc + getCustoVariavelReserva(r, [{ m, y }]), 0);
      resMes +=
        getReceitaMes(p.imovel.id, m, y, resFiltradas) -
        getResumoCustos(p.imovel).custoLiquido -
        custoVar;
    });
    return capitalTotal > 0 ? roiPct(resMes, capitalTotal) : 0;
  });

  const cdiAcumulado = (Math.pow(1 + CDI_MENSAL_PCT / 100, nMeses) - 1) * 100;
  const vsCdiTotal = portfolioRoiTotal - cdiAcumulado;

  // ── Documento ─────────────────────────────────────────────────────────────
  const orientation = nMeses > 7 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const W = pageW - margin * 2;

  const tituloImoveis =
    porImovel.length <= 3
      ? porImovel.map((p) => p.label).join(", ")
      : `${porImovel.length} imóveis`;

  // ── Paleta Glorenza ───────────────────────────────────────────────────────
  const INK:        [number,number,number] = [26,  24,  20];
  const INK_MID:    [number,number,number] = [74,  70,  64];
  const INK_LIGHT:  [number,number,number] = [140, 135, 126];
  const WHITE_G:    [number,number,number] = [253, 252, 249];
  const SAND_G:     [number,number,number] = [245, 242, 236];
  const SAND_DARK_G:[number,number,number] = [232, 227, 216];
  const BORDER_G:   [number,number,number] = [221, 216, 206];
  const BLUE_G:     [number,number,number] = [43,  108, 176];
  const BLUE_LT:    [number,number,number] = [235, 244, 255];
  const BLUE_MD:    [number,number,number] = [74,  144, 217];
  const BLUE_BR:    [number,number,number] = [189, 215, 245];
  const GREEN_G:    [number,number,number] = [39,  103, 73];
  const GREEN_LT:   [number,number,number] = [230, 244, 238];
  const AMBER_G:    [number,number,number] = [146, 64,  14];
  const AMBER_LT:   [number,number,number] = [254, 243, 199];

  let cy = margin;

  // ── HEADER (logo-mark + serif title + tag) ────────────────────────────────
  const logoSz = 13;
  doc.setFillColor(...BLUE_LT);
  doc.roundedRect(margin, cy, logoSz, logoSz, 3, 3, "F");

  const hx = margin + 2;
  const hy = cy + 2;
  const sc = 9 / 30;
  doc.setFillColor(214, 231, 249);
  doc.lines(
    [[(2-15)*sc,(12-3)*sc],[0,(27-12)*sc],[(11-2)*sc,0],
     [0,-(27-19)*sc],[(19-11)*sc,0],[0,(27-19)*sc],
     [(28-19)*sc,0],[0,-(27-12)*sc]],
    hx+15*sc, hy+3*sc, [1,1], "F", true,
  );
  doc.setDrawColor(...BLUE_G);
  doc.setLineWidth(0.4);
  doc.line(hx+15*sc, hy+3*sc, hx+28*sc, hy+12*sc);
  doc.line(hx+15*sc, hy+3*sc, hx+2*sc,  hy+12*sc);
  doc.setLineWidth(0.35);
  const wPts = [[4,11],[4,27],[11,27],[11,19],[19,19],[19,27],[26,27],[26,11]] as [number,number][];
  for (let i = 0; i < wPts.length-1; i++) {
    doc.line(hx+wPts[i][0]*sc, hy+wPts[i][1]*sc, hx+wPts[i+1][0]*sc, hy+wPts[i+1][1]*sc);
  }
  doc.setFillColor(175, 212, 245);
  doc.roundedRect(hx+6*sc,  hy+14*sc, 5*sc, 5*sc, 0.4, 0.4, "F");
  doc.roundedRect(hx+19*sc, hy+14*sc, 5*sc, 5*sc, 0.4, 0.4, "F");
  doc.setFillColor(195, 220, 248);
  doc.roundedRect(hx+11*sc, hy+19*sc, 8*sc, 8*sc, 0.5, 0.5, "F");

  const predios      = [...new Set(imoveisAtivos.map(i => i.predio).filter(Boolean))];
  const portfolioNome = predios.length === 1 ? toTitleCase(predios[0]) : "Portfolio";
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(portfolioNome, margin+logoSz+5, cy+7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_LIGHT);
  doc.text(
    `Relatório de rentabilidade  ·  ${tituloImoveis}  ·  ${periodoLabel(mesesValidos)}`,
    margin+logoSz+5, cy+12,
  );

  const tagTxt = `${nMeses}m`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const tagW = doc.getTextWidth(tagTxt)+10;
  const tagH = 5.5;
  const tagX = pageW-margin-tagW;
  const tagY = cy+1;
  doc.setFillColor(...SAND_G);
  doc.setDrawColor(...BORDER_G);
  doc.setLineWidth(0.2);
  doc.roundedRect(tagX, tagY, tagW, tagH, tagH/2, tagH/2, "FD");
  doc.setTextColor(...INK_MID);
  doc.text(tagTxt, tagX+tagW/2, tagY+tagH/2+1.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_LIGHT);
  doc.text(
    `Gerado em ${now.toLocaleDateString("pt-BR")} · QuartoExtra`,
    pageW-margin, cy+10.5, { align: "right" },
  );

  cy += logoSz+5;
  doc.setDrawColor(...BORDER_G);
  doc.setLineWidth(0.25);
  doc.line(margin, cy, pageW-margin, cy);
  cy += 5;

  // ── 4 METRIC CARDS ───────────────────────────────────────────────────────
  const mW = (W-9)/4;
  const mH = 27;
  type DrawFnP = (ix:number,iy:number,sz:number,c:[number,number,number])=>void;
  const pIconTrendUp: DrawFnP = (ix,iy,sz,c) => {
    const s=sz/24; doc.setDrawColor(...c); doc.setLineWidth(0.4*sz/5);
    doc.line(ix+2*s,iy+18*s,ix+8*s,iy+10*s); doc.line(ix+8*s,iy+10*s,ix+14*s,iy+14*s);
    doc.line(ix+14*s,iy+14*s,ix+22*s,iy+4*s); doc.line(ix+14*s,iy+4*s,ix+22*s,iy+4*s); doc.line(ix+22*s,iy+4*s,ix+22*s,iy+12*s);
  };
  const pIconTrendDown: DrawFnP = (ix,iy,sz,c) => {
    const s=sz/24; doc.setDrawColor(...c); doc.setLineWidth(0.4*sz/5);
    doc.line(ix+2*s,iy+6*s,ix+8*s,iy+14*s); doc.line(ix+8*s,iy+14*s,ix+14*s,iy+10*s);
    doc.line(ix+14*s,iy+10*s,ix+22*s,iy+20*s); doc.line(ix+14*s,iy+20*s,ix+22*s,iy+20*s); doc.line(ix+22*s,iy+20*s,ix+22*s,iy+12*s);
  };
  const pIconBuilding: DrawFnP = (ix,iy,sz,c) => {
    const s=sz/24; doc.setDrawColor(...c); doc.setLineWidth(0.3*sz/5);
    doc.rect(ix+3*s,iy+2*s,18*s,20*s,"S"); doc.setFillColor(...c);
    ([[ 5, 5],[13, 5],[ 5,11],[13,11],[ 5,17],[13,17]] as [number,number][]).forEach(([wx,wy])=>doc.rect(ix+wx*s,iy+wy*s,3.5*s,3.5*s,"F"));
  };
  const pIconCoin: DrawFnP = (ix,iy,sz,c) => {
    const s=sz/24; doc.setDrawColor(...c); doc.setLineWidth(0.35*sz/5);
    doc.circle(ix+12*s,iy+12*s,10*s,"S");
    doc.setFont("helvetica","bold"); doc.setFontSize(sz*0.5); doc.setTextColor(...c);
    doc.text("R$",ix+12*s,iy+14*s,{align:"center"});
  };
  type MCP = { label:string; value:string; sub:string; vc:[number,number,number]; ic:[number,number,number]; bg:[number,number,number]; brd:[number,number,number]; ghost:[number,number,number]; draw:DrawFnP };
  const mcards: MCP[] = [
    { label:"RECEITA BRUTA",     value:`R$ ${fmtMoeda(Math.round(receitaTotal))}`,             sub:periodoLabel(mesesValidos),
      vc:INK,    ic:INK_LIGHT,  bg:SAND_G,  brd:BORDER_G, ghost:[235,232,226] as [number,number,number], draw:pIconCoin },
    { label:"DESPESAS TOTAIS",   value:`R$ ${fmtMoeda(Math.round(despesasTotal))}`,            sub:periodoLabel(mesesValidos),
      vc:INK,    ic:INK_LIGHT,  bg:SAND_G,  brd:BORDER_G, ghost:[235,232,226] as [number,number,number], draw:pIconTrendDown },
    { label:"RESULTADO LÍQUIDO", value:`R$ ${fmtMoeda(Math.round(Math.abs(resultadoTotal)))}`, sub:resultadoTotal>=0?"positivo":"negativo",
      vc:resultadoTotal>=0?GREEN_G:AMBER_G, ic:resultadoTotal>=0?GREEN_G:AMBER_G, bg:SAND_G, brd:BORDER_G, ghost:[235,232,226] as [number,number,number], draw:resultadoTotal>=0?pIconTrendUp:pIconTrendDown },
    { label:"CAPITAL INVESTIDO", value:`R$ ${fmtMoeda(Math.round(capitalTotal))}`,             sub:`${porImovel.length} imóveis`,
      vc:BLUE_G, ic:BLUE_G,     bg:BLUE_LT, brd:BLUE_BR,  ghost:[220,234,250] as [number,number,number], draw:pIconBuilding },
  ];
  mcards.forEach((mc,i) => {
    const mx = margin+i*(mW+3);
    doc.setFillColor(...mc.bg); doc.setDrawColor(...mc.brd); doc.setLineWidth(0.25);
    doc.roundedRect(mx, cy, mW, mH, 3.5, 3.5, "FD");
    mc.draw(mx+mW-18, cy+mH-18, 19, mc.ghost);
    mc.draw(mx+3, cy+2.5, 5.5, mc.ic);
    doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(...INK_LIGHT);
    doc.text(mc.label, mx+4, cy+12, { maxWidth:mW-5 });
    doc.setFont("times","bold"); doc.setFontSize(11); doc.setTextColor(...mc.vc);
    doc.text(mc.value, mx+4, cy+20);
    doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.setTextColor(...INK_LIGHT);
    doc.text(mc.sub, mx+4, cy+25.5, { maxWidth:mW-5 });
  });
  cy += mH+5;

  // ── Bar chart: ROI por imóvel — período completo ─────────────────────────
  const nProps      = porImovel.length;
  const sortedByRoi = [...porImovel].sort((a,b)=>(b.totalRoi??0)-(a.totalRoi??0));
  const maxRoiVal   = Math.max(
    cdiAcumulado * 1.2,
    ...sortedByRoi.map(p => p.totalRoi ?? 0),
    portfolioRoiTotal, 0.01,
  ) * 1.08;

  const bRowH  = nMeses > 7 ? 3.2 : 3.8;
  const bGapH  = nMeses > 7 ? 0.5 : 0.7;
  const bLblW  = 34;
  const bValW  = 15;
  const bPadL  = 4;
  const bPadR  = 4;
  const trkXo  = margin + bPadL + bLblW + 2;
  const trkWo  = W - bPadL - bLblW - bValW - 6;
  const cHdrH  = 13;
  const cPadT  = 7;   // espaço para label CDI acima das barras
  const cPadB  = 6;
  const legH   = 9;
  const bAreaH = (nProps + 1) * (bRowH + bGapH) - bGapH;  // +1 = portfolio row
  const bCardH = cHdrH + cPadT + bAreaH + legH + cPadB;

  if (cy + bCardH > pageH - margin - 5) { doc.addPage(); cy = margin; }

  // Card
  doc.setFillColor(...WHITE_G);
  doc.setDrawColor(...BORDER_G);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, cy, W, bCardH, 3.5, 3.5, "FD");

  // Card header
  doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...INK_MID);
  doc.text("RENTABILIDADE POR IMÓVEL — PERÍODO COMPLETO", margin+bPadL, cy+8);
  doc.setDrawColor(...SAND_DARK_G); doc.setLineWidth(0.3);
  doc.line(margin+4, cy+cHdrH, margin+W-4, cy+cHdrH);

  const barAreaTopY = cy + cHdrH + cPadT;
  const cdiLineX    = trkXo + trkWo * (cdiAcumulado / maxRoiVal);

  // CDI reference label (above bar area)
  doc.setFont("helvetica","bold"); doc.setFontSize(5); doc.setTextColor(...BLUE_MD);
  doc.text(`CDI ${fmtPct(cdiAcumulado)}`, cdiLineX, barAreaTopY - 2.5, { align:"center" });

  // Draw bars
  let barY = barAreaTopY;

  sortedByRoi.forEach((p) => {
    const roi = p.totalRoi ?? 0;
    const fw  = trkWo * Math.max(0, roi) / maxRoiVal;
    const bc: [number,number,number] = roi >= cdiAcumulado ? GREEN_G : AMBER_G;
    doc.setFont("helvetica","normal"); doc.setFontSize(5.8); doc.setTextColor(...INK_LIGHT);
    doc.text(p.label, margin+bPadL, barY+bRowH-0.5, { maxWidth:bLblW-1 });
    doc.setFillColor(...SAND_G);
    doc.roundedRect(trkXo, barY, trkWo, bRowH-0.3, 1, 1, "F");
    if (fw > 0.5) { doc.setFillColor(...bc); doc.roundedRect(trkXo, barY, fw, bRowH-0.3, 1, 1, "F"); }
    doc.setFont("helvetica","bold"); doc.setFontSize(5.8); doc.setTextColor(...INK);
    doc.text(fmtPct(roi), margin+W-bPadR, barY+bRowH-0.5, { align:"right" });
    barY += bRowH + bGapH;
  });

  // Portfolio row (azul)
  const portFw = trkWo * Math.max(0, portfolioRoiTotal) / maxRoiVal;
  doc.setFont("helvetica","bold"); doc.setFontSize(5.8); doc.setTextColor(...BLUE_G);
  doc.text("Portfolio", margin+bPadL, barY+bRowH-0.5);
  doc.setFillColor(...SAND_G);
  doc.roundedRect(trkXo, barY, trkWo, bRowH-0.3, 1, 1, "F");
  if (portFw > 0.5) { doc.setFillColor(...BLUE_MD); doc.roundedRect(trkXo, barY, portFw, bRowH-0.3, 1, 1, "F"); }
  doc.setFont("helvetica","bold"); doc.setFontSize(5.8); doc.setTextColor(...BLUE_G);
  doc.text(fmtPct(portfolioRoiTotal), margin+W-bPadR, barY+bRowH-0.5, { align:"right" });
  barY += bRowH + bGapH;

  // CDI dashed reference line (drawn on top of bars)
  const barAreaBotY = barAreaTopY + bAreaH;
  doc.setDrawColor(...BLUE_MD); doc.setLineWidth(0.35);
  let lY = barAreaTopY;
  while (lY < barAreaBotY) {
    doc.line(cdiLineX, lY, cdiLineX, Math.min(lY+1.2, barAreaBotY));
    lY += 2.0;
  }

  // Legend
  const legY = cy + bCardH - cPadB - 4;
  doc.setFillColor(...GREEN_G);  doc.roundedRect(margin+bPadL,    legY, 3, 2.5, 0.5, 0.5, "F");
  doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.setTextColor(...INK_LIGHT);
  doc.text("Acima CDI",   margin+bPadL+5,  legY+2);
  doc.setFillColor(...AMBER_G); doc.roundedRect(margin+bPadL+28, legY, 3, 2.5, 0.5, 0.5, "F");
  doc.text("Abaixo CDI",  margin+bPadL+33, legY+2);
  doc.setFillColor(...BLUE_MD); doc.roundedRect(margin+bPadL+60, legY, 3, 2.5, 0.5, 0.5, "F");
  doc.text("Portfolio",   margin+bPadL+65, legY+2);
  doc.setDrawColor(...BLUE_MD); doc.setLineWidth(0.5);
  doc.line(margin+bPadL+84, legY+1.2, margin+bPadL+88, legY+1.2);
  doc.text("CDI ref.",    margin+bPadL+90, legY+2);

  cy += bCardH + 8;

  // ── Estilos compartilhados das tabelas de detalhe ────────────────────────
  const detStyles = {
    fontSize: 7.5,
    cellPadding: { top:2, bottom:2, left:2.5, right:2.5 },
    textColor: INK_MID,
    lineWidth: 0,
    fillColor: WHITE_G,
  };
  const detHead = { fillColor:WHITE_G, textColor:INK_LIGHT, fontStyle:"bold" as const, fontSize:6.5, lineWidth:0 };
  const detFoot = { fillColor:SAND_G,  textColor:INK,       fontStyle:"bold" as const, fontSize:7.5, lineWidth:0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detDrawCell = (h: any) => {
    if (h.section==="head") { h.doc.setDrawColor(...SAND_DARK_G); h.doc.setLineWidth(0.3); h.doc.line(h.cell.x,h.cell.y+h.cell.height,h.cell.x+h.cell.width,h.cell.y+h.cell.height); }
    if (h.section==="body") { h.doc.setDrawColor(...SAND_G);      h.doc.setLineWidth(0.2); h.doc.line(h.cell.x,h.cell.y+h.cell.height,h.cell.x+h.cell.width,h.cell.y+h.cell.height); }
    if (h.section==="foot") { h.doc.setDrawColor(...BORDER_G);    h.doc.setLineWidth(0.3); h.doc.line(h.cell.x,h.cell.y,h.cell.x+h.cell.width,h.cell.y); }
  };

  // ── Detalhe por imóvel ────────────────────────────────────────────────────
  if (porImovel.length>0) {
    if (cy>pageH-55) { doc.addPage(); cy=margin; }

    doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...INK_MID);
    doc.text("DETALHE POR IMÓVEL — PERÍODO COMPLETO", margin, cy);
    cy += 5;

    // Larguras proporcionais para alinhamento correto em portrait e landscape
    const dW = [
      Math.round(W*0.23),   // Imóvel
      Math.round(W*0.14),   // Capital
      Math.round(W*0.17),   // Receita bruta
      Math.round(W*0.15),   // Despesas
      Math.round(W*0.17),   // Resultado
      W - Math.round(W*0.23) - Math.round(W*0.14) - Math.round(W*0.17) - Math.round(W*0.15) - Math.round(W*0.17),  // ROI
    ];

    autoTable(doc, {
      startY: cy,
      head: [["Imóvel","Capital","Receita bruta","Despesas","Resultado","ROI período"]],
      body: porImovel.map((p)=>[
        p.label,
        `R$ ${fmtMoeda(Math.round(p.capital))}`,
        `R$ ${fmtMoeda(Math.round(p.receita))}`,
        `R$ ${fmtMoeda(Math.round(p.despesas))}`,
        `R$ ${fmtMoeda(Math.round(Math.abs(p.resultado)))}`,
        p.totalRoi!==null?fmtPct(p.totalRoi):"—",
      ]),
      foot: [["Total portfolio", `R$ ${fmtMoeda(Math.round(capitalTotal))}`, `R$ ${fmtMoeda(Math.round(receitaTotal))}`, `R$ ${fmtMoeda(Math.round(despesasTotal))}`, `R$ ${fmtMoeda(Math.round(Math.abs(resultadoTotal)))}`, fmtPct(portfolioRoiTotal)]],
      margin: { left:margin, right:margin },
      styles: detStyles,
      headStyles: detHead,
      footStyles: detFoot,
      alternateRowStyles: { fillColor:WHITE_G },
      columnStyles: {
        0: { cellWidth:dW[0] },
        1: { cellWidth:dW[1], halign:"right" as const },
        2: { cellWidth:dW[2], halign:"right" as const },
        3: { cellWidth:dW[3], halign:"right" as const },
        4: { cellWidth:dW[4], halign:"right" as const },
        5: { cellWidth:dW[5], halign:"center" as const, fontStyle:"bold" as const },
      },
      didDrawCell: detDrawCell,
      didParseCell(h) {
        // Align headers to match column data alignment
        if (h.section === "head") {
          if (h.column.index >= 1 && h.column.index <= 4) h.cell.styles.halign = "right";
          if (h.column.index === 5) h.cell.styles.halign = "center";
          return;
        }
        if (h.section === "foot") {
          if (h.column.index >= 1 && h.column.index <= 4) h.cell.styles.halign = "right";
          if (h.column.index === 5) h.cell.styles.halign = "center";
          return;
        }
        if (h.section !== "body") return;
        const ri=h.row.index;
        if (ri>=nProps) return;
        if (h.column.index===4) h.cell.styles.textColor=porImovel[ri].resultado>=0?GREEN_G:AMBER_G;
        if (h.column.index===5) { const roi=porImovel[ri].totalRoi; if (roi!==null) h.cell.styles.textColor=roi>=0?GREEN_G:AMBER_G; }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy = ((doc as any).lastAutoTable?.finalY ?? cy+40) + 8;
  }

  // ── Despesas detalhadas (apenas modo Por Unidade: 1 imóvel) ───────────────
  if (porImovel.length === 1) {
    const pu  = porImovel[0];
    const im  = pu.imovel;
    const mesesAtivos = pu.roisMes.filter(r => r !== null).length || nMeses;

    if (cy > pageH - 70) { doc.addPage(); cy = margin; }

    // ── Custos Fixos ──────────────────────────────────────────────────────
    doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...INK_MID);
    doc.text("CUSTOS FIXOS MENSAIS — " + pu.label.toUpperCase(), margin, cy);
    cy += 5;

    const n = (v: number | null | undefined) => Number(v) || 0;
    const linhasFixas = [
      ...CATEGORIAS_CUSTO.map(c => ({
        cat:     c.label,
        custo:   n(im[c.custo as keyof typeof im] as number),
        repasse: n(im[c.repasse as keyof typeof im] as number),
      })),
      { cat:"IPTU (mensal)", custo: n(im.iptu_anual)/12, repasse: n(im.repasse_iptu_anual)/12 },
    ].filter(l => l.custo > 0);

    const totalFixoMes = linhasFixas.reduce((s,l) => s + Math.max(0, l.custo - l.repasse), 0);

    autoTable(doc, {
      startY: cy,
      head: [["Categoria","Custo/mês","Repasse/mês","Líquido/mês",`Total (${mesesAtivos}m)`]],
      body: linhasFixas.map(l => [
        l.cat,
        `R$ ${fmtMoeda(Math.round(l.custo))}`,
        l.repasse > 0 ? `R$ ${fmtMoeda(Math.round(l.repasse))}` : "—",
        `R$ ${fmtMoeda(Math.round(Math.max(0, l.custo - l.repasse)))}`,
        `R$ ${fmtMoeda(Math.round(Math.max(0, l.custo - l.repasse) * mesesAtivos))}`,
      ]),
      foot: [["Total fixo","","",`R$ ${fmtMoeda(Math.round(totalFixoMes))}`,`R$ ${fmtMoeda(Math.round(totalFixoMes * mesesAtivos))}`]],
      margin: { left:margin, right:margin },
      styles: detStyles,
      headStyles: detHead,
      footStyles: detFoot,
      columnStyles: {
        0: { cellWidth: Math.round(W*0.25) },
        1: { halign:"right" as const },
        2: { halign:"right" as const },
        3: { halign:"right" as const, fontStyle:"bold" as const },
        4: { halign:"right" as const, fontStyle:"bold" as const, textColor:BLUE_G },
      },
      didDrawCell: detDrawCell,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy = ((doc as any).lastAutoTable?.finalY ?? cy+30) + 8;

    // ── Custos Variáveis por Reserva ──────────────────────────────────────
    const resUnidade = resFiltradas.filter(r => r.imovel_id === im.id);
    if (resUnidade.length > 0) {
      if (cy > pageH - 60) { doc.addPage(); cy = margin; }

      doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...INK_MID);
      doc.text("CUSTOS VARIÁVEIS POR RESERVA", margin, cy);
      cy += 5;

      let totalVar = 0;
      const varRows = resUnidade.map(r => {
        const ci  = parseDate(r.checkin);
        const co  = parseDate(r.checkout);
        let noites = 0;
        for (let d = new Date(ci); d < co; d.setDate(d.getDate()+1)) noites++;
        const limpeza = n(r.custo_limpeza) > 0 ? n(r.custo_limpeza) : CUSTO_LIMPEZA_POR_RESERVA;
        const energia = n(r.custo_energia) > 0 ? n(r.custo_energia) : noites * ENERGIA_CUSTO_DIA;
        const outros  = n(r.custo_outros);
        const total   = limpeza + energia + outros;
        totalVar += total;
        return [
          r.hospede || "—",
          ci.toLocaleDateString("pt-BR"),
          co.toLocaleDateString("pt-BR"),
          String(noites),
          `R$ ${fmtMoeda(Math.round(limpeza))}`,
          `R$ ${fmtMoeda(Math.round(energia))}`,
          outros > 0 ? `R$ ${fmtMoeda(Math.round(outros))}` : "—",
          `R$ ${fmtMoeda(Math.round(total))}`,
        ];
      });

      autoTable(doc, {
        startY: cy,
        head: [["Hóspede","Check-in","Check-out","Noites","Limpeza","Energia","Outros","Total"]],
        body: varRows,
        foot: [["Total variável","","","","","","",`R$ ${fmtMoeda(Math.round(totalVar))}`]],
        margin: { left:margin, right:margin },
        styles: { ...detStyles, fontSize:7 },
        headStyles: detHead,
        footStyles: detFoot,
        columnStyles: {
          0: { cellWidth: Math.round(W*0.22) },
          1: { cellWidth: Math.round(W*0.10), halign:"center" as const },
          2: { cellWidth: Math.round(W*0.10), halign:"center" as const },
          3: { cellWidth: Math.round(W*0.07), halign:"center" as const },
          4: { halign:"right" as const },
          5: { halign:"right" as const },
          6: { halign:"right" as const },
          7: { halign:"right" as const, fontStyle:"bold" as const, textColor:BLUE_G },
        },
        didDrawCell: detDrawCell,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cy = ((doc as any).lastAutoTable?.finalY ?? cy+30) + 8;

      // Resumo total despesas
      if (cy > pageH - 30) { doc.addPage(); cy = margin; }
      const totalDespTotal = totalFixoMes * mesesAtivos + totalVar;
      doc.setFillColor(...BLUE_LT); doc.setDrawColor(...BLUE_BR); doc.setLineWidth(0.25);
      doc.roundedRect(margin, cy, W, 12, 3, 3, "FD");
      doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...BLUE_G);
      doc.text(
        `Despesas totais: R$ ${fmtMoeda(Math.round(totalDespTotal))}  ·  Fixo: R$ ${fmtMoeda(Math.round(totalFixoMes*mesesAtivos))}  ·  Variável: R$ ${fmtMoeda(Math.round(totalVar))}`,
        pageW/2, cy+7.5, { align:"center" },
      );
      cy += 18;
    }
  }

  // ── Rodapé Glorenza — nota apenas na última página ───────────────────────
  const totalPages = doc.getNumberOfPages();
  const nota =
    capitalTotal>0
      ? `ROI calculado sobre capital total de R$ ${fmtMoeda(Math.round(capitalTotal))}  ·  Não inclui valorização patrimonial  ·  CDI referência ${CDI_ANUAL}% a.a.  ·  QuartoExtra`
      : "Cadastre o valor do imóvel em Imóveis para calcular o ROI.";

  // Numeração de página em todas as páginas
  for (let p=1;p<=totalPages;p++) {
    doc.setPage(p);
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(...INK_LIGHT);
    doc.text(`${p} / ${totalPages}`, pageW-margin, pageH-margin, { align:"right" });
  }

  // Nota de rodapé só na última página
  doc.setPage(totalPages);
  const fy = pageH - margin - 5;
  doc.setDrawColor(...BORDER_G); doc.setLineWidth(0.25);
  doc.line(margin, fy-3, pageW-margin, fy-3);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(...INK_LIGHT);
  doc.text(nota, pageW/2, fy+0.5, { align:"center", maxWidth:W-10 });

  doc.save(`relatorio_${now.toISOString().slice(0,10)}.pdf`);
}

// ── Relatório Renda Mensal ─────────────────────────────────────────────────────
// Estética fiel ao HTML template v3 (DM Serif / DM Sans, paleta sand/blue/amber).
// Seções: header serif · 4 metric cards (sand + border) · grid-2 (bars + stacked)
// · tabela com pills blue/green/amber · rodapé centralizado.
export function exportarRelatorioMensalPDF(input: PDFReportInput) {
  const { mesesValidos } = input;
  if (mesesValidos.length !== 1) return;

  const { m, y } = mesesValidos[0];
  const now    = new Date();
  const resFil = filterReservasPorPeriodo(input.reservas, mesesValidos);
  const ativos = input.imoveis.filter((i) => i.status === "ativo");

  // ── Dados ────────────────────────────────────────────────────────────────
  const porImovel = ativos
    .map((imovel) => {
      const capital   = Number(imovel.valor_imovel) || 0;
      const custoFixo = getResumoCustos(imovel).custoLiquido;
      const receita   = getReceitaMes(imovel.id, m, y, resFil);
      const custoVar  = input.reservas
        .filter((r) => r.imovel_id === imovel.id)
        .reduce((acc, r) => acc + getCustoVariavelReserva(r, mesesValidos), 0);
      const despesas  = custoFixo + custoVar;
      const resultado = receita - despesas;
      const margem    = receita > 0 ? Math.round((resultado / receita) * 100) : 0;
      const roi       = capital > 0 ? (resultado / capital) * 100 : 0;
      return { imovel, label: imovelLabel(imovel), capital, receita, despesas, resultado, margem, roi };
    })
    .filter((p) => p.receita > 0 || p.despesas > 0);

  const capitalTotal   = porImovel.reduce((s, p) => s + p.capital,  0);
  const receitaTotal   = porImovel.reduce((s, p) => s + p.receita,  0);
  const despesasTotal  = porImovel.reduce((s, p) => s + p.despesas, 0);
  const resultadoTotal = receitaTotal - despesasTotal;
  const nImoveis       = porImovel.length;
  const media          = nImoveis > 0 ? resultadoTotal / nImoveis : 0;
  const margemTotal    = receitaTotal > 0 ? Math.round((resultadoTotal / receitaTotal) * 100) : 0;
  const roiTotal       = capitalTotal > 0 ? (resultadoTotal / capitalTotal) * 100 : 0;

  const sorted = [...porImovel].sort((a, b) => b.resultado - a.resultado);
  const melhor = sorted[0] ?? null;
  const pior   = sorted[sorted.length - 1] ?? null;

  const predios       = [...new Set(ativos.map((i) => i.predio).filter(Boolean))];
  const portfolioNome = predios.length === 1 ? toTitleCase(predios[0]) : "Portfolio";
  const mesLabel      = `${MONTHS[m]}/${String(y).slice(-2)}`;

  // ── Documento ────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const MG  = 14;
  const W   = PW - MG * 2;   // 182 mm

  // ── Paleta do template HTML ───────────────────────────────────────────────
  // CSS vars: --blue #2B6CB0  --blue-light #EBF4FF  --blue-mid #4A90D9
  //           --green #276749  --green-light #E6F4EE
  //           --amber #92400E  --amber-light #FEF3C7
  //           --sand #F5F2EC   --sand-dark #E8E3D8
  //           --ink #1A1814    --ink-mid #4A4640  --ink-light #8C877E
  //           --white #FDFCF9  --border #DDD8CE
  const INK:        [number,number,number] = [26,  24,  20];
  const INK_MID:    [number,number,number] = [74,  70,  64];
  const INK_LIGHT:  [number,number,number] = [140, 135, 126];
  const WHITE:      [number,number,number] = [253, 252, 249];
  const SAND:       [number,number,number] = [245, 242, 236];
  const SAND_DARK:  [number,number,number] = [232, 227, 216];
  const BORDER_C:   [number,number,number] = [221, 216, 206];
  const BLUE:       [number,number,number] = [43,  108, 176];
  const BLUE_LIGHT: [number,number,number] = [235, 244, 255];
  const BLUE_MID:   [number,number,number] = [74,  144, 217];
  const BLUE_BRD:   [number,number,number] = [189, 215, 245];
  const GREEN:      [number,number,number] = [39,  103, 73];
  const GREEN_LIGHT:[number,number,number] = [230, 244, 238];
  const AMBER:      [number,number,number] = [146, 64,  14];
  const AMBER_LIGHT:[number,number,number] = [254, 243, 199];
  const CHART_GRAY: [number,number,number] = [200, 195, 184]; // #C8C3B8

  let cy = MG;

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Card: fundo branco (--white) + borda (--border) + border-radius 14px ≈ 3.5mm
  function card(x: number, y2: number, w: number, h: number) {
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER_C);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y2, w, h, 3.5, 3.5, "FD");
  }
  // Card header: ícone seria Tabler — usamos só o título uppercase em ink-mid
  // com border-bottom sand-dark
  function cardHeader(x: number, y2: number, w: number, text: string): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK_MID);
    doc.text(text, x + 5, y2 + 7);
    doc.setDrawColor(...SAND_DARK);
    doc.setLineWidth(0.3);
    doc.line(x + 4, y2 + 9.5, x + w - 4, y2 + 9.5);
    return y2 + 12;  // retorna Y após o header
  }

  // ── HEADER ───────────────────────────────────────────────────────────────
  // Logo mark: --blue-light bg, outlined house SVG (simplificado)
  // Container 52×52 HTML → ~13×13 mm PDF
  const logoSz = 13;
  doc.setFillColor(...BLUE_LIGHT);
  doc.roundedRect(MG, cy, logoSz, logoSz, 3, 3, "F");

  // Casa delineada (replicando o SVG do template, escala 30→9mm, inset 2mm)
  const hx = MG + 2;
  const hy = cy + 2;
  const sc = 9 / 30;   // svg viewBox 0 0 30 30 → 9mm

  // Preenchimento leve do corpo (opacity 0.15 → cor misturada com blue-light)
  doc.setFillColor(214, 231, 249);  // aprox #2B6CB0 @ 15% sobre #EBF4FF
  doc.lines(
    [[(2-15)*sc, (12-3)*sc], [0, (27-12)*sc], [(11-2)*sc, 0],
     [0, -(27-19)*sc], [(19-11)*sc, 0], [0, (27-19)*sc],
     [(28-19)*sc, 0], [0, -(27-12)*sc]],
    hx + 15*sc, hy + 3*sc,
    [1, 1], "F", true,
  );

  // Linhas de delineamento: telhado
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.line(hx + 15*sc, hy + 3*sc, hx + 28*sc, hy + 12*sc);
  doc.line(hx + 15*sc, hy + 3*sc, hx + 2*sc,  hy + 12*sc);

  // Paredes
  doc.setLineWidth(0.35);
  const wallPts = [
    [4,11],[4,27],[11,27],[11,19],[19,19],[19,27],[26,27],[26,11],
  ] as [number,number][];
  for (let i = 0; i < wallPts.length - 1; i++) {
    doc.line(
      hx + wallPts[i][0]*sc,   hy + wallPts[i][1]*sc,
      hx + wallPts[i+1][0]*sc, hy + wallPts[i+1][1]*sc,
    );
  }

  // Janelas (opacity 0.4 → azul médio claro)
  doc.setFillColor(175, 212, 245);
  doc.roundedRect(hx + 6*sc, hy + 14*sc, 5*sc, 5*sc, 0.4, 0.4, "F");
  doc.roundedRect(hx + 19*sc, hy + 14*sc, 5*sc, 5*sc, 0.4, 0.4, "F");

  // Porta (opacity 0.3)
  doc.setFillColor(195, 220, 248);
  doc.roundedRect(hx + 11*sc, hy + 19*sc, 8*sc, 8*sc, 0.5, 0.5, "F");

  // Título em serif (DM Serif Display → times bold)
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(portfolioNome, MG + logoSz + 5, cy + 7);

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_LIGHT);
  doc.text(
    `Relatório de renda mensal  ·  ${nImoveis} imóveis  ·  Capital R$ ${fmtMoeda(Math.round(capitalTotal))}`,
    MG + logoSz + 5, cy + 12,
  );

  // Direita: tag pill para o mês + data
  const tagTxt = mesLabel;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const tagW = doc.getTextWidth(tagTxt) + 10;
  const tagH = 5.5;
  const tagX = PW - MG - tagW;
  const tagY = cy + 1;
  doc.setFillColor(...SAND);
  doc.setDrawColor(...BORDER_C);
  doc.setLineWidth(0.2);
  doc.roundedRect(tagX, tagY, tagW, tagH, tagH / 2, tagH / 2, "FD");
  doc.setTextColor(...INK_MID);
  doc.text(tagTxt, tagX + tagW / 2, tagY + tagH / 2 + 1.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK_LIGHT);
  doc.text(
    `Gerado em ${now.toLocaleDateString("pt-BR")} · QuartoExtra`,
    PW - MG, cy + 10.5,
    { align: "right" },
  );

  cy += logoSz + 5;
  doc.setDrawColor(...BORDER_C);
  doc.setLineWidth(0.25);
  doc.line(MG, cy, PW - MG, cy);
  cy += 5;

  // ── 4 METRIC CARDS (grid-4) ───────────────────────────────────────────────
  const mW = (W - 9) / 4;
  const mH = 27;  // taller to accommodate top icon

  // Simplified Tabler icon drawers (normalized to 24-unit grid, scaled to sz mm)
  type DrawFn = (ix: number, iy: number, sz: number, c: [number,number,number]) => void;

  const iconHomeDollar: DrawFn = (ix, iy, sz, c) => {
    const s = sz / 24;
    doc.setDrawColor(...c); doc.setLineWidth(0.35 * sz / 5);
    doc.line(ix+12*s, iy+2*s,  ix+22*s, iy+10*s);
    doc.line(ix+12*s, iy+2*s,  ix+2*s,  iy+10*s);
    doc.line(ix+3*s,  iy+9*s,  ix+3*s,  iy+22*s);
    doc.line(ix+21*s, iy+9*s,  ix+21*s, iy+22*s);
    doc.line(ix+3*s,  iy+22*s, ix+21*s, iy+22*s);
    doc.setFillColor(...c);
    doc.rect(ix+9*s, iy+14*s, 6*s, 8*s, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(sz * 0.5); doc.setTextColor(...c);
    doc.text("$", ix+14*s, iy+11.5*s, { align: "center" });
  };
  const iconBuilding: DrawFn = (ix, iy, sz, c) => {
    const s = sz / 24;
    doc.setDrawColor(...c); doc.setLineWidth(0.3 * sz / 5);
    doc.rect(ix+3*s, iy+2*s, 18*s, 20*s, "S");
    doc.setFillColor(...c);
    ([[ 5, 5],[13, 5],[ 5,11],[13,11],[ 5,17],[13,17]] as [number,number][]).forEach(
      ([wx,wy]) => doc.rect(ix+wx*s, iy+wy*s, 3.5*s, 3.5*s, "F"),
    );
  };
  const iconTrendingUp: DrawFn = (ix, iy, sz, c) => {
    const s = sz / 24;
    doc.setDrawColor(...c); doc.setLineWidth(0.4 * sz / 5);
    doc.line(ix+2*s,  iy+18*s, ix+8*s,  iy+10*s);
    doc.line(ix+8*s,  iy+10*s, ix+14*s, iy+14*s);
    doc.line(ix+14*s, iy+14*s, ix+22*s, iy+4*s);
    doc.line(ix+14*s, iy+4*s,  ix+22*s, iy+4*s);
    doc.line(ix+22*s, iy+4*s,  ix+22*s, iy+12*s);
  };
  const iconTrendingDown: DrawFn = (ix, iy, sz, c) => {
    const s = sz / 24;
    doc.setDrawColor(...c); doc.setLineWidth(0.4 * sz / 5);
    doc.line(ix+2*s,  iy+6*s,  ix+8*s,  iy+14*s);
    doc.line(ix+8*s,  iy+14*s, ix+14*s, iy+10*s);
    doc.line(ix+14*s, iy+10*s, ix+22*s, iy+20*s);
    doc.line(ix+14*s, iy+20*s, ix+22*s, iy+20*s);
    doc.line(ix+22*s, iy+20*s, ix+22*s, iy+12*s);
  };

  type MC = {
    label: string; value: string; sub: string;
    vc: [number,number,number]; ic: [number,number,number];
    bg: [number,number,number]; brd: [number,number,number];
    ghost: [number,number,number]; draw: DrawFn;
  };
  const mcards: MC[] = [
    { label:"RENDA LÍQUIDA TOTAL", value:`R$ ${fmtMoeda(Math.round(resultadoTotal))}`, sub:`mês de ${MONTHS[m].toLowerCase()}`,
      vc:BLUE,  ic:BLUE,      bg:BLUE_LIGHT, brd:BLUE_BRD,  ghost:[220,234,250] as [number,number,number], draw:iconHomeDollar  },
    { label:"MÉDIA POR IMÓVEL",    value:`R$ ${fmtMoeda(Math.round(media))}`,          sub:`${nImoveis} imóveis`,
      vc:INK,   ic:INK_LIGHT, bg:SAND,       brd:BORDER_C,  ghost:[235,232,226] as [number,number,number], draw:iconBuilding    },
    { label:"MAIOR RENDA",         value:melhor?`R$ ${fmtMoeda(Math.round(melhor.resultado))}`:"—", sub:melhor?.label??"",
      vc:GREEN, ic:GREEN,     bg:SAND,       brd:BORDER_C,  ghost:[235,232,226] as [number,number,number], draw:iconTrendingUp  },
    { label:"MENOR RENDA",         value:pior?`R$ ${fmtMoeda(Math.round(pior.resultado))}`:"—",   sub:pior?.label??"",
      vc:AMBER, ic:AMBER,     bg:SAND,       brd:BORDER_C,  ghost:[235,232,226] as [number,number,number], draw:iconTrendingDown},
  ];

  mcards.forEach((mc, i) => {
    const mx = MG + i * (mW + 3);
    doc.setFillColor(...mc.bg);
    doc.setDrawColor(...mc.brd);
    doc.setLineWidth(0.25);
    doc.roundedRect(mx, cy, mW, mH, 3.5, 3.5, "FD");

    // Ghost icon (large watermark, bottom-right, very light)
    mc.draw(mx + mW - 18, cy + mH - 18, 19, mc.ghost);

    // Small icon (top-left, colored)
    mc.draw(mx + 3, cy + 2.5, 5.5, mc.ic);

    // Label uppercase
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...INK_LIGHT);
    doc.text(mc.label, mx + 4, cy + 12, { maxWidth: mW - 5 });

    // Value in serif
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...mc.vc);
    doc.text(mc.value, mx + 4, cy + 20);

    // Sub-label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...INK_LIGHT);
    doc.text(mc.sub, mx + 4, cy + 25.5, { maxWidth: mW - 5 });
  });
  cy += mH + 5;

  // ── GRID-2: dois cards (barras + stacked) ────────────────────────────────
  const colGap = 4;
  const colW   = (W - colGap) / 2;  // ~89 mm cada
  const bRowH  = 3.2;
  const bGapH  = 0.4;
  const nBars  = sorted.length;
  const barsH  = nBars > 0 ? nBars * bRowH + (nBars - 1) * bGapH : 10;
  const cPadT  = 4;   // padding top após card-header
  const cPadB  = 5;   // padding bottom
  const hdrH   = 12;  // card-header area
  const colH   = hdrH + cPadT + barsH + cPadB;

  // ── Card esquerdo: Resultado líquido por imóvel ───────────────────────────
  card(MG, cy, colW, colH);
  const barStartY = cardHeader(MG, cy, colW, "RESULTADO LÍQUIDO POR IMÓVEL") + cPadT;

  const bLblW = 30;
  const bValW = 20;
  const trkW  = colW - bLblW - bValW - 9;
  const trkX  = MG + 4 + bLblW + 2;
  const maxR  = sorted.length > 0 ? Math.max(1, sorted[0].resultado) : 1;
  let barY    = barStartY;

  sorted.forEach((p) => {
    const fw = trkW * Math.max(0, p.resultado / maxR);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...INK_LIGHT);
    doc.text(p.label, MG + 4, barY + bRowH - 0.5, { maxWidth: bLblW - 1 });

    doc.setFillColor(...SAND);  // --sand track
    doc.roundedRect(trkX, barY, trkW, bRowH - 0.3, 1, 1, "F");
    if (fw > 0.5) {
      doc.setFillColor(...BLUE_MID);  // --blue-mid fill
      doc.roundedRect(trkX, barY, fw, bRowH - 0.3, 1, 1, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...INK);
    doc.text(`R$ ${fmtMoeda(Math.round(p.resultado))}`, MG + colW - 3, barY + bRowH - 0.5, { align: "right" });
    barY += bRowH + bGapH;
  });

  // ── Card direito: Receita × Despesas (stacked bar) ────────────────────────
  const rx = MG + colW + colGap;
  card(rx, cy, colW, colH);
  const chartStartY = cardHeader(rx, cy, colW, "RECEITA × DESPESAS") + cPadT;

  const cpL    = 4;
  const cpR    = 4;
  const legH   = 6;
  const chartW = colW - cpL - cpR;
  const chartH = colH - hdrH - cPadT - legH - cPadB;
  const chX    = rx + cpL;
  const chBotY = chartStartY + chartH;

  // Baseline
  doc.setDrawColor(...SAND_DARK);
  doc.setLineWidth(0.2);
  doc.line(chX, chBotY, chX + chartW, chBotY);

  // Barras empilhadas: blue-mid (resultado) + chart-gray (despesas)
  const maxRec  = porImovel.reduce((mx, p) => Math.max(mx, p.receita), 1);
  const sBarW   = nBars > 1 ? (chartW - (nBars - 1) * 0.8) / nBars : chartW;
  porImovel.forEach((p, idx) => {
    const bx   = chX + idx * (sBarW + 0.8);
    const totH = (p.receita / maxRec) * chartH;
    const resH = (Math.max(0, p.resultado) / maxRec) * chartH;
    const depH = totH - resH;
    const bTop = chBotY - totH;
    if (depH > 0.2) { doc.setFillColor(...CHART_GRAY); doc.rect(bx, bTop,        sBarW, depH, "F"); }
    if (resH > 0.2) { doc.setFillColor(...BLUE_MID);   doc.rect(bx, bTop + depH, sBarW, resH, "F"); }
  });

  // Legenda
  const legY = cy + colH - cPadB - legH + 2;
  doc.setFillColor(...BLUE_MID);
  doc.roundedRect(rx + 4, legY, 3, 2.5, 0.5, 0.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...INK_LIGHT);
  doc.text("Resultado líquido", rx + 9, legY + 2);
  doc.setFillColor(...CHART_GRAY);
  doc.roundedRect(rx + 40, legY, 3, 2.5, 0.5, 0.5, "F");
  doc.text("Despesas", rx + 45, legY + 2);

  cy += colH + 5;

  // ── TABELA: Detalhe por imóvel ────────────────────────────────────────────
  // Card branco com border, card-header com border-bottom sand-dark, depois autoTable
  // Estimamos a altura para o card outline (autoTable pode extravasar → nova página)
  const tblCardPadV = 4;
  const tblHdrH     = 12;
  const tblRowH     = 6;
  const estimTblH   = tblHdrH + tblCardPadV + 8 + (nImoveis + 2) * tblRowH;
  const tblCardH    = Math.min(estimTblH, PH - cy - MG - 12);
  card(MG, cy, W, tblCardH);
  const tblContentY = cardHeader(MG, cy, W, "DETALHE POR IMÓVEL") + tblCardPadV;
  cy = tblContentY;

  autoTable(doc, {
    startY: cy,
    head: [["IMÓVEL", "CAPITAL", "RECEITA BRUTA", "DESPESAS", "RESULTADO LÍQUIDO", "MARGEM", "ROI MÊS"]],
    body: sorted.map((p) => [
      p.label,
      `R$ ${fmtMoeda(Math.round(p.capital))}`,
      `R$ ${fmtMoeda(Math.round(p.receita))}`,
      `R$ ${fmtMoeda(Math.round(p.despesas))}`,
      "",  // desenhado manualmente em didDrawCell
      `${p.margem}%`,
      `${p.roi.toFixed(2)}%`,
    ]),
    foot: [[
      "Total portfolio",
      `R$ ${fmtMoeda(Math.round(capitalTotal))}`,
      `R$ ${fmtMoeda(Math.round(receitaTotal))}`,
      `R$ ${fmtMoeda(Math.round(despesasTotal))}`,
      `R$ ${fmtMoeda(Math.round(resultadoTotal))}`,
      `${margemTotal}%`,
      `${roiTotal.toFixed(2)}%`,
    ]],
    margin: { left: MG + 2, right: MG + 2 },
    styles: {
      fontSize:    7,
      cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
      textColor:   INK_MID,
      lineWidth:   0,
      fillColor:   WHITE,
    },
    headStyles: {
      fillColor:  WHITE,
      textColor:  INK_LIGHT,
      fontStyle:  "bold",
      fontSize:   6,
      lineWidth:  0,
    },
    // Total row: sand bg (--sand) + ink text, borda-top border
    footStyles: {
      fillColor:  SAND,
      textColor:  INK,
      fontStyle:  "bold",
      fontSize:   7,
      lineWidth:  0,
    },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { halign: "right"  as const },
      2: { halign: "right"  as const },
      3: { halign: "right"  as const },
      4: { halign: "right"  as const, cellWidth: 44 },
      5: { halign: "center" as const },
      6: { halign: "center" as const },
    },
    didParseCell(h) {
      // Align headers/footer to match column data alignment
      if (h.section === "head" || h.section === "foot") {
        if (h.column.index >= 1 && h.column.index <= 4) h.cell.styles.halign = "right";
        if (h.column.index === 5 || h.column.index === 6) h.cell.styles.halign = "center";
      }
    },
    didDrawCell(h) {
      // Head: border-bottom sand-dark (mais escuro, como --sand-dark)
      if (h.section === "head") {
        h.doc.setDrawColor(...SAND_DARK);
        h.doc.setLineWidth(0.3);
        h.doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
      }
      // Body: border-bottom sand (muito sutil)
      if (h.section === "body") {
        h.doc.setDrawColor(...SAND);
        h.doc.setLineWidth(0.25);
        h.doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
      }
      // Foot: border-top border (--border)
      if (h.section === "foot") {
        h.doc.setDrawColor(...BORDER_C);
        h.doc.setLineWidth(0.3);
        h.doc.line(h.cell.x, h.cell.y, h.cell.x + h.cell.width, h.cell.y);
      }

      // Resultado líquido + pill badge (coluna 4)
      if (h.section !== "body" || h.column.index !== 4) return;
      const ri = h.row.index;
      if (ri >= sorted.length) return;
      const p = sorted[ri];

      type Pill = { label: string; bg: [number,number,number]; fg: [number,number,number] };
      const pill: Pill =
        p.resultado >= media * 1.15 ? { label: "acima",    bg: BLUE_LIGHT,   fg: BLUE  }
        : p.resultado >= media * 0.85 ? { label: "na média", bg: GREEN_LIGHT,  fg: GREEN }
        :                               { label: "abaixo",   bg: AMBER_LIGHT,  fg: AMBER };

      const vc: [number,number,number] =
        p.resultado >= media * 1.15 ? BLUE
        : p.resultado >= media * 0.85 ? GREEN : AMBER;

      const cx2 = h.cell.x;
      const cy2 = h.cell.y;
      const cw  = h.cell.width;
      const ch  = h.cell.height;
      const mid = cy2 + ch / 2;

      h.doc.setFont("helvetica", "bold");
      h.doc.setFontSize(5.5);
      const ptw = h.doc.getTextWidth(pill.label);
      const pw  = ptw + 5;
      const ph  = 3.5;
      const px  = cx2 + cw - pw - 2;
      const py  = mid - ph / 2;

      // Pill
      h.doc.setFillColor(...pill.bg);
      h.doc.roundedRect(px, py, pw, ph, 1.5, 1.5, "F");
      h.doc.setFont("helvetica", "bold");
      h.doc.setFontSize(5.5);
      h.doc.setTextColor(...pill.fg);
      h.doc.text(pill.label, px + pw / 2, py + ph / 2 + 0.9, { align: "center" });

      // Valor bold à esquerda da pill
      h.doc.setFont("helvetica", "bold");
      h.doc.setFontSize(7);
      h.doc.setTextColor(...vc);
      h.doc.text(`R$ ${fmtMoeda(Math.round(p.resultado))}`, px - 2, mid + 1.2, { align: "right" });
    },
  });

  // ── RODAPÉ (todas as páginas) — border-top + ícone casa + texto centralizado
  const totalPgs = doc.getNumberOfPages();
  const nota =
    capitalTotal > 0
      ? `ROI calculado sobre capital total de R$ ${fmtMoeda(Math.round(capitalTotal))}  ·  Não inclui valorização patrimonial  ·  CDI referência ${CDI_ANUAL}% a.a.  ·  QuartoExtra`
      : "Cadastre o valor do imóvel em Imóveis para calcular o ROI.";

  for (let pg = 1; pg <= totalPgs; pg++) {
    doc.setPage(pg);
    const fy = PH - MG - 5;
    doc.setDrawColor(...BORDER_C);
    doc.setLineWidth(0.25);
    doc.line(MG, fy - 3, PW - MG, fy - 3);

    // Ícone casa (small, opacity ~0.35 ≈ ink-mid em 35%)
    doc.setFillColor(150, 145, 138);
    const fx = PW / 2 - doc.getTextWidth(nota) / 2 - 5;  // aprox centro
    doc.lines([[-2.5, 2], [5, 0]], PW / 2 - 3.5, fy - 1.5, [1, 1], "F", true);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK_LIGHT);
    doc.text(nota, PW / 2, fy + 0.5, { align: "center", maxWidth: W - 10 });
    void fx;
  }

  doc.save(`renda_mensal_${MONTHS[m].toLowerCase()}${y}.pdf`);
}
