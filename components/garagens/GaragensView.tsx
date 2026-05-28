"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCar, IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { GaragemVagasGrid } from "@/components/garagens/GaragemVagasGrid";
import { createClient } from "@/lib/supabase/client";
import { toTitleCase } from "@/lib/format";
import { garagemEstaLivre, montarOverviewGaragens } from "@/lib/garagens";
import type { Garagem, Imovel, Reserva } from "@/lib/types";

export function GaragensView({
  imoveis,
  garagens: initial,
  reservas,
  filtroPredioInicial = "",
}: {
  imoveis: Imovel[];
  garagens: Garagem[];
  reservas: Reserva[];
  filtroPredioInicial?: string;
}) {
  const router = useRouter();
  const [garagens, setGaragens] = useState(initial);
  const [filtroPredio, setFiltroPredio] = useState(filtroPredioInicial);
  const [loading, setLoading] = useState(false);

  const overview = useMemo(
    () => montarOverviewGaragens(imoveis, garagens, reservas),
    [imoveis, garagens, reservas]
  );

  const filtrado = useMemo(() => {
    if (!filtroPredio) return overview;
    return overview.filter((p) => p.predioLabel === filtroPredio);
  }, [overview, filtroPredio]);

  const prediosOpts = useMemo(
    () => overview.map((p) => p.predioLabel).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [overview]
  );

  const totalLivres = garagens.filter((g) =>
    garagemEstaLivre(g, reservas)
  ).length;
  const totalOcupadas = garagens.length - totalLivres;

  async function adicionarVagaPredio(predio: (typeof overview)[0]) {
    const codigo = prompt(`Código da vaga em ${predio.predioLabel}:`);
    if (!codigo?.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("garagens")
      .insert({
        user_id: user.id,
        estado: predio.estado === "—" ? "" : predio.estado,
        cidade: predio.cidade === "—" ? "" : predio.cidade,
        predio:
          predio.predioLabel === "(Sem prédio)" ? "" : predio.predioLabel,
        codigo: toTitleCase(codigo),
        status: "livre",
        obs: "",
      })
      .select()
      .single();

    setLoading(false);
    if (!error && data) {
      setGaragens((prev) => [...prev, data as Garagem]);
      router.refresh();
    }
  }

  return (
    <>
      <PageHeader
        title="Garagens"
        description="Overview por prédio e unidade — vagas conforme cadastro “Tem garagem?” nos imóveis"
      />

      <div className="metrics-grid">
        <div className="mc">
          <div className="mc-label">Vagas livres</div>
          <div className="mc-val" style={{ color: "#1D9E75" }}>
            {totalLivres}
          </div>
        </div>
        <div className="mc">
          <div className="mc-label">Ocupadas</div>
          <div className="mc-val" style={{ color: "#E24B4A" }}>
            {totalOcupadas}
          </div>
        </div>
        <div className="mc">
          <div className="mc-label">Prédios</div>
          <div className="mc-val">{overview.length}</div>
        </div>
      </div>

      <div className="garagem-legenda">
        <span className="garagem-legenda-item">
          <span className="garagem-legenda-sq livre" /> Livre
        </span>
        <span className="garagem-legenda-item">
          <span className="garagem-legenda-sq ocupada" /> Ocupada
        </span>
        <span className="garagem-legenda-item">
          <span className="garagem-legenda-sq bloqueada" /> Bloqueada
        </span>
      </div>

      <div className="toolbar">
        <div className="filter-row">
          <select
            value={filtroPredio}
            onChange={(e) => setFiltroPredio(e.target.value)}
          >
            <option value="">Todos os prédios</option>
            {prediosOpts.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtrado.length === 0 ? (
        <div className="card" style={{ color: "#888", fontSize: 13 }}>
          Nenhum imóvel com &quot;Tem garagem?&quot; cadastrado. Defina em Imóveis e
          adicione as vagas físicas de cada prédio abaixo.
        </div>
      ) : (
        filtrado.map((predio) => (
          <section key={predio.key} className="garagem-overview-predio">
            <div className="garagem-overview-predio-head">
              <h3 className="garagem-overview-predio-title">
                <IconCar
                  size={18}
                  style={{ verticalAlign: "text-bottom", marginRight: 6 }}
                />
                {predio.predioLabel}
              </h3>
              <span className="garagem-overview-meta">
                {predio.cidade}
                {predio.estado !== "—" ? ` · ${predio.estado}` : ""} ·{" "}
                <strong style={{ color: "#1D9E75" }}>{predio.livres} livre(s)</strong>
                {predio.ocupadas > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong style={{ color: "#E24B4A" }}>
                      {predio.ocupadas} ocupada(s)
                    </strong>
                  </>
                )}
              </span>
            </div>

            {predio.unidades.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px" }}>
                  Unidades com garagem (cadastro Imóveis):
                </p>
                <div className="garagem-unidades-list">
                  {predio.unidades.map((u) => (
                    <span key={u.imovel.id} className="garagem-unidade-chip">
                      {u.label}
                      {u.qtdGaragem > 1 ? ` · ${u.qtdGaragem} vagas` : ""}
                    </span>
                  ))}
                </div>
                {predio.demandaCadastro > predio.vagas.length && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "#EF9F27",
                      margin: "0 0 10px",
                    }}
                  >
                    Cadastro indica {predio.demandaCadastro} vaga(s) nas unidades;
                    há {predio.vagas.length} vaga(s) física(s) neste prédio.
                  </p>
                )}
              </>
            )}

            <GaragemVagasGrid vagas={predio.vagas} />

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => adicionarVagaPredio(predio)}
                disabled={loading}
              >
                <IconPlus size={14} /> Vaga neste prédio
              </button>
            </div>
          </section>
        ))
      )}
    </>
  );
}
