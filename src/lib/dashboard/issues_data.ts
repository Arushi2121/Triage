import { getSupabaseClient } from "@/db/client";
import type { User } from "@/types/db";
import type { IssueListItem } from "@/types/dashboard";

/**
 * List issues for the user's accessible repos.
 * Attaches latest classification type and latest draft status per issue.
 */
export async function listIssuesForUser(
  user: User,
  options: { limit?: number; offset?: number } = {},
): Promise<{ issues: IssueListItem[]; totalCount: number }> {
  const supabase = getSupabaseClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  // Resolve user's repos
  const { data: installations } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  const installationIds = (installations ?? []).map((i) => i.id);
  if (installationIds.length === 0) {
    return { issues: [], totalCount: 0 };
  }

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
  if (repoIds.length === 0) {
    return { issues: [], totalCount: 0 };
  }

  // Total count
  const { count: totalCount } = await supabase
    .from("issues")
    .select("*", { count: "exact", head: true })
    .in("repo_id", repoIds)
    .is("deleted_at", null);

  // Paginated issues
  const { data: issues, error } = await supabase
    .from("issues")
    .select(
      "id, repo_id, github_issue_number, title, is_pull_request, state, created_at",
    )
    .in("repo_id", repoIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch issues: ${error.message}`);
  }

  const issueRows = issues ?? [];
  const issueIds = issueRows.map((i) => i.id);

  // Latest classification per issue
  const latestClassificationByIssueId = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: classifications } = await supabase
      .from("classifications")
      .select("issue_id, issue_type, classified_at")
      .in("issue_id", issueIds)
      .order("classified_at", { ascending: false });

    for (const c of classifications ?? []) {
      if (!latestClassificationByIssueId.has(c.issue_id)) {
        latestClassificationByIssueId.set(c.issue_id, c.issue_type);
      }
    }
  }

  // Latest draft per issue
  const latestDraftByIssueId = new Map<string, string>();
  if (issueIds.length > 0) {
    const { data: drafts } = await supabase
      .from("drafts")
      .select("issue_id, status, created_at")
      .in("issue_id", issueIds)
      .order("created_at", { ascending: false });

    for (const d of drafts ?? []) {
      if (!latestDraftByIssueId.has(d.issue_id)) {
        latestDraftByIssueId.set(d.issue_id, d.status);
      }
    }
  }

  const result: IssueListItem[] = issueRows.map((i) => {
    const repoFullName = repoIdToFullName.get(i.repo_id) ?? "unknown";
    const urlPath = i.is_pull_request ? "pull" : "issues";
    return {
      id: i.id,
      github_issue_number: i.github_issue_number,
      title: i.title,
      is_pull_request: i.is_pull_request,
      state: i.state,
      classification_type: latestClassificationByIssueId.get(i.id) ?? null,
      draft_status: latestDraftByIssueId.get(i.id) ?? null,
      repo_full_name: repoFullName,
      github_url: `https://github.com/${repoFullName}/${urlPath}/${i.github_issue_number}`,
      created_at: i.created_at,
    };
  });

  return {
    issues: result,
    totalCount: totalCount ?? 0,
  };
}
