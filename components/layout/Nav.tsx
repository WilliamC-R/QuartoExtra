"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconHome,
  IconCalendar,
  IconFileAnalytics,
  IconUpload,
  IconMap,
  IconCar,
  IconPlugConnected,
  IconUsers,
  IconBuildingEstate,
} from "@tabler/icons-react";
import type { UserRole } from "@/lib/types";

const GESTOR_LINKS = [
  { href: "/dashboard",   label: "Dashboard",   icon: IconChartBar },
  { href: "/mapa",        label: "Mapa",         icon: IconMap },
  { href: "/imoveis",     label: "Imóveis",      icon: IconHome },
  { href: "/garagens",    label: "Garagens",     icon: IconCar },
  { href: "/reservas",    label: "Reservas",     icon: IconCalendar },
  { href: "/relatorios",  label: "Relatórios",   icon: IconFileAnalytics },
  { href: "/importar",    label: "Importar",     icon: IconUpload },
  { href: "/integracoes", label: "Integrações",  icon: IconPlugConnected },
  { href: "/contas",      label: "Contas",       icon: IconUsers },
];

const CLIENTE_LINKS = [
  { href: "/meu-imovel", label: "Meu Imóvel", icon: IconBuildingEstate },
];

export function Nav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const links = role === "cliente" ? CLIENTE_LINKS : GESTOR_LINKS;

  return (
    <nav className="nav">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`nav-btn${pathname.startsWith(href) ? " active" : ""}`}
        >
          <Icon size={16} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
