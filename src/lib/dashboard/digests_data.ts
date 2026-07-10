import { getSupabaseClient } from "@/db/client";
import type { User } from "@/types/db";
import type {
  DigestListItem,
  DigestDetail,
  DigestSection,
} from "@/types/dashboard";

/**
 * Extract summary numbers from a digest's metrics jsonb.
 * Falls back to 0 if fields missing.
 */
function summarizeMetrics(metrics: unknown): {
  total_issues: number;
  total_prs: number;
  patterns_count: number;
} {
  const m = (metrics ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" ? v : 0);
  return {
    total_issues: num(m.total_issues ?? m.totalIssues ?? m.issues_total),
    total_prs: num(m.total_prs ?? m.totalPRs ?? m.prs_total),
    patterns_count: num(m.patterns_count ?? m.patternsCount ?? m.patterns),
  };
}

/**
 * List digests for the user, most recent first.
 */
export async function listDigestsForUser(
  user: User,
  limit = 20,
): Promise<DigestListItem[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("digests")
    .select(
      "id, title, period_start, period_end, period_type, generated_at, summary, metrics",
    )
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch digests: ${error.message}`);
  }

  return (data ?? []).map((d) => {
    const summarized = summarizeMetrics(d.metrics);
    return {
      id: d.id,
      title: d.title,
      period_start: d.period_start,
      period_end: d.period_end,
      period_type: d.period_type,
      generated_at: d.generated_at,
      summary: d.summary,
      ...summarized,
    };
  });
}

/**
 * Fetch the most recent digest for a user, or null.
 */
export async function getLatestDigestForUser(
  user: User,
): Promise<DigestListItem | null> {
  const digests = await listDigestsForUser(user, 1);
  return digests.length > 0 ? digests[0] : null;
}

/**
 * Fetch full detail for a specific digest, scoped to the user.
 */
export async function getDigestDetailForUser(
  user: User,
  digestId: string,
): Promise<DigestDetail | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("digests")
    .select(
      "id, title, period_start, period_end, period_type, generated_at, summary, sections, metrics, status",
    )
    .eq("id", digestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch digest detail: ${error.message}`);
  }
  if (!data) return null;

  // Parse sections defensively — jsonb might be array, object, or malformed
  let sections: DigestSection[] = [];
  if (Array.isArray(data.sections)) {
    sections = data.sections as DigestSection[];
  }

  // Metrics is a flexible key-value map
  const metrics = (data.metrics ?? {}) as Record<string, number | string>;
  const summarized = summarizeMetrics(data.metrics);

  return {
    id: data.id,
    title: data.title,
    period_start: data.period_start,
    period_end: data.period_end,
    period_type: data.period_type,
    generated_at: data.generated_at,
    summary: data.summary,
    sections,
    metrics,
    status: data.status,
    ...summarized,
  };
}
