"use client";

import { useMemo, useState } from "react";
import type {
  IssueListItem,
  IssueClassificationFilter,
  IssueStateFilter,
  IssueItemTypeFilter,
} from "@/types/dashboard";

const CLASSIFICATION_OPTIONS: IssueClassificationFilter[] = [
  "all",
  "bug",
  "feature",
  "question",
  "documentation",
  "discussion",
  "spam",
  "unclassified",
];

const STATE_OPTIONS: IssueStateFilter[] = ["all", "open", "closed"];
const ITEM_TYPE_OPTIONS: IssueItemTypeFilter[] = ["all", "issue", "pr"];

export function IssuesTable({
  initialIssues,
  totalCount,
}: {
  initialIssues: IssueListItem[];
  totalCount: number;
}) {
  const [issues, setIssues] = useState<IssueListItem[]>(initialIssues);
  const [itemType, setItemType] = useState<IssueItemTypeFilter>("all");
  const [classification, setClassification] = useState<IssueClassificationFilter>("all");
  const [state, setState] = useState<IssueStateFilter>("all");
  const [search, setSearch] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (itemType === "issue" && i.is_pull_request) return false;
      if (itemType === "pr" && !i.is_pull_request) return false;
      if (classification !== "all") {
        const c = i.classification_type ?? "unclassified";
        if (c !== classification) return false;
      }
      if (state !== "all" && i.state !== state) return false;
      if (searchLower && !i.title.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [issues, itemType, classification, state, search]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/dashboard/issues?offset=${issues.length}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setIssues((prev) => [...prev, ...data.issues]);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = issues.length < totalCount;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <FilterSelect
          label="Type"
          value={itemType}
          options={ITEM_TYPE_OPTIONS}
          onChange={(v) => setItemType(v as IssueItemTypeFilter)}
        />
        <FilterSelect
          label="Classification"
          value={classification}
          options={CLASSIFICATION_OPTIONS}
          onChange={(v) => setClassification(v as IssueClassificationFilter)}
        />
        <FilterSelect
          label="State"
          value={state}
          options={STATE_OPTIONS}
          onChange={(v) => setState(v as IssueStateFilter)}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search titles..."
          className="bg-black border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-0 font-mono"
        />
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 ml-auto">
          {filtered.length} / {issues.length} loaded ({totalCount} total)
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={issues.length > 0} />
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <Th>#</Th>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Classification</Th>
                <Th>State</Th>
                <Th>Draft</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => window.open(i.github_url, "_blank", "noopener,noreferrer")}
                  className="cursor-pointer hover:bg-zinc-900/60 transition-colors"
                >
                  <td className="px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-zinc-500 whitespace-nowrap">
                    #{i.github_issue_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-200 max-w-md truncate">
                    {i.title}
                  </td>
                  <td className="px-4 py-3">
                    <ItemTypeBadge isPR={i.is_pull_request} />
                  </td>
                  <td className="px-4 py-3">
                    <ClassificationBadge type={i.classification_type ?? "unclassified"} />
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge state={i.state} />
                  </td>
                  <td className="px-4 py-3">
                    <DraftBadge status={i.draft_status} />
                  </td>
                  <td className="px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-zinc-500 whitespace-nowrap">
                    {formatDate(i.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 border border-zinc-800 bg-zinc-950 text-[10px] tracking-[0.2em] uppercase text-zinc-400 hover:border-emerald-800 hover:text-emerald-400 transition-colors disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : `Load ${Math.min(50, totalCount - issues.length)} More`}
          </button>
        </div>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-500">
      {children}
    </th>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
        {label}:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black border border-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none focus:ring-0 font-mono"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemTypeBadge({ isPR }: { isPR: boolean }) {
  const cls = isPR
    ? "border-purple-900/60 bg-purple-950/40 text-purple-300"
    : "border-blue-900/60 bg-blue-950/40 text-blue-300";
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}
    >
      {isPR ? "PR" : "Issue"}
    </span>
  );
}

function ClassificationBadge({ type }: { type: string }) {
  const classes: Record<string, string> = {
    bug: "border-red-900/60 bg-red-950/40 text-red-300",
    feature: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
    question: "border-amber-900/60 bg-amber-950/40 text-amber-300",
    documentation: "border-sky-900/60 bg-sky-950/40 text-sky-300",
    discussion: "border-indigo-900/60 bg-indigo-950/40 text-indigo-300",
    spam: "border-zinc-800 bg-zinc-900 text-zinc-500",
    unclassified: "border-zinc-800 bg-black/30 text-zinc-600",
  };
  const cls = classes[type] ?? classes.unclassified;
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}>
      {type}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const cls =
    state === "open"
      ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
      : "border-zinc-800 bg-zinc-900 text-zinc-500";
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}>
      {state}
    </span>
  );
}

function DraftBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-[10px] text-zinc-700">—</span>;
  }
  const classes: Record<string, string> = {
    approved: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
    pending: "border-yellow-900/60 bg-yellow-950/40 text-yellow-300",
    skipped: "border-zinc-800 bg-zinc-900 text-zinc-500",
    edited: "border-sky-900/60 bg-sky-950/40 text-sky-300",
  };
  const cls = classes[status] ?? "border-zinc-800 bg-zinc-900 text-zinc-500";
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}>
      {status}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 p-10 text-center">
      <p className="text-sm text-zinc-500">
        {hasAny
          ? "No items match current filters."
          : "No items yet. Install Triage on a GitHub repo to start."}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
