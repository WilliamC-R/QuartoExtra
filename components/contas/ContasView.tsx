"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconTrash,
  IconUser,
  IconBuildingEstate,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import type { Imovel } from "@/lib/types";

interface ClienteInfo {
  user_id: string;
  nome_completo: string;
  email: string;
  created_at: string;
  imovel: Pick<Imovel, "id" | "matricula" | "unidade" | "predio"> | null;
}

const emptyForm = {
  nome_completo: "",
  email: "",
  password: "",
  imovel_id: "",
};

export function ContasView({ imoveis }: { imoveis: Imovel[] }) {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const imoveisLivres = imoveis.filter((im) => !im.cliente_id);

  async function loadClientes() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/list");
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "err", msg: data.error ?? "Erro ao carregar clientes." });
      } else {
        setClientes(Array.isArray(data) ? data : []);
      }
    } catch {
      setFeedback({ type: "err", msg: "Erro de rede ao carregar clientes." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClientes(); }, []);

  function setField(k: keyof typeof emptyForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/accounts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nome_completo: form.nome_completo,
          imovel_id: form.imovel_id || null,
        }),
      });
      const data = await res.json();
      if (res.status >= 400) {
        setFeedback({ type: "err", msg: data.error ?? "Erro ao criar conta." });
      } else {
        // 200 = sucesso completo, 207 = conta criada mas vínculo com imóvel falhou
        const msg = data.warning
          ? `Conta criada para ${form.email}. ⚠ ${data.warning}`
          : `Conta criada para ${form.email}.`;
        setFeedback({ type: data.warning ? "err" : "ok", msg });
        setForm(emptyForm);
        setShowForm(false);
        await loadClientes();
        router.refresh();
      }
    } catch {
      setFeedback({ type: "err", msg: "Erro de rede. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(c: ClienteInfo) {
    if (!confirm(`Remover acesso de ${c.nome_completo} (${c.email})? O imóvel vinculado será desvinculado.`)) return;
    const res = await fetch("/api/accounts/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: c.user_id }),
    });
    if (res.ok) {
      setFeedback({ type: "ok", msg: `Conta de ${c.nome_completo} removida.` });
      await loadClientes();
      router.refresh();
    } else {
      const d = await res.json();
      setFeedback({ type: "err", msg: d.error ?? "Erro ao remover conta." });
    }
  }

  const imovelLabel = (im: Pick<Imovel, "matricula" | "unidade" | "predio">) => {
    const parts = [im.matricula, im.predio, im.unidade].filter(Boolean);
    return parts.join(" · ");
  };

  return (
    <>
      <PageHeader
        title="Contas de Clientes"
        description="Gerencie os acessos dos proprietários ao portal do imóvel"
      />

      {feedback && (
        <div
          className="card"
          style={{
            borderLeft: `4px solid ${feedback.type === "ok" ? "#1D9E75" : "#E24B4A"}`,
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          {feedback.type === "ok"
            ? <IconCheck size={16} color="#1D9E75" />
            : <IconAlertTriangle size={16} color="#E24B4A" />
          }
          {feedback.msg}
          <button
            type="button"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setFeedback(null)}
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* Actions bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFeedback(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {showForm ? <IconX size={15} /> : <IconPlus size={15} />}
          {showForm ? "Cancelar" : "Nova conta"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={loadClientes}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <IconRefresh size={14} />
          Atualizar
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <div className="card-title">Nova conta de cliente</div>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input
                  className="form-input"
                  value={form.nome_completo}
                  onChange={(e) => setField("nome_completo", e.target.value)}
                  required
                  placeholder="Ex: João Silva"
                />
              </div>
            </div>
            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                  placeholder="cliente@email.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Senha inicial *</label>
                <input
                  className="form-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Imóvel vinculado</label>
                <select
                  className="form-input"
                  value={form.imovel_id}
                  onChange={(e) => setField("imovel_id", e.target.value)}
                >
                  <option value="">— Selecione (opcional) —</option>
                  {imoveisLivres.map((im) => (
                    <option key={im.id} value={im.id}>
                      {imovelLabel(im)}
                    </option>
                  ))}
                </select>
                {imoveisLivres.length === 0 && (
                  <span className="form-hint">Todos os imóveis já têm cliente vinculado.</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Criando..." : "Criar conta"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clients list */}
      {loading ? (
        <div style={{ color: "#888", fontSize: 13 }}>Carregando contas...</div>
      ) : clientes.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "#888", fontSize: 13 }}>
          Nenhum cliente cadastrado. Crie a primeira conta acima.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clientes.map((c) => (
            <div key={c.user_id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconUser size={18} color="#666" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome_completo}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{c.email}</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.imovel ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#f0f9f5",
                      border: "1px solid #b7e5d4",
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      color: "#1D9E75",
                    }}
                  >
                    <IconBuildingEstate size={13} />
                    {imovelLabel(c.imovel)}
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#fafafa",
                      border: "1px solid #e0e0e0",
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      color: "#aaa",
                    }}
                  >
                    Sem imóvel
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleRemove(c)}
                title="Remover acesso"
                style={{ color: "#E24B4A", padding: "4px 8px" }}
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
