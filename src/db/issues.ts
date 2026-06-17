import { getSupabaseClient } from "./client";
import type { Issue, IssueInsert } from "../types/db";

export async function getIssueByGithubId(
  githubIssueId: number,
): Promise<Issue | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("github_issue_id", githubIssueId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get issue by GitHub ID: ${error.message}`);
  }

  return data;
}

export async function upsertIssue(data: IssueInsert): Promise<Issue> {
  const supabase = getSupabaseClient();

  const { data: issue, error } = await supabase
    .from("issues")
    .upsert(data, { onConflict: "github_issue_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert issue: ${error.message}`);
  }

  return issue;
}

export async function updateIssueEmbedding(
  issueId: string,
  embedding: number[],
  model: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("issues")
    .update({
      embedding: embedding as unknown as string,
      embedding_model: model,
      embedded_at: new Date().toISOString(),
    })
    .eq("id", issueId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to update issue embedding: ${error.message}`);
  }
}

export async function getRecentIssuesForRepo(
  repoId: string,
  days: number,
): Promise<Issue[]> {
  const supabase = getSupabaseClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("repo_id", repoId)
    .is("deleted_at", null)
    .gte("github_created_at", cutoffDate.toISOString())
    .order("github_created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get recent issues for repo: ${error.message}`);
  }

  return data || [];
}
