"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { BuildingIcon } from "@/components/icons/BuildingIcon";
import { HouseIcon } from "@/components/icons/HouseIcon";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS_CUSTO, fmtMoeda, getCustoVariavelReserva, getResumoCustos } from "@/lib/custos";
import { cdiMensal, fmtRentabilidadeMensal, rentabilidadeMensal } from "@/lib/rentabilidade";
import { toTitleCase } from "@/lib/format";
import { agruparImoveisParaGrid } from "@/lib/imoveis-grupos";
import {
  getOcupacao,
  getReceitaMes,
  labelValorAluguel,
  modalidadeAluguelLabels,
  occColor,
} from "@/lib/metrics";
import type {
  Imovel,
  ImovelStatus,
  ModalidadeAluguel,
  Reserva,
} from "@/lib/types";

const CDI_MENSAL = cdiMensal(10.5);

const badgeMap: Record<ImovelStatus, string> = {
  ativo: "badge-ok",
  manutencao: "badge-warn",
  bloqueado: "badge-block",
};

const labelMap: Record<ImovelStatus, string> = {
  ativo: "Ativo",
  manutencao: "Manutenção",
  bloqueado: "Bloqueado",
};

const emptyForm = {
  matricula: "",
  estado: "",
  cidade: "",
  bairro: "",
  predio: "",
  unidade: "",
  valor_imovel: "",
  tipo: "Apartamento",
  modalidade_aluguel: "diaria" as ModalidadeAluguel,
  diaria: "",
  cap: "2",
  qtd_garagens: "0",
  status: "ativo" as ImovelStatus,
  obs: "",
  custo_condominio: "",
  custo_energia: "",
  custo_internet: "",
  custo_limpeza: "",
  repasse_condominio: "",
  repasse_energia: "",
  repasse_internet: "",
  repasse_limpeza: "",
  iptu_anual: "",
  repasse_iptu_anual: "",
  itbi: "",
};

function custosFromImovel(im: Imovel) {
  return {
    custo_condominio: String(im.custo_condominio ?? 0),
    custo_energia: String(im.custo_energia ?? 0),
    custo_internet: String(im.custo_internet ?? 0),
    custo_limpeza: String(im.custo_limpeza ?? 0),
    repasse_condominio: String(im.repasse_condominio ?? 0),
    repasse_energia: String(im.repasse_energia ?? 0),
    repasse_internet: String(im.repasse_internet ?? 0),
    repasse_limpeza: String(im.repasse_limpeza ?? 0),
    iptu_anual: String(im.iptu_anual ?? 0),
    repasse_iptu_anual: String(im.repasse_iptu_anual ?? 0),
    itbi: String(im.itbi ?? 0),
  };
}

function custosPayload(form: typeof emptyForm) {
  return {
    custo_condominio: Number(form.custo_condominio) || 0,
    custo_energia: Number(form.custo_energia) || 0,
    custo_internet: Number(form.custo_internet) || 0,
    custo_limpeza: Number(form.custo_limpeza) || 0,
    repasse_condominio: Number(form.repasse_condominio) || 0,
    repasse_energia: Number(form.repasse_energia) || 0,
    repasse_internet: Number(form.repasse_internet) || 0,
    repasse_limpeza: Number(form.repasse_limpeza) || 0,
    iptu_anual: Number(form.iptu_anual) || 0,
    repasse_iptu_anual: Number(form.repasse_iptu_anual) || 0,
    itbi: Number(form.itbi) || 0,
  };
}

