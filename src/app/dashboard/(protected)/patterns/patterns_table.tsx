"use client";

import { useMemo, useState } from "react";
import type {
  PatternListItem,
  PatternDetail,
  SeverityFilter,
  CategoryFilter,
} from "@/types/dashboard";

const SEVERITY_OPTIONS: SeverityFilter[] = ["all", "critical", "high", "medium", "low"];
const CATEGORY_OPTIONS: CategoryFilter[] = [
  "all",
  "performance",
  "documentation",
  "usability",
  "compatibility",
  "feature-request",
  "bug-cluster",
  "workflow-friction",
  "other",
];

export function PatternsTable({ patterns }: { patterns: PatternListItem[] }) {
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return patterns.filter((p) => {
      if (severity !== "all" && p.severity !== severity) return false;
      if (category !== "all" && p.category !== category) return false;
      return true;
    });
  }, [patterns, severity, category]);

  async function openPattern(patternId: string) {
    setSelectedPatternId(patternId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/patterns/${patternId}`);
      if (!res.ok) {
        setDetailError("Failed to load pattern details.");
        return;
      }
      const data = await res.json();
      setDetail(data.pattern);
    } catch {
      setDetailError("Failed to load pattern details.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedPatternId(null);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <FilterSelect
          label="Severity"
          value={severity}
          options={SEVERITY_OPTIONS}
          onChange={(v) => setSeverity(v as SeverityFilter)}
        />
        <FilterSelect
          label="Category"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(v) => setCategory(v as CategoryFilter)}
        />
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 ml-auto">
          {filtered.length} / {patterns.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={patterns.length > 0} />
      ) : (
        <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <Th>Pattern</Th>
                <Th>Category</Th>
                <Th>Severity</Th>
                <Th>Issues</Th>
                <Th>Detected</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openPattern(p.id)}
                  className="cursor-pointer hover:bg-zinc-900/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm text-zinc-100">{p.title}</div>
                    <div className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 mt-1">
                      {p.repo_full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{p.category}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={p.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{p.issue_count}</td>
                  <td className="px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-zinc-500">
                    {formatRelative(p.last_detected_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPatternId && (
        <Drawer
          loading={detailLoading}
          error={detailError}
          detail={detail}
          onClose={closeDrawer}
        />
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

function SeverityBadge({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    critical: "border-red-900/60 bg-red-950/40 text-red-300",
    high: "border-orange-900/60 bg-orange-950/40 text-orange-300",
    medium: "border-yellow-900/60 bg-yellow-950/40 text-yellow-300",
    low: "border-zinc-800 bg-zinc-900 text-zinc-400",
  };
  const cls = classes[severity] ?? classes.low;
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}
    >
      {severity}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 p-10 text-center">
      <p className="text-sm text-zinc-500">
        {hasAny
          ? "No patterns match current filters."
          : "No patterns detected yet. Triage surfaces themes when 3+ issues cluster."}
      </p>
    </div>
  );
}

function Drawer({
  loading,
  error,
  detail,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  detail: PatternDetail | null;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-[inset_1px_0_0_rgba(255,255,255,0.03)] z-50 overflow-y-auto font-mono">
        <div className="p-8">
          <div className="flex items-start justify-between mb-8">
            <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
              Pattern Detail
            </p>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-100 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {loading && (
            <p className="text-sm text-zinc-500">Loading…</p>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {detail && (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-medium text-zinc-100 leading-snug">
                  {detail.title}
                </h3>
                <div className="mt-3 flex items-center gap-2">
                  <SeverityBadge severity={detail.severity} />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-500">
                    {detail.category} · {detail.issue_count} issues
                  </span>
                </div>
              </div>

              <Section title="Description">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {detail.description}
                </p>
              </Section>

              {detail.reasoning && (
                <Section title="Reasoning">
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {detail.reasoning}
                  </p>
                </Section>
              )}

              {detail.suggested_actions.length > 0 && (
                <Section title="Suggested Actions">
                  <ul className="text-sm text-zinc-300 space-y-2 leading-relaxed">
                    {detail.suggested_actions.map((a, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-emerald-500 shrink-0">→</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title={`Contributing Issues (${detail.contributing_issues.length})`}>
                {detail.contributing_issues.length === 0 ? (
                  <p className="text-sm text-zinc-500">No linked issues.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.contributing_issues.map((i) => (
                      <li key={i.id}>
                        <a
                          href={i.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-3 py-2.5 border border-zinc-800 bg-black/40 hover:border-emerald-800 hover:bg-emerald-950/10 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-zinc-200 truncate">
                                #{i.github_issue_number} {i.title}
                              </div>
                              <div className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 mt-1">
                                {i.is_pull_request ? "PR" : "Issue"} · {i.state} · {(i.confidence * 100).toFixed(0)}% match
                              </div>
                            </div>
                            <span className="text-zinc-600 group-hover:text-emerald-400 text-xs">↗</span>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Metadata">
                <dl className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 space-y-1.5">
                  <div className="flex justify-between">
                    <dt>First Detected</dt>
                    <dd className="text-zinc-400">{new Date(detail.first_detected_at).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Last Detected</dt>
                    <dd className="text-zinc-400">{new Date(detail.last_detected_at).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Repo</dt>
                    <dd className="text-zinc-400">{detail.repo_full_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Status</dt>
                    <dd className="text-zinc-400">{detail.status}</dd>
                  </div>
                </dl>
              </Section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
