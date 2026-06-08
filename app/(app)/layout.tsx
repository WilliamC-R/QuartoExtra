import { AppShell } from "@/components/layout/AppShell";
import { fetchProfile } from "@/lib/data";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await fetchProfile();
  // Middleware já trata perfil ausente, mas esta camada adicional garante
  if (!profile) redirect("/login");
  const role: UserRole = profile.role;
  return <AppShell role={role}>{children}</AppShell>;
}
