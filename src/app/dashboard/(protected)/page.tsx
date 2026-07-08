import { getCurrentUser } from "@/lib/dashboard/auth";
import { redirect } from "next/navigation";
import { loadOverviewData } from "@/lib/dashboard/overview_data";
import type { RecentActivityEvent } from "@/types/dashboard";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dashboard/login");
  }

  const data = await loadOverviewData(user);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Overview
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Recent triage activity across your repos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Issues classified" value={data.metrics.totalIssuesClassified} />
        <MetricCard label="Patterns detected" value={data.metrics.patternsDetected} />
        <MetricCard label="Duplicates caught" value={data.metrics.duplicatesCaught} />
        <MetricCard label="Drafts approved" value={data.metrics.draftsApproved} />
      </div>

      <div className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Recent activity
          </h2>
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">
            No recent activity yet. Install Triage on a GitHub repo to get started.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
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
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
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
          <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Pattern detected · {event.severity} · {event.category}
          </p>
          <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100 truncate">
            {event.patternTitle}
          </p>
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
          {relativeTime}
        </span>
      </div>
    );
  }

  if (event.kind === "draft_approved") {
    return (
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Draft approved · {event.repoFullName}#{event.issueNumber}
          </p>
          <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100 truncate">
            {event.issueTitle}
          </p>
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
          {relativeTime}
        </span>
      </div>
    );
  }

  // issue_classified
  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Issue classified · {event.issueType} · {event.repoFullName}#{event.issueNumber}
        </p>
        <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100 truncate">
          {event.issueTitle}
        </p>
      </div>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
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
