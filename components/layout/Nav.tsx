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
} from "@tabler/icons-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: IconChartBar },
  { href: "/mapa", label: "Mapa", icon: IconMap },
  { href: "/imoveis", label: "Imóveis", icon: IconHome },
  { href: "/garagens", label: "Garagens", icon: IconCar },
  { href: "/reservas", label: "Reservas", icon: IconCalendar },
  { href: "/relatorios", label: "Relatórios", icon: IconFileAnalytics },
  { href: "/importar", label: "Importar", icon: IconUpload },
  { href: "/integracoes", label: "Integrações", icon: IconPlugConnected },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`nav-btn${pathname === href ? " active" : ""}`}
        >
          <Icon size={16} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
