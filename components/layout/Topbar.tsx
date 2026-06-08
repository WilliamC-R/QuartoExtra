"use client";

import { IconHome2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

const roleLabel: Record<UserRole, string> = {
  gestor: "Gestor",
  cliente: "Cliente",
};

export function Topbar({ role }: { role: UserRole }) {
  const router = useRouter();
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="topbar-logo">
        <IconHome2 size={20} />
        Gestão de Aluguel
      </div>
      <div className="topbar-right">
        <span className="badge badge-ok" style={{ fontSize: 11, padding: "2px 8px" }}>
          {roleLabel[role]}
        </span>
        <span>{dateStr}</span>
        <button type="button" className="topbar-logout" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
