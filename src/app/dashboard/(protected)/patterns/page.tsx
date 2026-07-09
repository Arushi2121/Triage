import { getCurrentUser } from "@/lib/dashboard/auth";
import { redirect } from "next/navigation";
import { listPatternsForUser } from "@/lib/dashboard/patterns_data";
import { PatternsTable } from "./patterns_table";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dashboard/login");
  }

  const patterns = await listPatternsForUser(user);

  return (
    <div className="max-w-6xl">
      <div className="mb-10">
        <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
          Dashboard // Patterns
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-zinc-100">
          Detected Patterns
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Cross-issue themes surfaced by embedding-based clustering.
        </p>
      </div>

      <PatternsTable patterns={patterns} />
    </div>
  );
}
