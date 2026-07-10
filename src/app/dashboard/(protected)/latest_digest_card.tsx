"use client";

import { useState } from "react";
import type {
  DigestListItem,
  DigestDetail,
} from "@/types/dashboard";

export function LatestDigestCard({
  latest,
}: {
  latest: DigestListItem | null;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DigestListItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedDigestId, setSelectedDigestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DigestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    if (history === null) {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/dashboard/digests");
        if (res.ok) {
          const data = await res.json();
          setHistory(data.digests);
        }
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function openDetail(digestId: string) {
    setSelectedDigestId(digestId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/digests/${digestId}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.digest);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function closeAll() {
    setHistoryOpen(false);
    setSelectedDigestId(null);
    setDetail(null);
  }

  if (!latest) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6 mb-10">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-block w-6 h-px bg-emerald-500"></span>
          <h2 className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            Latest Digest
          </h2>
        </div>
        <p className="text-sm text-zinc-500">
          No digests generated yet. Run <code className="text-zinc-300">/triage-digest</code> in Slack to create one.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] mb-10">
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block w-6 h-px bg-emerald-500"></span>
            <h2 className="text-xs tracking-[0.2em] uppercase text-zinc-400">
              Latest Digest
            </h2>
          </div>
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600">
            {formatDate(latest.generated_at)}
          </span>
        </div>

        <div className="px-6 py-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-2">
            {formatRange(latest.period_start, latest.period_end)} · {latest.period_type}
          </p>
          <h3 className="text-base text-zinc-100 mb-3">
            {latest.title}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
            {latest.summary}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-6">
            <MetricInline label="Issues" value={latest.total_issues} />
            <MetricInline label="PRs" value={latest.total_prs} />
            <MetricInline label="Patterns" value={latest.patterns_count} />
          </div>
        </div>

        <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => openDetail(latest.id)}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            View Full Digest →
          </button>
          <button
            onClick={openHistory}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            View History
          </button>
        </div>
      </div>

      {(historyOpen || selectedDigestId) && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={closeAll}
            aria-hidden
          />
          <aside className="fixed top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-[inset_1px_0_0_rgba(255,255,255,0.03)] z-50 overflow-y-auto font-mono">
            <div className="p-8">
              <div className="flex items-start justify-between mb-8">
                <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
                  {selectedDigestId ? "Digest Detail" : "Digest History"}
                </p>
                <button
                  onClick={closeAll}
                  className="text-zinc-500 hover:text-zinc-100 text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {selectedDigestId ? (
                <DetailView loading={detailLoading} detail={detail} onBack={() => { setSelectedDigestId(null); setDetail(null); if (!history) openHistory(); }} />
              ) : (
                <HistoryList loading={historyLoading} history={history} onSelect={openDetail} />
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function MetricInline({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg text-zinc-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function HistoryList({
  loading,
  history,
  onSelect,
}: {
  loading: boolean;
  history: DigestListItem[] | null;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (!history || history.length === 0) {
    return <p className="text-sm text-zinc-500">No digests yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {history.map((d) => (
        <li key={d.id}>
          <button
            onClick={() => onSelect(d.id)}
            className="w-full text-left block px-4 py-3 border border-zinc-800 bg-black/40 hover:border-emerald-800 hover:bg-emerald-950/10 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">
                  {d.title}
                </div>
                <div className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 mt-1">
                  {formatRange(d.period_start, d.period_end)} · {d.period_type}
                </div>
              </div>
              <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 shrink-0">
                {formatDate(d.generated_at)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DetailView({
  loading,
  detail,
  onBack,
}: {
  loading: boolean;
  detail: DigestDetail | null;
  onBack: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (!detail) {
    return <p className="text-sm text-zinc-500">Digest not found.</p>;
  }
  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        ← Back to History
      </button>

      <div>
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-2">
          {formatRange(detail.period_start, detail.period_end)} · {detail.period_type}
        </p>
        <h3 className="text-base text-zinc-100 leading-snug">
          {detail.title}
        </h3>
      </div>

      <Section title="Summary">
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {detail.summary}
        </p>
      </Section>

      {detail.sections.length > 0 && (
        <Section title="Sections">
          <div className="space-y-6">
            {detail.sections.map((sec, idx) => (
              <div key={idx}>
                <p className="text-xs text-zinc-300 mb-2">{sec.heading}</p>
                {sec.body && (
                  <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {sec.body}
                  </p>
                )}
                {sec.items && sec.items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {sec.items.map((it, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex justify-between">
                        <span>{it.label}</span>
                        {it.value !== undefined && (
                          <span className="text-zinc-500">{String(it.value)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Metadata">
        <dl className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 space-y-1.5">
          <div className="flex justify-between">
            <dt>Generated</dt>
            <dd className="text-zinc-400">{new Date(detail.generated_at).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Status</dt>
            <dd className="text-zinc-400">{detail.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Period Type</dt>
            <dd className="text-zinc-400">{detail.period_type}</dd>
          </div>
        </dl>
      </Section>
    </div>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startStr} — ${endStr}`;
}
