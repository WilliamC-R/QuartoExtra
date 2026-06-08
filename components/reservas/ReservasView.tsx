"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconPlus,
  IconTrash,
  IconBuilding,
  IconChevronDown,
  IconChevronUp,
  IconCalendar,
  IconUser,
  IconAlertTriangle,
  IconCurrencyDollar,
} from "@tabler/icons-react";
import { GaragemVagasGrid } from "@/components/garagens/GaragemVagasGrid";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import {
  codigoGaragem,
  contarVagasLivres,
  imovelTemGaragem,
  overviewDoImovel,
  primeiraGaragemLivre,
} from "@/lib/garagens";
import { labelPredio } from "@/lib/mapa";
import { toTitleCase } from "@/lib/format";
import { calcValorSugeridoAluguel, fmtDate, noitesEntre, parseDate } from "@/lib/metrics";
import {
  CUSTO_LIMPEZA_POR_RESERVA,
  ENERGIA_CUSTO_DIA,
  getCustoVariavelTotal,
} from "@/lib/custos";
import type { Garagem, Imovel, Reserva } from "@/lib/types";

const origColor: Record<string, string> = {
  Airbnb: "badge-bad",
  Booking: "badge-warn",
  Direto: "badge-ok",
};

function normalizarReserva(r: Reserva): Reserva {
  return {
    ...r,
    precisa_garagem: Boolean(r.precisa_garagem),
    garagem_id: r.garagem_id ?? null,
  };
}

function checkoutInfo(checkin: string, checkout: string): {
  label: string;
  status: "ok" | "warn" | "urgent" | "upcoming";
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ci = parseDate(checkin);
  const co = parseDate(checkout);
  ci.setHours(0, 0, 0, 0);
  co.setHours(0, 0, 0, 0);

  if (ci > today) {
    const d = Math.ceil((ci.getTime() - today.getTime()) / 86400000);
    return { label: `Entra em ${d}d`, status: "upcoming" };
  }
  const d = Math.ceil((co.getTime() - today.getTime()) / 86400000);
  if (d <= 0) return { label: "Checkout hoje", status: "urgent" };
  if (d === 1) return { label: "Checkout amanhã", status: "warn" };
  if (d <= 3) return { label: `Checkout em ${d}d`, status: "warn" };
  return { label: `Checkout em ${d}d`, status: "ok" };
}

