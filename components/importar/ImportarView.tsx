"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconCloudUpload, IconDownload, IconFile } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { toTitleCase } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Imovel } from "@/lib/types";

interface LegacyImovel {
  id: string;
  nome: string;
  cidade?: string;
  bairro?: string;
  tipo?: string;
  estado?: string;
  predio?: string;
  unidade?: string;
  valor_imovel?: number;
  modalidade_aluguel?: "diaria" | "mensal";
  diaria?: number;
  custo_condominio?: number;
  custo_energia?: number;
  custo_internet?: number;
  custo_limpeza?: number;
  repasse_condominio?: number;
  repasse_energia?: number;
  repasse_internet?: number;
  repasse_limpeza?: number;
  qtd_garagens?: number;
  cap?: number;
  status?: string;
  obs?: string;
}

interface LegacyReserva {
  id: string;
  imovelId: string;
  hospede: string;
  checkin: string;
  checkout: string;
  valor: number;
  origem: string;
  obs?: string;
}

interface CsvFile {
  filename: string;
  headers: string[];
  rows: string[][];
}

/**
 * Converte datas para yyyy-mm-dd.
 * Padrão brasileiro dd/mm/yyyy. Auto-detecta pelo valor > 12:
 *   - Se parte A > 12 → é dia → dd/mm/yyyy
 *   - Se parte B > 12 → é dia → mm/dd/yyyy
 *   - Ambos ≤ 12 (ambíguo) → assume dd/mm/yyyy (padrão BR)
 */
function toISODate(s: string): string {
  if (!s) return "";
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (b > 12) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // ambíguo → dd/mm/yyyy (BR)
  }
  return t;
}

/**
 * Converte valores monetários BR (1.234,56 ou R$ 1.234,56) ou simples (1234.56) para número.
 */
function parseValor(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/R\$\s*/g, "").trim();
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(clean)) {
    return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return parseFloat(clean.replace(/,/g, "")) || 0;
}

/** Parser CSV correto: respeita campos entre aspas (ex: "1.507,28"). */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseCsvText(text: string, filename: string): CsvFile {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  const headers = parseCsvLine(lines[0])
    .map((h) => h.replace(/^﻿/, "").toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);
  return { filename, headers, rows };
}