export function ImoveisView({
  imoveis: initial,
  reservas,
}: {
  imoveis: Imovel[];
  reservas: Reserva[];
}) {
  const router = useRouter();
  const [imoveis, setImoveis] = useState(initial);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = new Date();
  const curMes = now.getMonth();
  const curYear = now.getFullYear();

  const resumoForm = getResumoCustos({
    custo_condominio: Number(form.custo_condominio) || 0,
    custo_energia: Number(form.custo_energia) || 0,
    custo_internet: Number(form.custo_internet) || 0,
    custo_limpeza: Number(form.custo_limpeza) || 0,
    repasse_condominio: Number(form.repasse_condominio) || 0,
    repasse_energia: Number(form.repasse_energia) || 0,
    repasse_internet: Number(form.repasse_internet) || 0,
    repasse_limpeza: Number(form.repasse_limpeza) || 0,
    iptu_anual: Number(form.iptu_anual) || 0,
    repasse_iptu_anual: Number(form.repasse_iptu_anual) || 0,
  } as Imovel);

  const prediosExistentes = useMemo(
    () =>
      [...new Set(imoveis.map((i) => i.predio?.trim()).filter(Boolean))].sort(
        (a, b) => a!.localeCompare(b!, "pt-BR")
      ),
    [imoveis]
  );

  const filtered = imoveis.filter((i) => {
    if (filtroStatus && i.status !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const match =
        i.matricula.toLowerCase().includes(q) ||
        i.bairro.toLowerCase().includes(q) ||
        (i.predio || "").toLowerCase().includes(q) ||
        (i.cidade || "").toLowerCase().includes(q) ||
        (i.unidade || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const grupos = useMemo(
    () => agruparImoveisParaGrid(filtered),
    [filtered]
  );

  const grupoAtivo = grupos.find((g) => g.key === grupoAberto);
  const listaExibir = grupoAtivo ? grupoAtivo.imoveis : [];

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(im: Imovel) {
    setEditingId(im.id);
    setForm({
      matricula: im.matricula,
      estado: im.estado || "",
      cidade: im.cidade,
      bairro: im.bairro,
      predio: im.predio || "",
      unidade: im.unidade || "",
      valor_imovel: String(im.valor_imovel ?? 0),
      tipo: im.tipo,
      modalidade_aluguel: im.modalidade_aluguel ?? "diaria",
      diaria: String(im.diaria),
      cap: String(im.cap),
      qtd_garagens: String(im.qtd_garagens ?? 0),
      status: im.status,
      obs: im.obs || "",
      ...custosFromImovel(im),
    });
    setShowForm(true);
  }

  async function salvar() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      matricula: form.matricula.trim() || "S/Matrícula",
      estado: form.estado.trim().toUpperCase().slice(0, 2),
      cidade: toTitleCase(form.cidade),
      bairro: toTitleCase(form.bairro),
      predio: toTitleCase(form.predio),
      unidade: toTitleCase(form.unidade),
      valor_imovel: Number(form.valor_imovel) || 0,
      tipo: form.tipo,
      modalidade_aluguel: form.modalidade_aluguel,
      diaria: Number(form.diaria) || 0,
      cap: Number(form.cap) || 2,
      qtd_garagens: Math.min(10, Math.max(0, Number(form.qtd_garagens) || 0)),
      status: form.status,
      obs: form.obs.trim(),
      ...custosPayload(form),
      user_id: user.id,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("imoveis")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      if (!error && data) {
        setImoveis((prev) =>
          prev.map((i) => (i.id === editingId ? (data as Imovel) : i))
        );
      }
    } else {
      const { data, error } = await supabase
        .from("imoveis")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setImoveis((prev) => [...prev, data as Imovel]);
      }
    }

    setLoading(false);
    setShowForm(false);
    router.refresh();
  }

  async function remover(id: string) {
    if (
      !confirm(
        "Remover este imóvel? As reservas associadas serão removidas também."
      )
    )
      return;
    const supabase = createClient();
    await supabase.from("imoveis").delete().eq("id", id);
    setImoveis((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Imóveis" description="Cadastro e gestão do portfólio" />
      <div className="toolbar">
        <div className="filter-row">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="manutencao">Em manutenção</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
          <input
            type="text"
            placeholder="Buscar matrícula, prédio, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={openNew}>
          <IconPlus size={16} /> Novo imóvel
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">
            {editingId ? "Editar imóvel" : "Novo imóvel"}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Matrícula</label>
              <input
                value={form.matricula}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                placeholder="Ex: 12345-6 ou AP-101"
              />
            </div>
            <div className="form-group">
              <label>Estado (UF)</label>
              <input
                value={form.estado}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estado: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                placeholder="Ex: SC"
                maxLength={2}
              />
            </div>
            <div className="form-group">
              <label>Cidade</label>
              <input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Prédio / condomínio</label>
              <input
                list="predios-list"
                value={form.predio}
                onChange={(e) => setForm({ ...form, predio: e.target.value })}
                placeholder="Ex: Residencial Beira-Mar"
              />
              <datalist id="predios-list">
                {prediosExistentes.map((p) => (
                  <option key={p} value={p!} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Unidade</label>
              <input
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="Ex: 101, Bloco A"
              />
              <span style={{ fontSize: 11, color: "#888" }}>
                Mesma unidade + prédio agrupa no mapa
              </span>
            </div>
            <div className="form-group">
              <label>Bairro</label>
              <input
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option>Apartamento</option>
                <option>Casa</option>
                <option>Studio</option>
                <option>Chalé</option>
                <option>Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Modalidade de aluguel</label>
              <select
                value={form.modalidade_aluguel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    modalidade_aluguel: e.target.value as ModalidadeAluguel,
                  })
                }
              >
                <option value="diaria">Diária</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div className="form-group">
              <label>{labelValorAluguel(form.modalidade_aluguel)}</label>
              <input
                type="number"
                value={form.diaria}
                onChange={(e) => setForm({ ...form, diaria: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Valor do imóvel (R$)</label>
              <input
                type="number"
                min={0}
                value={form.valor_imovel}
                onChange={(e) => {
                  const val = e.target.value;
                  const v = Number(val) || 0;
                  const itbi = val ? String(Math.round(v * 0.02)) : "";
                  const iptu_anual = val ? String(Math.round(v * 0.015)) : "";
                  setForm({ ...form, valor_imovel: val, itbi, iptu_anual });
                }}
                placeholder="Para cálculo de rentabilidade"
              />
            </div>
            <div className="form-group">
              <label>ITBI (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.itbi}
                onChange={(e) => setForm({ ...form, itbi: e.target.value })}
                placeholder="Auto: 2% do valor"
              />
              <span style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                Calculado automaticamente (2% do valor do imóvel). Editável.
              </span>
            </div>
            <div className="form-group">
              <label>Capacidade (pessoas)</label>
              <input
                type="number"
                value={form.cap}
                onChange={(e) => setForm({ ...form, cap: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tem garagem?</label>
              <select
                value={form.qtd_garagens}
                onChange={(e) =>
                  setForm({ ...form, qtd_garagens: e.target.value })
                }
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "0 — Não" : `${n} — ${n} vaga(s)`}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "#888" }}>
                Disponibilidade na reserva; overview na aba Garagens
              </span>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ImovelStatus })
                }
              >
                <option value="ativo">Ativo</option>
                <option value="manutencao">Em manutenção</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <input
                value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
              />
            </div>
            <div className="form-section">
              <div className="form-section-title">
                Custos fixos e repasse ao hóspede
              </div>
              <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                Informe o custo mensal de cada item e quanto é repassado na cobrança (0 = não repassa).
                Energia e limpeza são calculadas automaticamente por reserva nos relatórios.
              </p>
              <table className="custos-table">
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>Despesa</th>
                    <th style={{ width: "36%" }}>Custo mensal (R$)</th>
                    <th style={{ width: "36%" }}>Repasse ao hóspede (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS_CUSTO.map((cat) => (
                    <tr key={cat.key}>
                      <td style={{ fontWeight: 500, color: "#444" }}>
                        {cat.label}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form[cat.custo]}
                          onChange={(e) =>
                            setForm({ ...form, [cat.custo]: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form[cat.repasse]}
                          onChange={(e) =>
                            setForm({ ...form, [cat.repasse]: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="custos-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>IPTU</th>
                    <th style={{ width: "36%" }}>
                      Valor anual (R$)
                      <div style={{ fontSize: 10, fontWeight: 400, color: "#aaa" }}>Auto: 1,5% do imóvel</div>
                    </th>
                    <th style={{ width: "36%" }}>
                      Repasse ao hóspede (anual R$)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 500, color: "#444" }}>IPTU</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.iptu_anual}
                        onChange={(e) => setForm({ ...form, iptu_anual: e.target.value })}
                      />
                     
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.repasse_iptu_anual}
                        onChange={(e) => setForm({ ...form, repasse_iptu_anual: e.target.value })}
                      />
                    
                   </td>
                  </tr>
                </tbody>
              </table>
              <div className="custos-resumo">
                <span>
                  Total custos:{" "}
                  <strong>R$ {fmtMoeda(resumoForm.totalCustos)}</strong>
                </span>
                <span>
                  Total repasse:{" "}
                  <strong>R$ {fmtMoeda(resumoForm.totalRepasse)}</strong>
                </span>
                <span>
                  Custo líquido (seu):{" "}
                  <strong>R$ {fmtMoeda(resumoForm.custoLiquido)}</strong>
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={salvar}
              disabled={loading}
            >
              <IconCheck size={16} /> Salvar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="card" style={{ color: "#888", fontSize: 13 }}>
          Nenhum imóvel encontrado com os filtros aplicados.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
            Clique em um prédio ou casa para ver a lista detalhada das unidades.
          </p>
          <div className="imoveis-grupos-grid">
            {grupos.map((gr) => {
              const ativoCard = grupoAberto === gr.key;
              const iconActive = gr.ativos > 0;
              return (
                <button
                  key={gr.key}
                  type="button"
                  className={`imovel-grupo-card${ativoCard ? " imovel-grupo-card-active" : ""}`}
                  onClick={() =>
                    setGrupoAberto((k) => (k === gr.key ? null : gr.key))
                  }
                >
                  {gr.tipo === "casa" ? (
                    <HouseIcon label="" size={56} active={iconActive} />
                  ) : (
                    <BuildingIcon label="" size={56} active={iconActive} />
                  )}
                  <span className="imovel-grupo-titulo">{gr.titulo}</span>
                  <span className="imovel-grupo-sub">{gr.subtitulo}</span>
                  <span
                    className={`badge imovel-grupo-badge ${gr.ativos === gr.imoveis.length ? "badge-ok" : "badge-warn"}`}
                  >
                    {gr.ativos}/{gr.imoveis.length} ativos
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {grupoAtivo && (
        <div style={{ marginTop: 8 }}>
          <div className="imoveis-lista-header">
            <h3>
              {grupoAtivo.tipo === "predio" ? "Prédio" : "Imóvel"}:{" "}
              {grupoAtivo.titulo}
            </h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setGrupoAberto(null)}
            >
              <IconX size={14} /> Fechar lista
            </button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Imóvel</th>
                  <th style={{ width: "11%" }}>Tipo</th>
                  <th style={{ width: "14%" }}>Ocupação</th>
                  <th style={{ width: "12%" }}>Receita/mês</th>
                  <th style={{ width: "10%" }}>Aluguel</th>
                  <th style={{ width: "10%" }}>Custo líq.</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th style={{ width: "12%" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaExibir.map((i) => {
                  const occ = getOcupacao(i.id, curMes, curYear, reservas);
                  const rec = getReceitaMes(i.id, curMes, curYear, reservas);
                  const custos = getResumoCustos(i);
                  const custoVar = reservas
                    .filter((r) => r.imovel_id === i.id)
                    .reduce((acc, r) => acc + getCustoVariavelReserva(r, [{ m: curMes, y: curYear }]), 0);
                  const resultadoMes = rec - custos.custoLiquido - custoVar;
                  const valorImovel = Number(i.valor_imovel) || 0;
                  const retMensal = rentabilidadeMensal(resultadoMes, valorImovel);
                  const isExpanded = expandedId === i.id;
                  return (
                    <Fragment key={i.id}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : i.id)}
                    >
                    <td>
                      <div style={{ fontWeight: 500 }}>{i.matricula}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {[i.estado, i.cidade].filter(Boolean).join(" · ")}
                        {i.predio ? ` · ${i.predio}` : ""}
                        {i.unidade ? ` · Un. ${i.unidade}` : ""}
                        {i.bairro ? ` · ${i.bairro}` : ""} · {i.cap} hósp.
                        {(i.qtd_garagens ?? 0) > 0
                          ? ` · ${i.qtd_garagens} gar.`
                          : ""}
                      </div>
                    </td>
                    <td>{i.tipo}</td>
                    <td>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: occColor(occ),
                        }}
                      >
                        {occ}%
                      </div>
                      <div className="occ-bar">
                        <div
                          className="occ-fill"
                          style={{
                            width: `${occ}%`,
                            background: occColor(occ),
                          }}
                        />
                      </div>
                    </td>
                    <td>R$ {rec.toLocaleString("pt-BR")}</td>
                    <td>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {modalidadeAluguelLabels[i.modalidade_aluguel ?? "diaria"]}
                      </div>
                      R$ {Number(i.diaria).toLocaleString("pt-BR")}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        R$ {fmtMoeda(custos.custoLiquido)}
                      </div>
                      {custos.totalRepasse > 0 && (
                        <div style={{ fontSize: 11, color: "#888" }}>
                          repasse R$ {fmtMoeda(custos.totalRepasse)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${badgeMap[i.status]}`}>
                        {labelMap[i.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openEdit(i)}
                        title="Editar"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => remover(i.id)}
                        title="Remover"
                        style={{ marginLeft: 4 }}
                      >
                        <IconTrash size={14} />
                      </button>
                    </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ background: "#f7fdf9", padding: "12px 16px", borderBottom: "2px solid #1D9E75" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
                            {[
                              { label: "Ocupacao mês", value: `${occ}%`, color: occ >= 70 ? "#1D9E75" : occ >= 40 ? "#EF9F27" : "#E24B4A" },
                              { label: "Receita mês", value: `R$ ${rec.toLocaleString("pt-BR")}`, color: undefined },
                              { label: "Custo fixo liq.", value: `R$ ${fmtMoeda(custos.custoLiquido)}`, color: undefined },
                              { label: "Custo variavel", value: `R$ ${fmtMoeda(Math.round(custoVar))}`, color: undefined },
                              { label: "Resultado mês", value: `R$ ${fmtMoeda(Math.round(resultadoMes))}`, color: resultadoMes >= 0 ? "#1D9E75" : "#E24B4A" },
                              {
                                label: `Rent. a.m. (CDI ${CDI_MENSAL.toFixed(2).replace(".", ",")}%)`,
                                value: valorImovel > 0 ? fmtRentabilidadeMensal(retMensal) : "—",
                                color: valorImovel > 0 ? (retMensal >= CDI_MENSAL ? "#1D9E75" : "#E24B4A") : "#aaa",
                              },
                            ].map((item) => (
                              <div key={item.label}>
                                <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{item.label}</div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: item.color ?? "#222" }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