export function ReservasView({
  imoveis,
  reservas: initial,
  garagens,
}: {
  imoveis: Imovel[];
  reservas: Reserva[];
  garagens: Garagem[];
}) {
  const router = useRouter();
  const [reservas, setReservas] = useState(() => initial.map(normalizarReserva));
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState<"dados" | "garagem">("dados");
  const [querGaragem, setQuerGaragem] = useState(false);
  const [garagemVerificada, setGaragemVerificada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [custoEdit, setCustoEdit] = useState({ limpeza: "0", energia: "0", outros: "0" });
  const [savingCustos, setSavingCustos] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [filtroImovel, setFiltroImovel] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [histCustoEdit, setHistCustoEdit] = useState({ limpeza: "0", energia: "0", outros: "0" });

  const [form, setForm] = useState({
    imovel_id: imoveis[0]?.id ?? "",
    hospede: "",
    checkin: new Date().toISOString().slice(0, 10),
    checkout: "",
    valor: "",
    origem: "Airbnb",
    obs: "",
  });

  const imovelForm = imoveis.find((i) => i.id === form.imovel_id);
  const imovelComGaragem = imovelForm ? imovelTemGaragem(imovelForm) : false;

  const periodoValido = Boolean(form.checkin && form.checkout && form.checkin < form.checkout);

  const overviewPeriodo = useMemo(() => {
    if (!imovelForm || !periodoValido) return undefined;
    return overviewDoImovel(imovelForm, imoveis, garagens, reservas, {
      checkin: form.checkin,
      checkout: form.checkout,
    });
  }, [imovelForm, imoveis, garagens, reservas, form.checkin, form.checkout, periodoValido]);

  const vagasNoPeriodo =
    periodoValido && imovelForm
      ? contarVagasLivres(imovelForm, garagens, reservas, form.checkin, form.checkout)
      : 0;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const ativas = useMemo(
    () =>
      reservas
        .filter((r) => {
          const co = parseDate(r.checkout);
          co.setHours(0, 0, 0, 0);
          return co >= today;
        })
        .sort((a, b) => a.checkout.localeCompare(b.checkout)),
    [reservas, today]
  );

  const historico = useMemo(() => {
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    return reservas
      .filter((r) => {
        const co = parseDate(r.checkout);
        co.setHours(0, 0, 0, 0);
        if (co >= today) return false;
        if (co < twelveMonthsAgo) return false;
        if (filtroImovel && r.imovel_id !== filtroImovel) return false;
        if (filtroMes !== "" && parseDate(r.checkin).getMonth() !== +filtroMes) return false;
        if (filtroOrigem && r.origem !== filtroOrigem) return false;
        return true;
      })
      .sort((a, b) => b.checkin.localeCompare(a.checkin));
  }, [reservas, today, filtroImovel, filtroMes, filtroOrigem]);

  function custoEditInit(r: Reserva) {
    const noites = noitesEntre(r.checkin, r.checkout);
    return {
      limpeza: String(Number(r.custo_limpeza) > 0 ? r.custo_limpeza : CUSTO_LIMPEZA_POR_RESERVA),
      energia: String(
        Number(r.custo_energia) > 0
          ? r.custo_energia
          : Math.round(noites * ENERGIA_CUSTO_DIA * 100) / 100
      ),
      outros: String(Number(r.custo_outros) || 0),
    };
  }

  function toggleCard(r: Reserva) {
    if (activeCardId === r.id) {
      setActiveCardId(null);
    } else {
      setActiveCardId(r.id);
      setCustoEdit(custoEditInit(r));
    }
  }

  function toggleHistExpand(r: Reserva) {
    if (expandedId === r.id) {
      setExpandedId(null);
    } else {
      setExpandedId(r.id);
      setHistCustoEdit(custoEditInit(r));
    }
  }

  async function salvarCustos(r: Reserva, edit: typeof custoEdit, onDone: () => void) {
    setSavingCustos(true);
    const supabase = createClient();
    const patch = {
      custo_limpeza: Number(edit.limpeza) || 0,
      custo_energia: Number(edit.energia) || 0,
      custo_outros: Number(edit.outros) || 0,
    };
    const { error } = await supabase.from("reservas").update(patch).eq("id", r.id);
    setSavingCustos(false);
    if (!error) {
      setReservas((prev) => prev.map((res) => (res.id === r.id ? { ...res, ...patch } : res)));
      onDone();
      router.refresh();
    }
  }

  function resetGaragemFlow() {
    setQuerGaragem(false);
    setGaragemVerificada(false);
    setFormTab("dados");
  }

  function abrirFormulario(im0?: Imovel) {
    const im = im0 ?? imoveis[0];
    setForm({
      imovel_id: im?.id ?? "",
      hospede: "",
      checkin: new Date().toISOString().slice(0, 10),
      checkout: "",
      valor: "",
      origem: "Airbnb",
      obs: "",
    });
    resetGaragemFlow();
    setShowForm(true);
  }

  function calcValorSugerido(imovelId: string, checkin: string, checkout: string) {
    const im = imoveis.find((i) => i.id === imovelId);
    const ci = new Date(checkin);
    const co = new Date(checkout);
    if (im && ci < co) {
      return String(
        calcValorSugeridoAluguel(Number(im.diaria), im.modalidade_aluguel ?? "diaria", checkin, checkout)
      );
    }
    return "";
  }

  function updateForm(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    if (patch.imovel_id || patch.checkin || patch.checkout) {
      const valor = calcValorSugerido(next.imovel_id, next.checkin, next.checkout);
      if (valor) next.valor = valor;
      setGaragemVerificada(false);
    }
    setForm(next);
  }

  function vagasLivresReserva(r: Reserva): number {
    const im = imoveis.find((i) => i.id === r.imovel_id);
    if (!im || r.checkin >= r.checkout) return 0;
    return contarVagasLivres(im, garagens, reservas, r.checkin, r.checkout, r.id);
  }

  function celulaGaragem(r: Reserva) {
    const im = imoveis.find((i) => i.id === r.imovel_id);
    const codigo = codigoGaragem(r.garagem_id, garagens);
    if (r.precisa_garagem) {
      if (codigo) return <span className="badge badge-ok">{codigo}</span>;
      const livres = vagasLivresReserva(r);
      if (livres > 0) return <span className="badge badge-warn">{livres} livre(s)</span>;
      return <span className="badge badge-bad">Sem vaga</span>;
    }
    if (im && imovelTemGaragem(im)) {
      const livres = vagasLivresReserva(r);
      return livres > 0 ? (
        <span className="badge badge-ok">{livres} livre(s)</span>
      ) : (
        <span style={{ color: "#aaa", fontSize: 12 }}>Ocupadas</span>
      );
    }
    return <span style={{ color: "#ccc" }}>—</span>;
  }

  function verificarDisponibilidadeGaragem() {
    if (!periodoValido) { alert("Informe check-in e check-out válidos antes."); setFormTab("dados"); return; }
    setFormTab("garagem");
    setGaragemVerificada(true);
  }

  async function salvar() {
    if (!periodoValido) { alert("Datas inválidas."); return; }
    const im = imoveis.find((i) => i.id === form.imovel_id);
    if (!im) return;
    const precisaGaragem = imovelComGaragem && querGaragem;
    if (precisaGaragem && !garagemVerificada) { alert("Verifique a disponibilidade de garagem antes de salvar."); setFormTab("garagem"); return; }

    let garagemId: string | null = null;
    if (precisaGaragem) {
      const vaga = primeiraGaragemLivre(im, garagens, reservas, form.checkin, form.checkout);
      if (!vaga) { alert("Não há vaga livre no período."); setFormTab("garagem"); return; }
      garagemId = vaga.id;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const noitesSalvar = noitesEntre(form.checkin, form.checkout);
    const payload = {
      imovel_id: form.imovel_id,
      hospede: toTitleCase(form.hospede) || "Hospede",
      checkin: form.checkin,
      checkout: form.checkout,
      valor: Number(form.valor) || 0,
      origem: form.origem,
      obs: form.obs.trim(),
      precisa_garagem: precisaGaragem,
      garagem_id: garagemId,
      user_id: user.id,
      custo_limpeza: CUSTO_LIMPEZA_POR_RESERVA,
      custo_energia: Math.round(noitesSalvar * ENERGIA_CUSTO_DIA * 100) / 100,
      custo_outros: 0,
    };

    const { data, error } = await supabase.from("reservas").insert(payload).select().single();
    setLoading(false);
    if (!error && data) {
      setReservas((prev) => [normalizarReserva(data as Reserva), ...prev]);
      setShowForm(false);
      resetGaragemFlow();
      router.refresh();
    } else if (error) {
      alert("Erro ao salvar. Execute a migration 006 no Supabase se ainda não rodou.");
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover esta reserva?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("reservas").delete().eq("id", id);
    if (error) { alert("Erro ao remover reserva."); return; }
    setReservas((prev) => prev.filter((r) => r.id !== id));
    if (activeCardId === id) setActiveCardId(null);
    router.refresh();
  }

  const predioLink = imovelForm ? labelPredio(imovelForm) : "";
  const activeReserva = ativas.find((r) => r.id === activeCardId) ?? null;

  return (
    <>
      <PageHeader
        title="Reservas"
        description={'Garagem conforme "Tem garagem?" do imóvel — verifique disponibilidade antes de confirmar'}
      />

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div />
        <button type="button" className="btn-primary" onClick={() => abrirFormulario()}>
          <IconPlus size={16} /> Nova reserva
        </button>
      </div>

      {/* ── Formulário nova reserva ──────────────────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Nova reserva</div>

          {imovelComGaragem && (
            <div className="garagem-reserva-tabs">
              <button
                type="button"
                className={`garagem-reserva-tab${formTab === "dados" ? " active" : ""}`}
                onClick={() => setFormTab("dados")}
              >
                Dados
              </button>
              <button
                type="button"
                className={`garagem-reserva-tab${formTab === "garagem" ? " active" : ""}`}
                onClick={() => {
                  if (!periodoValido) { alert("Preencha as datas na aba Dados primeiro."); return; }
                  setFormTab("garagem");
                }}
              >
                Garagem
                {querGaragem && garagemVerificada && vagasNoPeriodo > 0 && (
                  <span className="badge badge-ok" style={{ marginLeft: 6 }}>OK</span>
                )}
              </button>
            </div>
          )}

          {formTab === "dados" && (
            <>
              <div className="form-grid">
                <div className="form-group">
                  <label>Imóvel</label>
                  <select value={form.imovel_id} onChange={(e) => { updateForm({ imovel_id: e.target.value }); resetGaragemFlow(); }}>
                    {imoveis.map((i) => (
                      <option key={i.id} value={i.id}>{i.matricula}{imovelTemGaragem(i) ? " · com garagem" : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hóspede</label>
                  <input value={form.hospede} onChange={(e) => updateForm({ hospede: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Check-in</label>
                  <input type="date" value={form.checkin} onChange={(e) => updateForm({ checkin: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Check-out</label>
                  <input type="date" value={form.checkout} onChange={(e) => updateForm({ checkout: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Valor total (R$)</label>
                  <input type="number" value={form.valor} onChange={(e) => updateForm({ valor: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Origem</label>
                  <select value={form.origem} onChange={(e) => updateForm({ origem: e.target.value })}>
                    <option>Airbnb</option>
                    <option>Booking</option>
                    <option>Direto</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Observações</label>
                  <input value={form.obs} onChange={(e) => updateForm({ obs: e.target.value })} placeholder="Ex: hóspede traz pet, late checkout solicitado…" />
                </div>
                {imovelComGaragem && (
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={querGaragem}
                        onChange={(e) => {
                          setQuerGaragem(e.target.checked);
                          setGaragemVerificada(false);
                          if (e.target.checked && periodoValido) setFormTab("garagem");
                        }}
                      />
                      Cliente quer vaga de garagem
                      <span style={{ fontSize: 11, color: "#888" }}>({imovelForm?.qtd_garagens} vaga(s) no cadastro)</span>
                    </label>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {imovelComGaragem && querGaragem ? (
                  <button type="button" className="btn-primary" onClick={verificarDisponibilidadeGaragem} disabled={!periodoValido}>
                    Verificar garagem →
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={salvar} disabled={loading}>
                    <IconCheck size={16} /> Salvar reserva
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); resetGaragemFlow(); }}>
                  Cancelar
                </button>
              </div>
            </>
          )}

          {formTab === "garagem" && imovelComGaragem && (
            <div className="garagem-dispon-panel">
              <p style={{ fontSize: 13, margin: "0 0 10px" }}>
                <strong>{predioLink}</strong>
                {periodoValido && <> · {fmtDate(form.checkin)} – {fmtDate(form.checkout)}</>}
              </p>
              {!periodoValido ? (
                <p style={{ color: "#E24B4A", fontSize: 12 }}>Informe check-in e check-out na aba Dados.</p>
              ) : (
                <>
                  <div className="garagem-legenda" style={{ marginBottom: 10 }}>
                    <span className="garagem-legenda-item"><span className="garagem-legenda-sq livre" /> Livre no período</span>
                    <span className="garagem-legenda-item"><span className="garagem-legenda-sq ocupada" /> Ocupada</span>
                  </div>
                  <GaragemVagasGrid vagas={overviewPeriodo?.vagas ?? []} compact />
                  <p style={{ fontSize: 13, margin: "12px 0", color: vagasNoPeriodo > 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>
                    {vagasNoPeriodo > 0
                      ? `${vagasNoPeriodo} vaga(s) livre(s) — pode confirmar a reserva com garagem.`
                      : "Nenhuma vaga livre neste período."}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {vagasNoPeriodo > 0 && querGaragem ? (
                      <button type="button" className="btn-primary" onClick={salvar} disabled={loading}>
                        <IconCheck size={16} /> Confirmar reserva com garagem
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary" onClick={() => setFormTab("dados")}>Voltar aos dados</button>
                    )}
                    <Link href={`/garagens?predio=${encodeURIComponent(predioLink)}`} className="btn-secondary" style={{ textDecoration: "none" }}>
                      Ver overview em Garagens
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── RESERVAS ATIVAS ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div className="reservas-section-header">
          <span className="reservas-section-title">Reservas ativas</span>
          {ativas.length > 0 && (
            <span className="reservas-count-pill">{ativas.length}</span>
          )}
        </div>

        {ativas.length === 0 ? (
          <div className="reservas-empty">
            <IconBuilding size={32} style={{ color: "#ccc", marginBottom: 8 }} />
            <p>Nenhuma reserva ativa no momento</p>
          </div>
        ) : (
          <>
            <div className="reserva-cards-grid">
              {ativas.map((r) => {
                const im = imoveis.find((i) => i.id === r.imovel_id);
                const { label, status } = checkoutInfo(r.checkin, r.checkout);
                const isActive = activeCardId === r.id;
                const unit = im?.unidade || im?.matricula.slice(0, 6) || "—";

                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`reserva-card-btn${isActive ? " is-selected" : ""}`}
                    onClick={() => toggleCard(r)}
                    title={im?.matricula ?? ""}
                  >
                    <div className={`reserva-card-circle status-${status}${isActive ? " is-selected" : ""}`}>
                      <IconBuilding size={18} style={{ opacity: 0.5 }} />
                      <span className="reserva-card-unit">{unit}</span>
                    </div>
                    <span className="reserva-card-name">
                      {im ? (im.predio ? `${im.predio}` : im.matricula) : "—"}
                    </span>
                    <span className={`reserva-card-days ${status}`}>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            {activeReserva && (() => {
              const r = activeReserva;
              const im = imoveis.find((i) => i.id === r.imovel_id);
              const noites = noitesEntre(r.checkin, r.checkout);
              const totalCustos = Number(custoEdit.limpeza) + Number(custoEdit.energia) + Number(custoEdit.outros);
              const resultado = Number(r.valor) - totalCustos;
              const { status } = checkoutInfo(r.checkin, r.checkout);

              return (
                <div className="reserva-detail-panel">
                  {/* Header */}
                  <div className="reserva-detail-header">
                    <div>
                      <div className="reserva-detail-title">
                        {im?.matricula ?? "Imóvel"}
                        {im?.unidade && <span style={{ color: "#888", fontWeight: 400 }}> · Unidade {im.unidade}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span className={`badge ${origColor[r.origem] || "badge-block"}`}>{r.origem}</span>
                        <span className={`reserva-card-days ${status}`} style={{ fontSize: 11 }}>
                          {checkoutInfo(r.checkin, r.checkout).label}
                        </span>
                        {r.precisa_garagem && celulaGaragem(r)}
                      </div>
                    </div>
                    <button type="button" className="btn-icon" onClick={() => setActiveCardId(null)} title="Fechar">✕</button>
                  </div>

                  <div className="reserva-detail-grid">
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label"><IconUser size={10} style={{ display: "inline", marginRight: 3 }} />Hóspede</span>
                      <span className="reserva-detail-value">{r.hospede}</span>
                    </div>
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label"><IconCalendar size={10} style={{ display: "inline", marginRight: 3 }} />Check-in</span>
                      <span className="reserva-detail-value">{fmtDate(r.checkin)}</span>
                    </div>
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label"><IconCalendar size={10} style={{ display: "inline", marginRight: 3 }} />Check-out</span>
                      <span className={`reserva-detail-value${status === "urgent" ? " text-urgent" : status === "warn" ? " text-warn" : ""}`}>
                        {fmtDate(r.checkout)}
                      </span>
                    </div>
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label">Noites</span>
                      <span className="reserva-detail-value">{noites}</span>
                    </div>
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label"><IconCurrencyDollar size={10} style={{ display: "inline", marginRight: 3 }} />Receita</span>
                      <span className="reserva-detail-value">R$ {Number(r.valor).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="reserva-detail-field">
                      <span className="reserva-detail-label">Resultado</span>
                      <span className="reserva-detail-value" style={{ color: resultado >= 0 ? "#1D9E75" : "#E24B4A" }}>
                        R$ {resultado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Observações — destaque visual */}
                  {r.obs && r.obs.trim() && (
                    <div className="reserva-detail-obs">
                      <IconAlertTriangle size={15} />
                      <span><strong>Obs:</strong> {r.obs}</span>
                    </div>
                  )}

                  {/* Custos */}
                  <div className="reserva-custos-panel" style={{ marginTop: 0, borderRadius: 8 }}>
                    <span className="reserva-custos-titulo">Custos da reserva</span>
                    <div className="reserva-custos-fields">
                      <label className="reserva-custo-field">
                        <span>Limpeza (R$)</span>
                        <input type="number" min={0} step={0.01} value={custoEdit.limpeza}
                          onChange={(e) => setCustoEdit((p) => ({ ...p, limpeza: e.target.value }))} />
                      </label>
                      <label className="reserva-custo-field">
                        <span>Energia (R$)</span>
                        <input type="number" min={0} step={0.01} value={custoEdit.energia}
                          onChange={(e) => setCustoEdit((p) => ({ ...p, energia: e.target.value }))} />
                      </label>
                      <label className="reserva-custo-field">
                        <span>Outros (R$)</span>
                        <input type="number" min={0} step={0.01} value={custoEdit.outros}
                          onChange={(e) => setCustoEdit((p) => ({ ...p, outros: e.target.value }))} />
                      </label>
                      <div className="reserva-custo-totais">
                        <div>Total custos: <strong>R$ {totalCustos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                        <div>Resultado: <strong style={{ color: resultado >= 0 ? "#1D9E75" : "#E24B4A" }}>R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button type="button" className="btn-primary" disabled={savingCustos}
                        onClick={() => salvarCustos(r, custoEdit, () => setActiveCardId(null))}>
                        <IconCheck size={14} /> Salvar custos
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => remover(r.id)}>
                        <IconTrash size={14} /> Remover reserva
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setActiveCardId(null)}>Fechar</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── HISTÓRICO 12 MESES (colapsável) ─────────────────────────────────── */}
      <div>
        <button
          type="button"
          className={`history-toggle-btn${showHistory ? " open" : ""}`}
          onClick={() => setShowHistory((v) => !v)}
        >
          <div className="history-toggle-label">
            {showHistory ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            <span>Histórico — últimos 12 meses</span>
            <span className="badge badge-block" style={{ fontWeight: 400 }}>{historico.length} reservas</span>
          </div>
          <span style={{ fontSize: 11, color: "#aaa" }}>
            Receita: R$ {historico.reduce((s, r) => s + Number(r.valor), 0).toLocaleString("pt-BR")}
          </span>
        </button>

        {showHistory && (
          <div className="history-body">
            {/* Filtros do histórico */}
            <div className="filter-row" style={{ padding: "12px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
              <select value={filtroImovel} onChange={(e) => setFiltroImovel(e.target.value)}>
                <option value="">Todos os imóveis</option>
                {imoveis.map((i) => <option key={i.id} value={i.id}>{i.matricula}</option>)}
              </select>
              <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
                <option value="">Todos os meses</option>
                {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              <select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
                <option value="">Todas as origens</option>
                <option>Airbnb</option>
                <option>Booking</option>
                <option>Direto</option>
                <option>Outro</option>
              </select>
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Imóvel</th>
                  <th style={{ width: "13%" }}>Hóspede</th>
                  <th style={{ width: "10%" }}>Check-in</th>
                  <th style={{ width: "10%" }}>Check-out</th>
                  <th style={{ width: "6%" }}>Noites</th>
                  <th style={{ width: "11%" }}>Receita</th>
                  <th style={{ width: "11%" }}>Custos</th>
                  <th style={{ width: "9%" }}>Origem</th>
                  <th style={{ width: "9%" }}>Garagem</th>
                  <th style={{ width: "7%" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#aaa", padding: 24 }}>
                      Nenhuma reserva encontrada
                    </td>
                  </tr>
                ) : (
                  historico.map((r) => {
                    const im = imoveis.find((i) => i.id === r.imovel_id);
                    const noites = noitesEntre(r.checkin, r.checkout);
                    const isExp = expandedId === r.id;
                    const totalCustos = getCustoVariavelTotal(r);
                    const resultado = Number(r.valor) - totalCustos;
                    const editLimpeza = Number(histCustoEdit.limpeza);
                    const editEnergia = Number(histCustoEdit.energia);
                    const editOutros = Number(histCustoEdit.outros);
                    const editTotal = editLimpeza + editEnergia + editOutros;
                    const editResultado = Number(r.valor) - editTotal;

                    return (
                      <Fragment key={r.id}>
                        <tr style={{ cursor: "pointer" }} onClick={() => toggleHistExpand(r)} className={isExp ? "reserva-row-expanded" : undefined}>
                          <td style={{ fontWeight: 500 }}>
                            {im ? im.matricula : "—"}
                            {r.obs && r.obs.trim() && (
                              <IconAlertTriangle size={11} style={{ color: "#EF9F27", marginLeft: 5, verticalAlign: "middle" }} title={r.obs} />
                            )}
                          </td>
                          <td>{r.hospede}</td>
                          <td>{fmtDate(r.checkin)}</td>
                          <td>{fmtDate(r.checkout)}</td>
                          <td>{noites}</td>
                          <td>R$ {Number(r.valor).toLocaleString("pt-BR")}</td>
                          <td>
                            <span style={{ fontSize: 12 }}>R$ {totalCustos.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                            <div style={{ fontSize: 10, color: resultado >= 0 ? "#1D9E75" : "#E24B4A" }}>
                              res. R$ {resultado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </div>
                          </td>
                          <td><span className={`badge ${origColor[r.origem] || "badge-block"}`}>{r.origem}</span></td>
                          <td>{celulaGaragem(r)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="btn-icon" onClick={() => remover(r.id)} title="Remover">
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="reserva-custos-row">
                            <td colSpan={10}>
                              <div className="reserva-custos-panel">
                                {r.obs && r.obs.trim() && (
                                  <div className="reserva-detail-obs" style={{ marginBottom: 12 }}>
                                    <IconAlertTriangle size={13} />
                                    <span><strong>Obs:</strong> {r.obs}</span>
                                  </div>
                                )}
                                <span className="reserva-custos-titulo">Custos da reserva</span>
                                <div className="reserva-custos-fields">
                                  <label className="reserva-custo-field">
                                    <span>Limpeza (R$)</span>
                                    <input type="number" min={0} step={0.01} value={histCustoEdit.limpeza}
                                      onChange={(e) => setHistCustoEdit((p) => ({ ...p, limpeza: e.target.value }))} />
                                  </label>
                                  <label className="reserva-custo-field">
                                    <span>Energia (R$)</span>
                                    <input type="number" min={0} step={0.01} value={histCustoEdit.energia}
                                      onChange={(e) => setHistCustoEdit((p) => ({ ...p, energia: e.target.value }))} />
                                  </label>
                                  <label className="reserva-custo-field">
                                    <span>Outros (R$)</span>
                                    <input type="number" min={0} step={0.01} value={histCustoEdit.outros}
                                      onChange={(e) => setHistCustoEdit((p) => ({ ...p, outros: e.target.value }))} />
                                  </label>
                                  <div className="reserva-custo-totais">
                                    <div>Total: <strong>R$ {editTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                                    <div>Resultado: <strong style={{ color: editResultado >= 0 ? "#1D9E75" : "#E24B4A" }}>R$ {editResultado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button type="button" className="btn-primary" disabled={savingCustos}
                                    onClick={() => salvarCustos(r, histCustoEdit, () => setExpandedId(null))}>
                                    <IconCheck size={14} /> Salvar custos
                                  </button>
                                  <button type="button" className="btn-secondary" onClick={() => setExpandedId(null)}>Fechar</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
