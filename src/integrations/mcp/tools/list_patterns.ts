import { z } from "zod";
import type { User, Pattern } from "@/types/db";
import { getSupabaseClient } from "@/db/client";

export const ListPatternsInputSchema = z.object({
  repo_full_name: z.string().optional().describe("Filter to a specific repo (e.g., 'owner/repo'). Omit for all your repos."),
  severity: z.enum(["critical", "high", "medium", "low"]).optional().describe("Filter by pattern severity"),
  category: z
    .enum([
      "performance",
      "documentation",
      "usability",
      "compatibility",
      "feature-request",
      "bug-cluster",
      "workflow-friction",
      "other",
    ])
    .optional()
    .describe("Filter by pattern category"),
  limit: z.number().int().min(1).max(50).default(20).describe("Max results to return"),
});

export type ListPatternsInput = z.infer<typeof ListPatternsInputSchema>;

export interface PatternResult {
  title: string;
  description: string;
  category: string;
  severity: string;
  issue_count: number;
  status: string;
  first_detected_at: string;
  last_detected_at: string;
  repo_full_name: string;
}

/**
 * List patterns detected across the user's accessible repos.
 * Only returns patterns from repos owned by this user's installations.
 */
export async function executeListPatterns(params: {
  user: User;
  input: ListPatternsInput;
}): Promise<PatternResult[]> {
  const { user, input } = params;
  const supabase = getSupabaseClient();

  // Step 1: Find all installations owned by this user
  const { data: installations, error: instError } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  if (instError || !installations || installations.length === 0) {
    return [];
  }

  const installationIds = installations.map((i) => i.id);

  // Step 2: Find repos for those installations
  // If repo_full_name provided, filter further
  let reposQuery = supabase
    .from("repos")
    .select("id, github_full_name")
    .in("installation_id", installationIds)
    .is("deleted_at", null);

  if (input.repo_full_name) {
    reposQuery = reposQuery.eq("github_full_name", input.repo_full_name);
  }

  const { data: repos, error: reposError } = await reposQuery;
  if (reposError || !repos || repos.length === 0) {
    return [];
  }

  // Build repo_id -> full_name map for join later
  const repoIdToFullName = new Map<string, string>();
  for (const r of repos) {
    repoIdToFullName.set(r.id, r.github_full_name);
  }

  // Step 3: Query patterns for those repos with optional filters
  let patternsQuery = supabase
    .from("patterns")
    .select("*")
    .in("repo_id", Array.from(repoIdToFullName.keys()))
    .order("last_detected_at", { ascending: false })
    .limit(input.limit);

  if (input.severity) {
    patternsQuery = patternsQuery.eq("severity", input.severity);
  }
  if (input.category) {
    patternsQuery = patternsQuery.eq("category", input.category);
  }

  const { data: patterns, error: patternsError } = await patternsQuery;
  if (patternsError) {
    throw new Error(`Failed to query patterns: ${patternsError.message}`);
  }

  const rows = (patterns ?? []) as Pattern[];

  return rows.map((p) => ({
    title: p.title,
    description: p.description,
    category: p.category,
    severity: p.severity,
    issue_count: p.issue_count,
    status: p.status,
    first_detected_at: p.first_detected_at,
    last_detected_at: p.last_detected_at,
    repo_full_name: repoIdToFullName.get(p.repo_id) ?? "unknown",
  }));
}
