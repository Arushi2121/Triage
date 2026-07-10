import { getCurrentUser } from "@/lib/dashboard/auth";
import { redirect } from "next/navigation";
import { loadOverviewData } from "@/lib/dashboard/overview_data";
import { getLatestDigestForUser } from "@/lib/dashboard/digests_data";
import { LatestDigestCard } from "./latest_digest_card";
import type { RecentActivityEvent } from "@/types/dashboard";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dashboard/login");
  }

  const data = await loadOverviewData(user);
  const latestDigest = await getLatestDigestForUser(user);

  return (
    <div className="max-w-6xl">
      <div className="mb-10">
        <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">
          Dashboard // Overview
        </p>
        <h1 className="text-2xl font-medium tracking-tight text-zinc-100">
          System Overview
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Aggregate triage activity across your repositories.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <MetricCard label="Issues Classified" value={data.metrics.totalIssuesClassified} />
        <MetricCard label="Patterns Detected" value={data.metrics.patternsDetected} />
        <MetricCard label="Duplicates Caught" value={data.metrics.duplicatesCaught} />
        <MetricCard label="Drafts Approved" value={data.metrics.draftsApproved} />
      </div>

      <LatestDigestCard latest={latestDigest} />

      <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
          <span className="inline-block w-6 h-px bg-emerald-500"></span>
          <h2 className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            Recent Activity
          </h2>
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">
            No recent activity. Install Triage on a GitHub repo to begin.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {data.recentActivity.map((event, idx) => (
              <li key={idx}>
                <ActivityRow event={event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 hover:border-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-4 transition-colors">
      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-medium text-zinc-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ActivityRow({ event }: { event: RecentActivityEvent }) {
  const relativeTime = formatRelativeTime(event.timestamp);

  if (event.kind === "pattern_detected") {
    return (
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500">
            Pattern Detected · {event.severity} · {event.category}
          </p>
          <p className="mt-1.5 text-sm text-zinc-200 truncate">
            {event.patternTitle}
          </p>
        </div>
        <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 shrink-0">
          {relativeTime}
        </span>
      </div>
    );
  }

  if (event.kind === "draft_approved") {
    return (
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500">
            Draft Approved · {event.repoFullName}#{event.issueNumber}
          </p>
          <p className="mt-1.5 text-sm text-zinc-200 truncate">
            {event.issueTitle}
          </p>
        </div>
        <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 shrink-0">
          {relativeTime}
        </span>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500">
          Issue Classified · {event.issueType} · {event.repoFullName}#{event.issueNumber}
        </p>
        <p className="mt-1.5 text-sm text-zinc-200 truncate">
          {event.issueTitle}
        </p>
      </div>
      <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 shrink-0">
        {relativeTime}
      </span>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
