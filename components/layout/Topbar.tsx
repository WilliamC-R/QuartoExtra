"use client";

import { IconHome2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Topbar() {
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
        <span>{dateStr}</span>
        <button type="button" className="topbar-logout" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
