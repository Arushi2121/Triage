import { z } from "zod";
import type { User } from "@/types/db";
import { getSupabaseClient } from "@/db/client";
import { embedIssueForStorage } from "@/integrations/llm/embed";

export const SearchSimilarIssuesInputSchema = z.object({
  query: z.string().min(3).describe("Natural language query to search for similar issues"),
  repo_full_name: z.string().optional().describe("Filter to a specific repo (e.g., 'owner/repo'). Omit for all your repos."),
  limit: z.number().int().min(1).max(20).default(5).describe("Max results to return"),
  min_similarity: z.number().min(0).max(1).default(0.6).describe("Minimum similarity score (0-1) to include a result"),
});

export type SearchSimilarIssuesInput = z.infer<typeof SearchSimilarIssuesInputSchema>;

export interface SearchResult {
  github_issue_number: number;
  title: string;
  body_excerpt: string;
  similarity: number;
  classification_type: string | null;
  is_pull_request: boolean;
  repo_full_name: string;
  github_url: string;
  created_at: string;
}

/**
 * Search for issues similar to a natural language query.
 * Embeds the query via Gemini, runs pgvector cosine similarity search
 * across the user's accessible issues.
 */
export async function executeSearchSimilarIssues(params: {
  user: User;
  input: SearchSimilarIssuesInput;
}): Promise<SearchResult[]> {
  const { user, input } = params;
  const supabase = getSupabaseClient();

  // Step 1: Find user's accessible repos
  const { data: installations, error: instError } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  if (instError || !installations || installations.length === 0) {
    return [];
  }

  const installationIds = installations.map((i) => i.id);

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

  const repoIdToFullName = new Map<string, string>();
  for (const r of repos) {
    repoIdToFullName.set(r.id, r.github_full_name);
  }

  // Step 2: Embed the query text via Gemini (same model + type as issue storage)
  const embedResult = await embedIssueForStorage({
    title: input.query,
    body: null,
  });
  const queryEmbedding = embedResult.embedding;

  // Step 3: pgvector cosine similarity search
  // Uses the <=> operator (cosine distance). Similarity = 1 - distance.
  // pgvector's IVFFlat index on issues.embedding accelerates this.
  // Format embedding as pgvector literal: '[0.1,0.2,...]'
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  // Use raw SQL via Supabase RPC would be cleaner, but for portability
  // use the JS client with computed similarity column.
  const repoIds = Array.from(repoIdToFullName.keys());

  const { data: issues, error: issuesError } = await supabase
    .rpc("search_issues_by_similarity", {
      query_embedding: embeddingLiteral,
      repo_ids: repoIds,
      match_limit: input.limit,
      min_sim: input.min_similarity,
    });

  if (issuesError) {
    throw new Error(`Similarity search failed: ${issuesError.message}`);
  }

  if (!issues || issues.length === 0) {
    return [];
  }

  // The RPC returns: id, github_issue_number, title, body, is_pull_request, repo_id, created_at, similarity
  // Now attach classification_type (separate query — join in RPC was getting complex)
  type IssueRow = {
    id: string;
    github_issue_number: number;
    title: string;
    body: string | null;
    is_pull_request: boolean;
    repo_id: string;
    created_at: string;
    similarity: number;
  };
  const rows = issues as IssueRow[];
  const issueIds = rows.map((r) => r.id);

  const classificationByIssueId = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: classificationsRaw } = await supabase
      .from("classifications")
      .select("issue_id, issue_type, created_at")
      .in("issue_id", issueIds)
      .not("issue_type", "is", null)
      .order("created_at", { ascending: false });
    if (classificationsRaw) {
      for (const c of classificationsRaw) {
        const typed = c as { issue_id: string; issue_type: string };
        if (!classificationByIssueId.has(typed.issue_id)) {
          classificationByIssueId.set(typed.issue_id, typed.issue_type);
        }
      }
    }
  }

  return rows.map((r) => {
    const repoFullName = repoIdToFullName.get(r.repo_id) ?? "unknown";
    const urlPath = r.is_pull_request ? "pull" : "issues";
    return {
      github_issue_number: r.github_issue_number,
      title: r.title,
      body_excerpt: (r.body ?? "").substring(0, 200),
      similarity: r.similarity,
      classification_type: classificationByIssueId.get(r.id) ?? null,
      is_pull_request: r.is_pull_request,
      repo_full_name: repoFullName,
      github_url: `https://github.com/${repoFullName}/${urlPath}/${r.github_issue_number}`,
      created_at: r.created_at,
    };
  });
}
