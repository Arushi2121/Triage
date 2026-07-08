"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLoginPage() {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/dashboard/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid API key");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12 font-mono">
      {/* Wordmark section */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-medium tracking-[0.3em] text-zinc-100">
          TRIAGE
        </h1>
        <p className="mt-2 text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
          Issue Orchestration Protocol v1.0
        </p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {/* Header */}
        <div className="px-8 pt-8 pb-6">
          <h2 className="text-sm font-medium text-zinc-100">
            Authentication Required
          </h2>
          <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
            Secure access to your triage workspace.
          </p>
        </div>

        {/* Form */}
        <div className="px-8 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-2"
              >
                Developer Identity
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="trg_..."
                required
                autoFocus
                className="block w-full bg-black border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-0 transition-colors font-mono"
              />
            </div>

            {error && (
              <div className="border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300 font-mono">
                ERROR: {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !apiKey}
              className="w-full bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? "AUTHENTICATING..." : (
                <>
                  <span>Authenticate</span>
                  <span className="text-emerald-100">→</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* System status footer */}
        <div className="border-t border-zinc-800 px-8 py-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
              System Status: Operational
            </span>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="border-t border-zinc-800 bg-black/40 px-8 py-3 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600">
            MCP Endpoint Active
          </span>
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600">
            v1.0.0
          </span>
        </div>
      </div>

      {/* Bottom footer */}
      <p className="mt-8 text-[10px] tracking-[0.2em] uppercase text-zinc-700">
        Triage // Slack Agent Builder Challenge 2026
      </p>
    </div>
  );
}
