import { Topbar } from "./Topbar";
import { Nav } from "./Nav";
import type { UserRole } from "@/lib/types";

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  return (
    <div className="app">
      <Topbar role={role} />
      <Nav role={role} />
      <main className="main">{children}</main>
    </div>
  );
}
