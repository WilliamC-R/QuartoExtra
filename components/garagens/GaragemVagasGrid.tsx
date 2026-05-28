"use client";

import type { VagaOverview } from "@/lib/garagens";
import { fmtDate } from "@/lib/metrics";

export function GaragemVagasGrid({
  vagas,
  compact = false,
  showCodigo = true,
}: {
  vagas: VagaOverview[];
  compact?: boolean;
  showCodigo?: boolean;
}) {
  if (vagas.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
        Nenhuma vaga cadastrada neste prédio.
      </p>
    );
  }

  return (
    <div
      className={`garagem-vagas-grid${compact ? " garagem-vagas-grid--compact" : ""}`}
      role="img"
      aria-label="Mapa de vagas: verde livre, vermelho ocupado"
    >
      {vagas.map((v) => {
        const cls = v.bloqueada
          ? "garagem-vaga-cell bloqueada"
          : v.livre
            ? "garagem-vaga-cell livre"
            : "garagem-vaga-cell ocupada";
        const title = v.bloqueada
          ? `${v.garagem.codigo} — bloqueada`
          : v.livre
            ? `${v.garagem.codigo} — livre`
            : v.reserva
              ? `${v.garagem.codigo} — ${v.reserva.hospede} (${fmtDate(v.reserva.checkin)} – ${fmtDate(v.reserva.checkout)})`
              : `${v.garagem.codigo} — ocupada`;

        return (
          <div key={v.garagem.id} className={cls} title={title}>
            {showCodigo && (
              <span className="garagem-vaga-codigo">{v.garagem.codigo}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
