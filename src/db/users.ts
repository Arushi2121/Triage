import { getSupabaseClient } from "./client";
import type { User, UserInsert } from "../types/db";

export async function getUserByGithubId(
  githubId: number,
): Promise<User | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("github_id", githubId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get user by GitHub ID: ${error.message}`);
  }

  return data;
}

export async function upsertUserByGithubId(data: UserInsert): Promise<User> {
  const supabase = getSupabaseClient();

  const { data: user, error } = await supabase
    .from("users")
    .upsert(data, { onConflict: "github_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert user: ${error.message}`);
  }

  return user;
}

export async function getUserBySlackId(
  slackUserId: string,
): Promise<User | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("slack_user_id", slackUserId)
    .is("deleted_at", null)
    .single();
  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get user by Slack ID: ${error.message}`);
  }
  return data;
}

export async function linkSlackToGithubUser(
  githubUserId: number,
  slackUserId: string,
): Promise<User> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .update({ slack_user_id: slackUserId })
    .eq("github_id", githubUserId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to link Slack ID to GitHub user: ${error.message}`);
  }
  return data;
}
