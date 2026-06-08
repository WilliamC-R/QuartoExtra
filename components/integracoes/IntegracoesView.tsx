"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconBrandGoogle, IconMail, IconRefresh, IconUnlink, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";

interface GmailTokenInfo {
  last_sync_at: string | null;
  token_expires_at: string | null;
  created_at: string | null;
}

interface SyncResult {
  imported: number;
  skipped: number;
  noMatch: number;
  errors: number;
  total: number;
}

export function IntegracoesView({ gmailToken }: { gmailToken: GmailTokenInfo | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(!!gmailToken);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(gmailToken?.last_sync_at ?? null);

  // Handle redirect params after OAuth
  useEffect(() => {
    const sucesso = searchParams.get("sucesso");
    const erroParam = searchParams.get("erro");
    if (sucesso === "gmail_conectado") {
      setConnected(true);
      setErro(null);
      router.replace("/integracoes");
    }
    if (erroParam) {
      const msgs: Record<string, string> = {
        acesso_negado: "Acesso ao Gmail negado.",
        nao_autenticado: "Sessão expirada. Faça login novamente.",
        state_invalido: "Erro de segurança. Tente novamente.",
        token_falhou: "Falha ao obter tokens do Google. Tente novamente.",
      };
      setErro(msgs[erroParam] ?? "Erro desconhecido.");
      router.replace("/integracoes");
    }
  }, [searchParams, router]);

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    setErro(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao sincronizar.");
      } else {
        setSyncResult(data);
        setLastSync(new Date().toISOString());
      }
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar o Gmail? As reservas já importadas serão mantidas.")) return;
    setDisconnecting(true);
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setConnected(false);
    setDisconnecting(false);
    setSyncResult(null);
    router.refresh();
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <>
      <PageHeader title="Integrações" description="Conecte sua caixa de email para importar reservas automaticamente" />

      {erro && (
        <div className="card" style={{ borderLeft: "4px solid #E24B4A", padding: "10px 14px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <IconAlertTriangle size={16} color="#E24B4A" />
          {erro}
        </div>
      )}

      {syncResult && (
        <div className="card" style={{ borderLeft: "4px solid #1D9E75", padding: "10px 14px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <IconCheck size={16} color="#1D9E75" />
          Sync concluído — <strong>{syncResult.imported}</strong> importada(s),{" "}
          <strong>{syncResult.skipped}</strong> já processada(s),{" "}
          {syncResult.noMatch > 0 && (
            <><strong style={{ color: "#EF9F27" }}>{syncResult.noMatch}</strong> sem imóvel correspondente,{" "}</>
          )}
          {syncResult.errors > 0 && <><strong style={{ color: "#E24B4A" }}>{syncResult.errors}</strong> erro(s),{" "}</>}
          de {syncResult.total} email(s) encontrado(s).
          {syncResult.noMatch > 0 && (
            <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#888" }}>
              Emails sem correspondência: cadastre o imóvel com uma matrícula que apareça no email de confirmação.
            </span>
          )}
        </div>
      )}

      <div className="card" style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconMail size={22} color="#444" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Gmail</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Busca emails de confirmação do Airbnb e Booking.com
            </div>
          </div>
          <span className={`badge ${connected ? "badge-ok" : "badge-block"}`} style={{ marginLeft: "auto" }}>
            {connected ? "Conectado" : "Desconectado"}
          </span>
        </div>

        {connected ? (
          <>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
              <div>Última sincronização: <strong>{fmtDate(lastSync)}</strong></div>
            </div>

            <div style={{ background: "#f7fbf9", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#555" }}>
              <strong>O que é importado:</strong>
              <ul style={{ margin: "6px 0 0 16px", lineHeight: 1.8 }}>
                <li>Emails de confirmação do <strong>Airbnb</strong> (automated@airbnb.com)</li>
                <li>Emails de confirmação do <strong>Booking.com</strong> (noreply@booking.com)</li>
                <li>Dados extraídos: hóspede, checkin, checkout, valor</li>
                <li>Emails já processados são ignorados automaticamente</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={sync}
                disabled={syncing}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <IconRefresh size={15} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={disconnect}
                disabled={disconnecting}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <IconUnlink size={15} />
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.6 }}>
              Conecte sua conta do Google para que o sistema possa ler os emails de confirmação
              do Airbnb e Booking.com e criar as reservas automaticamente.
            </div>
            <div style={{ background: "#fffbf0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#888" }}>
              O sistema solicitará permissão <strong>somente de leitura</strong> do Gmail.
              Nenhum email é enviado ou modificado.
            </div>
            <a
              href="/api/gmail/auth"
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
            >
              <IconBrandGoogle size={16} />
              Conectar com Google
            </a>
          </>
        )}
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 12 }}>
        <div className="card-title" style={{ fontSize: 13 }}>Configuração necessária</div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8 }}>
          Adicione ao seu <code>.env.local</code>:
        </div>
        <pre style={{ background: "#f5f5f5", borderRadius: 6, padding: "10px 12px", fontSize: 11, marginTop: 8, overflowX: "auto" }}>
{`GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
NEXT_PUBLIC_APP_URL=https://seudominio.com`}
        </pre>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          Crie as credenciais em{" "}
          <strong>Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client ID</strong>.
          Adicione <code>{"{NEXT_PUBLIC_APP_URL}"}/api/gmail/callback</code> como URI de redirecionamento autorizado.
        </div>
      </div>
    </>
  );
}
