import { getCurrentUser } from "@/lib/dashboard/auth";
import { redirect } from "next/navigation";
import { listIssuesForUser } from "@/lib/dashboard/issues_data";
import { IssuesTable } from "./issues_table";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dashboard/login");
  }

  const { issues, totalCount } = await listIssuesForUser(user, { limit: 50 });

  return (
    <div className="max-w-6xl">
      <div className="mb-10">
        <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
          Dashboard // Backlog
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-zinc-100">
          Backlog
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Everything Triage has processed — issues, pull requests, all states.
        </p>
      </div>

      <IssuesTable initialIssues={issues} totalCount={totalCount} />
    </div>
  );
}
