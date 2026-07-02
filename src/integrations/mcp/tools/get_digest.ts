import { z } from "zod";
import type { User } from "@/types/db";
import { getSupabaseClient } from "@/db/client";
import { generateDigest } from "@/core/digests/generate";

export const GetDigestInputSchema = z.object({
  repo_full_name: z.string().optional().describe("Repo to generate digest for (e.g., 'owner/repo'). Defaults to your first repo."),
  window_days: z.number().int().min(1).max(90).default(7).describe("Time window in days (1-90). Default: 7 days."),
});

export type GetDigestInput = z.infer<typeof GetDigestInputSchema>;

export interface GetDigestResult {
  repo_full_name: string;
  window_start: string;
  window_end: string;
  window_days: number;
  total_issues: number;
  issues_by_type: Record<string, number>;
  total_prs: number;
  prs_by_type: Record<string, number>;
  duplicates_caught: number;
  patterns: Array<{
    title: string;
    description: string;
    category: string;
    severity: string;
    issue_count: number;
    is_new: boolean;
  }>;
}

/**
 * Generate a digest for a user's repo over a time window.
 * Wraps Layer 9's generateDigest() and returns MCP-friendly JSON.
 */
export async function executeGetDigest(params: {
  user: User;
  input: GetDigestInput;
}): Promise<GetDigestResult> {
  const { user, input } = params;
  const supabase = getSupabaseClient();

  // Step 1: Resolve which repo (mirrors slash command logic)
  const { data: installations, error: instError } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  if (instError || !installations || installations.length === 0) {
    throw new Error("No installations found for this user. Have you installed Triage on any GitHub repos?");
  }

  const installationIds = installations.map((i) => i.id);

  let repoResult: { id: string; github_full_name: string } | null = null;

  if (input.repo_full_name) {
    // Specific repo requested
    const { data: repos, error: repoError } = await supabase
      .from("repos")
      .select("id, github_full_name")
      .eq("github_full_name", input.repo_full_name)
      .in("installation_id", installationIds)
      .is("deleted_at", null)
      .single();
    if (repoError || !repos) {
      throw new Error(`Repo '${input.repo_full_name}' not found or you don't have access.`);
    }
    repoResult = repos as { id: string; github_full_name: string };
  } else {
    // Default: first repo
    const { data: repos, error: repoError } = await supabase
      .from("repos")
      .select("id, github_full_name")
      .in("installation_id", installationIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (repoError || !repos || repos.length === 0) {
      throw new Error("No repos found. Have you installed Triage on any GitHub repos?");
    }
    repoResult = repos[0] as { id: string; github_full_name: string };
  }

  // Step 2: Compute time window
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - input.window_days * 24 * 60 * 60 * 1000).toISOString();

  // Step 3: Generate the digest
  const digest = await generateDigest({
    repoId: repoResult.id,
    windowStart,
    windowEnd,
  });

  // Step 4: Shape output for MCP
  return {
    repo_full_name: digest.repoFullName,
    window_start: digest.windowStart,
    window_end: digest.windowEnd,
    window_days: input.window_days,
    total_issues: digest.totalIssues,
    issues_by_type: digest.issuesByType,
    total_prs: digest.totalPRs,
    prs_by_type: digest.prsByType,
    duplicates_caught: digest.duplicatesCaught,
    patterns: digest.patterns.map((p) => ({
      title: p.pattern.title,
      description: p.pattern.description,
      category: p.pattern.category,
      severity: p.pattern.severity,
      issue_count: p.pattern.issue_count,
      is_new: p.isNew,
    })),
  };
}
