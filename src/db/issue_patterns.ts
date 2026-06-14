import { getSupabaseClient } from "./client";
import type { IssuePattern } from "../types/db";

export async function addIssueToPattern(
  patternId: string,
  issueId: string,
  confidence: number,
  addedMethod: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("issue_patterns").insert({
    pattern_id: patternId,
    issue_id: issueId,
    confidence,
    added_method: addedMethod,
  });

  if (error) {
    throw new Error(`Failed to add issue to pattern: ${error.message}`);
  }
}

export async function getIssuesForPattern(
  patternId: string,
): Promise<IssuePattern[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("issue_patterns")
    .select("*")
    .eq("pattern_id", patternId)
    .order("added_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get issues for pattern: ${error.message}`);
  }

  return data || [];
}
