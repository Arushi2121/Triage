import type { Issue } from "@/types/db";
import type { DetectedPattern as PatternDetectionResult } from "@/core/patterns/detect";
import { detectPatterns } from "@/core/patterns/detect";
import { getSupabaseClient } from "@/db/client";
import { insertDigest } from "@/db/digests";

export interface IssueTypeCounts {
  [type: string]: number;
}

export interface DigestData {
  repoId: string;
  repoFullName: string;
  windowStart: string;
  windowEnd: string;
  totalIssues: number;
  issuesByType: IssueTypeCounts;
  totalPRs: number;
  prsByType: IssueTypeCounts;
  patterns: PatternDetectionResult[];
  duplicatesCaught: number;
  digestId: string;  // The persisted digests row ID
}

/**
 * Generate a digest for a repo over a time window.
 * Retroactively detects patterns, counts issues/PRs by type, persists digest row.
 *
 * @param params.repoId - Internal repo UUID
 * @param params.windowStart - ISO 8601 timestamp — inclusive lower bound (created_at >= this)
 * @param params.windowEnd - ISO 8601 timestamp — exclusive upper bound (created_at < this)
 * @returns Structured digest data ready for formatter
 */
export async function generateDigest(params: {
  repoId: string;
  windowStart: string;
  windowEnd: string;
}): Promise<DigestData> {
  const { repoId, windowStart, windowEnd } = params;
  const supabase = getSupabaseClient();

  // Fetch the repo record with installation info to get user_id
  const { data: repoRow, error: repoError } = await supabase
    .from("repos")
    .select("id, github_full_name, installations!inner(user_id)")
    .eq("id", repoId)
    .single();
  if (repoError || !repoRow) {
    throw new Error(`Failed to load repo ${repoId}: ${repoError?.message ?? "not found"}`);
  }
  
  type RepoWithInstallation = {
    id: string;
    github_full_name: string;
    installations: { user_id: string };
  };
  const repo = repoRow as unknown as RepoWithInstallation;
  const repoFullName = repo.github_full_name;
  const userId = repo.installations.user_id;

  // Fetch issues in window
  const { data: issuesRaw, error: issuesError } = await supabase
    .from("issues")
    .select("id, title, body, is_pull_request, embedding, created_at")
    .eq("repo_id", repoId)
    .gte("created_at", windowStart)
    .lt("created_at", windowEnd)
    .is("deleted_at", null);
  if (issuesError) {
    throw new Error(`Failed to load issues: ${issuesError.message}`);
  }
  const issues = (issuesRaw ?? []) as unknown as Issue[];

  // Fetch classifications for these issues separately
  // (Supabase auto-join was failing silently; fetching separately is more reliable)
  const issueIds = issues.map((i) => i.id);
  const classificationByIssueId = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: classificationsRaw, error: classError } = await supabase
      .from("classifications")
      .select("issue_id, issue_type, created_at")
      .in("issue_id", issueIds)
      .not("issue_type", "is", null)
      .order("created_at", { ascending: false });
    if (classError) {
      console.error("Failed to load classifications:", classError);
    } else if (classificationsRaw) {
      // If multiple classifications per issue, take the most recent (first after DESC sort)
      for (const c of classificationsRaw) {
        const typed = c as { issue_id: string; issue_type: string };
        if (!classificationByIssueId.has(typed.issue_id)) {
          classificationByIssueId.set(typed.issue_id, typed.issue_type);
        }
      }
    }
  }

  // Split into issues vs PRs, count by type
  const issuesOnly = issues.filter((i) => !i.is_pull_request);
  const prsOnly = issues.filter((i) => i.is_pull_request);

  const issuesByType: IssueTypeCounts = {};
  for (const i of issuesOnly) {
    const type = classificationByIssueId.get(i.id) ?? "unclassified";
    issuesByType[type] = (issuesByType[type] ?? 0) + 1;
  }

  const prsByType: IssueTypeCounts = {};
  for (const p of prsOnly) {
    const type = classificationByIssueId.get(p.id) ?? "unclassified";
    prsByType[type] = (prsByType[type] ?? 0) + 1;
  }

  // Pattern detection: cluster all issues in window that have embeddings
  function parseVectorField(raw: unknown): number[] | null {
    if (raw === null || raw === undefined) return null;
    if (Array.isArray(raw)) return raw as number[];  // future-proof: if Supabase changes format
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
          return parsed as number[];
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  const issuesWithEmbeddings = issues
    .map((i) => ({ issue: i, embedding: parseVectorField(i.embedding) }))
    .filter((x): x is { issue: Issue; embedding: number[] } => x.embedding !== null);

  let patterns: PatternDetectionResult[] = [];
  if (issuesWithEmbeddings.length >= 3) {
    try {
      patterns = await detectPatterns({
        repoId,
        issuesWithEmbeddings,
        repoFullName,
      });
    } catch (err) {
      console.error("Pattern detection failed in digest:", err);
      // Continue with empty patterns; digest still useful
    }
  }

  // Duplicates caught: count of issue_duplicates rows for issues in window
  let duplicatesCaught = 0;
  if (issueIds.length > 0) {
    const { count, error: dupError } = await supabase
      .from("issue_duplicates")
      .select("*", { count: "exact", head: true })
      .in("source_issue_id", issueIds);
    if (dupError) {
      console.error("Duplicate count query failed:", dupError);
    } else {
      duplicatesCaught = count ?? 0;
    }
  }

  // Persist the digest row for audit trail
  const title = `${repoFullName} Digest`;
  const summary = `${issuesOnly.length} issues, ${prsOnly.length} PRs, ${patterns.length} patterns detected`;
  
  const digest = await insertDigest({
    user_id: userId,
    period_start: windowStart,
    period_end: windowEnd,
    period_type: "ad-hoc",
    title,
    summary,
    sections: {
      issuesByType,
      prsByType,
      patterns: patterns.map((p) => ({
        id: p.pattern.id,
        title: p.pattern.title,
        category: p.pattern.category,
        severity: p.pattern.severity,
        isNew: p.isNew,
        issueCount: p.matchedIssues.length,
      })),
    } as never,
    metrics: {
      total_issues: issuesOnly.length,
      total_prs: prsOnly.length,
      pattern_count: patterns.length,
      duplicates_caught: duplicatesCaught,
    } as never,
    included_repo_ids: [repoId] as never,
    raw_llm_response: {} as never,
    llm_model: "n/a",
    llm_temperature: 0,
    token_count_input: 0,
    token_count_output: 0,
    prompt_version: "v1",
  });

  return {
    repoId,
    repoFullName,
    windowStart,
    windowEnd,
    totalIssues: issuesOnly.length,
    issuesByType,
    totalPRs: prsOnly.length,
    prsByType,
    patterns,
    duplicatesCaught,
    digestId: digest.id,
  };
}
