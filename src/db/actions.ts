import { getSupabaseClient } from "./client";
import type { Action, ActionInsert } from "../types/db";

export async function insertAction(data: ActionInsert): Promise<Action> {
  const supabase = getSupabaseClient();

  const { data: action, error } = await supabase
    .from("actions")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert action: ${error.message}`);
  }

  return action;
}

export async function getActionsForIssue(issueId: string): Promise<Action[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("actions")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get actions for issue: ${error.message}`);
  }

  return data || [];
}

export async function getFailedActionsForRetry(): Promise<Action[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("actions")
    .select("*")
    .in("status", ["failed", "retrying"])
    .lt("retry_count", 3)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to get failed actions for retry: ${error.message}`,
    );
  }

  return data || [];
}
