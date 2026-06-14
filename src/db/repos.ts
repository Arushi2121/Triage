import { getSupabaseClient } from "./client";
import type { Repo, RepoInsert } from "../types/db";

export async function getRepoByGithubId(
  githubRepoId: number,
): Promise<Repo | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("repos")
    .select("*")
    .eq("github_repo_id", githubRepoId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get repo by GitHub ID: ${error.message}`);
  }

  return data;
}

export async function upsertRepo(data: RepoInsert): Promise<Repo> {
  const supabase = getSupabaseClient();

  const { data: repo, error } = await supabase
    .from("repos")
    .upsert(data, { onConflict: "github_repo_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert repo: ${error.message}`);
  }

  return repo;
}

export async function getReposForUser(userId: string): Promise<Repo[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("repos")
    .select(
      `
      *,
      installations!inner (
        user_id
      )
    `,
    )
    .eq("installations.user_id", userId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to get repos for user: ${error.message}`);
  }

  return data || [];
}