export function ImportarView({ imoveis }: { imoveis: Imovel[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>([]);
  const [cols, setCols] = useState({
    imovel: "",
    hospede: "",
    cin: "",
    cout: "",
    valor: "",
    origem: "",
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);

  function importCSVs(files: FileList) {
    const fileArray = Array.from(files);
    const promises = fileArray.map(
      (file) =>
        new Promise<CsvFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = (e.target?.result as string) || "";
            resolve(parseCsvText(text, file.name));
          };
          reader.readAsText(file, "UTF-8");
        })
    );

    Promise.all(promises).then((results) => {
      setCsvFiles(results);
      const totalRows = results.reduce((s, r) => s + r.rows.length, 0);
      setPreview(
        results.length === 1
          ? `1 arquivo carregado: ${totalRows} linha(s).`
          : `${results.length} arquivos carregados: ${totalRows} linhas no total.`
      );

      // Mapeamento automático baseado nas colunas do primeiro arquivo
      const headers = results[0]?.headers || [];
      setCols({
        imovel:
          headers.find((h) => h.includes("imovel") || h.includes("property")) ||
          headers[0] ||
          "",
        hospede:
          headers.find((h) => h.includes("hospede") || h.includes("guest")) || "",
        cin:
          headers.find((h) => h.includes("checkin") || h.includes("start")) || "",
        cout:
          headers.find((h) => h.includes("checkout") || h.includes("end")) || "",
        valor:
          headers.find((h) => h.includes("valor") || h.includes("amount")) || "",
        origem:
          headers.find((h) => h.includes("origem") || h.includes("platform")) || "",
      });
      setShowMapping(true);
    });
  }

  async function confirmarImport() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let imoveisLocal = [...imoveis];
    let totalAdded = 0;
    let totalSkipped = 0;

    for (let fi = 0; fi < csvFiles.length; fi++) {
      const { rows, headers, filename } = csvFiles[fi];
      setProgress(
        csvFiles.length > 1
          ? `Processando arquivo ${fi + 1} de ${csvFiles.length}: ${filename}`
          : `Importando ${filename}…`
      );

      const get = (row: string[], col: string) => {
        const idx = headers.indexOf(col);
        return idx >= 0 ? row[idx] : "";
      };

      for (const row of rows) {
        const nomeImovel = get(row, cols.imovel);
        let im = imoveisLocal.find(
          (i) => i.nome.toLowerCase() === nomeImovel.toLowerCase()
        );
        if (!im && nomeImovel) {
          const { data } = await supabase
            .from("imoveis")
            .insert({
              user_id: user.id,
              nome: toTitleCase(nomeImovel),
              estado: "",
              cidade: "",
              bairro: "",
              predio: "",
              unidade: "",
              valor_imovel: 0,
              tipo: "Apartamento",
              modalidade_aluguel: "diaria",
              diaria: 0,
              custo_condominio: 0,
              custo_energia: 0,
              custo_internet: 0,
              custo_limpeza: 0,
              repasse_condominio: 0,
              repasse_energia: 0,
              repasse_internet: 0,
              repasse_limpeza: 0,
              qtd_garagens: 0,
              cap: 2,
              status: "ativo",
              obs: "Importado",
            })
            .select()
            .single();
          if (data) {
            im = data as Imovel;
            imoveisLocal.push(im);
          }
        }
        if (!im) continue;

        const ci = toISODate(get(row, cols.cin));
        const co = toISODate(get(row, cols.cout));
        if (!ci || !co || ci >= co) { totalSkipped++; continue; }

        const { error: upsertErr } = await supabase.from("reservas").upsert(
          {
            user_id: user.id,
            imovel_id: im.id,
            hospede: toTitleCase(get(row, cols.hospede)) || "Hospede",
            checkin: ci,
            checkout: co,
            valor: parseValor(get(row, cols.valor)),
            origem: toTitleCase(get(row, cols.origem)) || "Importado",
            obs: "",
          },
          { onConflict: "user_id,imovel_id,checkin,checkout" }
        );
        if (!upsertErr) totalAdded++;
        else totalSkipped++;
      }
    }

    setLoading(false);
    setProgress(null);
    const skipMsg = totalSkipped > 0
      ? ` (${totalSkipped} linha(s) pulada(s) — data inválida ou checkin ≥ checkout)`
      : "";
    const arquivosMsg = csvFiles.length > 1 ? ` de ${csvFiles.length} arquivos` : "";
    setPreview(`${totalAdded} reservas importadas${arquivosMsg}.${skipMsg}`);
    setShowMapping(false);
    setCsvFiles([]);
    router.refresh();
  }

  function downloadTemplate() {
    const csv =
      "﻿imovel,hospede,checkin,checkout,valor,origem\n" +
      "Apto Beira-Mar 101,João Silva,01/06/2026,05/06/2026,\"1.800,00\",Airbnb\n" +
      "Apto Beira-Mar 101,Maria Lima,10/06/2026,15/06/2026,\"2.250,00\",Booking\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template_reservas.csv";
    a.click();
  }

  async function migrarLocalStorage() {
    setLoading(true);
    setMigrateMsg(null);

    let legacyImoveis: LegacyImovel[] = [];
    let legacyReservas: LegacyReserva[] = [];

    try {
      legacyImoveis = JSON.parse(localStorage.getItem("vc_imoveis") || "[]");
      legacyReservas = JSON.parse(localStorage.getItem("vc_reservas") || "[]");
    } catch {
      setMigrateMsg("Não foi possível ler os dados do localStorage.");
      setLoading(false);
      return;
    }

    if (!legacyImoveis.length && !legacyReservas.length) {
      setMigrateMsg(
        "Nenhum dado encontrado no localStorage (vc_imoveis / vc_reservas). Abra o HTML antigo no mesmo navegador antes de migrar."
      );
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const idMap = new Map<string, string>();
    let imCount = 0;
    let resCount = 0;

    for (const lim of legacyImoveis) {
      const existing = imoveis.find(
        (i) => i.nome.toLowerCase() === lim.nome.toLowerCase()
      );
      if (existing) {
        idMap.set(lim.id, existing.id);
        continue;
      }
      const { data } = await supabase
        .from("imoveis")
        .insert({
          user_id: user.id,
          nome: lim.nome,
          estado: lim.estado || "",
          cidade: lim.cidade || "",
          bairro: lim.bairro || "",
          predio: lim.predio || "",
          unidade: lim.unidade || "",
          valor_imovel: lim.valor_imovel ?? 0,
          tipo: lim.tipo || "Apartamento",
          modalidade_aluguel: lim.modalidade_aluguel || "diaria",
          diaria: lim.diaria || 0,
          custo_condominio: lim.custo_condominio ?? 0,
          custo_energia: lim.custo_energia ?? 0,
          custo_internet: lim.custo_internet ?? 0,
          custo_limpeza: lim.custo_limpeza ?? 0,
          repasse_condominio: lim.repasse_condominio ?? 0,
          repasse_energia: lim.repasse_energia ?? 0,
          repasse_internet: lim.repasse_internet ?? 0,
          repasse_limpeza: lim.repasse_limpeza ?? 0,
          qtd_garagens: lim.qtd_garagens ?? 0,
          cap: lim.cap || 2,
          status: lim.status || "ativo",
          obs: lim.obs || "",
        })
        .select()
        .single();
      if (data) {
        idMap.set(lim.id, data.id);
        imCount++;
      }
    }

    for (const lr of legacyReservas) {
      const imovelId = idMap.get(lr.imovelId);
      if (!imovelId) continue;
      await supabase.from("reservas").upsert(
        {
          user_id: user.id,
          imovel_id: imovelId,
          hospede: toTitleCase(lr.hospede),
          checkin: lr.checkin,
          checkout: lr.checkout,
          valor: lr.valor,
          origem: toTitleCase(lr.origem),
          obs: lr.obs || "",
        },
        { onConflict: "user_id,imovel_id,checkin,checkout" }
      );
      resCount++;
    }

    setLoading(false);
    setMigrateMsg(
      `Migração concluída: ${imCount} imóveis e ${resCount} reservas importados.`
    );
    router.refresh();
  }

  const totalLinhas = csvFiles.reduce((s, f) => s + f.rows.length, 0);

  return (
    <>
      <PageHeader
        title="Importar reservas"
        description="Upload de CSV do Airbnb, Booking ou template próprio"
      />

      <div className="card">
        <div className="card-title">Migrar do protótipo HTML</div>
        <div className="alert alert-info" style={{ marginBottom: 14 }}>
          Se você usou o arquivo <code>vacancy_control_system.html</code> no
          mesmo navegador, clique abaixo para copiar imóveis e reservas do
          localStorage para o Supabase.
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={migrarLocalStorage}
          disabled={loading}
        >
          Migrar dados do localStorage
        </button>
        {migrateMsg && (
          <div
            className={`alert ${migrateMsg.includes("concluída") ? "alert-success" : "alert-warn"}`}
            style={{ marginTop: 12 }}
          >
            {migrateMsg}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Upload de arquivo(s) CSV</div>
        <div className="alert alert-info" style={{ marginBottom: 14 }}>
          Selecione um ou vários arquivos de uma vez. Formatos de data:{" "}
          <strong>dd/mm/aaaa</strong> (padrão BR), yyyy-mm-dd ou mm/dd/aaaa.
          Valores: <strong>1.800,00</strong> ou 1800.00 — ambos aceitos.
        </div>
        <label className="import-box" htmlFor="csvInput">
          <IconCloudUpload size={28} />
          Clique para selecionar um ou mais arquivos CSV
          <div style={{ fontSize: 11, marginTop: 6, color: "#bbb" }}>
            ou arraste e solte aqui — múltiplos arquivos são aceitos
          </div>
        </label>
        <input
          type="file"
          id="csvInput"
          accept=".csv"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) importCSVs(files);
          }}
        />

        {preview && (
          <div className="alert alert-success" style={{ marginBottom: 10 }}>
            {preview}
          </div>
        )}

        {progress && (
          <div className="alert alert-info" style={{ marginBottom: 10 }}>
            {progress}
          </div>
        )}

        {showMapping && csvFiles.length > 0 && (
          <div>
            {csvFiles.length > 1 && (
              <div style={{ marginTop: 12, marginBottom: 4 }}>
                <div className="card-title">Arquivos selecionados</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {csvFiles.map((f) => (
                    <span
                      key={f.filename}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        background: "#f0faf5",
                        border: "1px solid #c3e8d8",
                        borderRadius: 6,
                        padding: "3px 8px",
                        color: "#1D9E75",
                      }}
                    >
                      <IconFile size={13} />
                      {f.filename}
                      <span style={{ color: "#888", fontSize: 11 }}>({f.rows.length} linhas)</span>
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                  Total: <strong>{totalLinhas} linhas</strong> — mapeamento aplicado a todos os arquivos.
                </p>
              </div>
            )}

            <div className="card-title" style={{ marginTop: 4 }}>
              Mapeamento de colunas
            </div>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              Detectado automaticamente do primeiro arquivo. Ajuste se necessário.
            </p>
            <div className="form-grid">
              {(
                [
                  ["imovel", "Coluna → Imóvel"],
                  ["hospede", "Coluna → Hóspede"],
                  ["cin", "Coluna → Check-in"],
                  ["cout", "Coluna → Check-out"],
                  ["valor", "Coluna → Valor"],
                  ["origem", "Coluna → Origem"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="form-group">
                  <label>{label}</label>
                  <input
                    value={cols[key]}
                    onChange={(e) =>
                      setCols({ ...cols, [key]: e.target.value.toLowerCase() })
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={confirmarImport}
              disabled={loading}
            >
              <IconCheck size={16} />
              {csvFiles.length > 1
                ? `Importar ${csvFiles.length} arquivos (${totalLinhas} linhas)`
                : "Confirmar importação"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Template para preenchimento manual</div>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
          Baixe o template CSV no formato brasileiro, preencha com suas reservas e importe acima.
        </p>
        <button type="button" className="btn-secondary" onClick={downloadTemplate}>
          <IconDownload size={16} /> Baixar template CSV
        </button>
      </div>
    </>
  );
}
