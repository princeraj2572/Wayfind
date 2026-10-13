import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
