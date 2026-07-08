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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-60 min-h-screen border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Triage
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {user.github_username}
            </p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <SidebarLink href="/dashboard" label="Overview" />
            <SidebarLink href="/dashboard/patterns" label="Patterns" />
            <SidebarLink href="/dashboard/issues" label="Issues" />
          </nav>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <LogoutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      {label}
    </Link>
  );
}
