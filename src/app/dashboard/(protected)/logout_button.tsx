"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/dashboard/auth/logout", { method: "POST" });
    router.push("/dashboard/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left text-[10px] tracking-[0.2em] uppercase text-zinc-600 hover:text-zinc-300 transition-colors"
    >
      Sign Out
    </button>
  );
}
