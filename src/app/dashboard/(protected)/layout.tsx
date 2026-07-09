import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { LogoutButton } from "./logout_button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dashboard/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen border-r border-zinc-800 bg-zinc-950 flex flex-col">
          {/* Wordmark section */}
          <div className="px-6 pt-8 pb-6 border-b border-zinc-800">
            <h2 className="text-lg font-medium tracking-[0.3em] text-zinc-100">
              TRIAGE
            </h2>
            <p className="mt-2 text-[10px] tracking-[0.2em] uppercase text-zinc-500">
              {user.github_username}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-0.5">
            <SidebarLink href="/dashboard" label="Overview" />
            <SidebarLink href="/dashboard/patterns" label="Patterns" />
            <SidebarLink href="/dashboard/issues" label="Backlog" />
          </nav>

          {/* Status footer */}
          <div className="border-t border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
                System Operational
              </span>
            </div>
            <LogoutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-xs tracking-[0.15em] uppercase text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
    >
      {label}
    </Link>
  );
}
