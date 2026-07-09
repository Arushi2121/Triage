import { getSupabaseClient } from "@/db/client";
import type { User } from "@/types/db";
import type { PatternListItem, PatternDetail } from "@/types/dashboard";

/**
 * List patterns for the user's accessible repos.
 * Sorted by last_detected_at descending.
 */
export async function listPatternsForUser(user: User): Promise<PatternListItem[]> {
  const supabase = getSupabaseClient();

  const { data: installations } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  const installationIds = (installations ?? []).map((i) => i.id);
  if (installationIds.length === 0) return [];

  const { data: repos } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .in("installation_id", installationIds)
    .is("deleted_at", null);

  const repoIdToFullName = new Map<string, string>();
  for (const r of repos ?? []) {
    repoIdToFullName.set(r.id, r.github_full_name);
  }
  const repoIds = Array.from(repoIdToFullName.keys());
  if (repoIds.length === 0) return [];

  const { data: patterns, error } = await supabase
    .from("patterns")
    .select(
      "id, repo_id, title, category, severity, issue_count, status, first_detected_at, last_detected_at",
    )
    .in("repo_id", repoIds)
    .order("last_detected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch patterns: ${error.message}`);
  }

  return (patterns ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    severity: p.severity,
    issue_count: p.issue_count,
    status: p.status,
    first_detected_at: p.first_detected_at,
    last_detected_at: p.last_detected_at,
    repo_full_name: repoIdToFullName.get(p.repo_id) ?? "unknown",
  }));
}

/**
 * Get a single pattern's full detail + contributing issues.
 * Returns null if the pattern isn't accessible by this user.
 */
export async function getPatternDetailForUser(
  user: User,
  patternId: string,
): Promise<PatternDetail | null> {
  const supabase = getSupabaseClient();

  // First verify user has access to this pattern
  const { data: installations } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  const installationIds = (installations ?? []).map((i) => i.id);
  if (installationIds.length === 0) return null;

  const { data: repos } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .in("installation_id", installationIds)
    .is("deleted_at", null);

  const repoIdToFullName = new Map<string, string>();
  for (const r of repos ?? []) {
    repoIdToFullName.set(r.id, r.github_full_name);
  }
  const repoIds = Array.from(repoIdToFullName.keys());
  if (repoIds.length === 0) return null;

  const { data: pattern, error: patternError } = await supabase
    .from("patterns")
    .select(
      "id, repo_id, title, description, category, severity, issue_count, status, first_detected_at, last_detected_at, reasoning, suggested_actions",
    )
    .eq("id", patternId)
    .in("repo_id", repoIds)
    .maybeSingle();

  if (patternError) {
    throw new Error(`Failed to fetch pattern: ${patternError.message}`);
  }
  if (!pattern) return null;

  // Contributing issues
  const { data: issuePatterns } = await supabase
    .from("issue_patterns")
    .select("issue_id, confidence")
    .eq("pattern_id", patternId)
    .order("confidence", { ascending: false });

  const contributingIssueIds = (issuePatterns ?? []).map((ip) => ip.issue_id);
  const confidenceByIssueId = new Map<string, number>();
  for (const ip of issuePatterns ?? []) {
    confidenceByIssueId.set(ip.issue_id, ip.confidence);
  }

  const contributingIssues: PatternDetail["contributing_issues"] = [];
  if (contributingIssueIds.length > 0) {
    const { data: issues } = await supabase
      .from("issues")
      .select("id, github_issue_number, title, state, is_pull_request, repo_id")
      .in("id", contributingIssueIds);

    for (const i of issues ?? []) {
      const repoFullName = repoIdToFullName.get(i.repo_id) ?? "unknown";
      const urlPath = i.is_pull_request ? "pull" : "issues";
      contributingIssues.push({
        id: i.id,
        github_issue_number: i.github_issue_number,
        title: i.title,
        state: i.state,
        is_pull_request: i.is_pull_request,
        github_url: `https://github.com/${repoFullName}/${urlPath}/${i.github_issue_number}`,
        confidence: confidenceByIssueId.get(i.id) ?? 0,
      });
    }
  }

  // Parse suggested_actions — it's stored as JSONB, might be array of strings or objects
  let suggestedActions: string[] = [];
  if (Array.isArray(pattern.suggested_actions)) {
    suggestedActions = pattern.suggested_actions.map((a) =>
      typeof a === "string" ? a : JSON.stringify(a),
    );
  }

  return {
    id: pattern.id,
    title: pattern.title,
    category: pattern.category,
    severity: pattern.severity,
    issue_count: pattern.issue_count,
    status: pattern.status,
    first_detected_at: pattern.first_detected_at,
    last_detected_at: pattern.last_detected_at,
    repo_full_name: repoIdToFullName.get(pattern.repo_id) ?? "unknown",
    description: pattern.description,
    reasoning: pattern.reasoning,
    suggested_actions: suggestedActions,
    contributing_issues: contributingIssues,
  };
}
