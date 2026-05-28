import { Topbar } from "./Topbar";
import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <Topbar />
      <Nav />
      <main className="main">{children}</main>
    </div>
  );
}
