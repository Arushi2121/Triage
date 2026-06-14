import { getSupabaseClient } from "./client";
import type { IssueDuplicate, IssueDuplicateInsert } from "../types/db";

export async function insertDuplicateSuggestion(
  data: IssueDuplicateInsert,
): Promise<IssueDuplicate> {
  const supabase = getSupabaseClient();

  const { data: duplicate, error } = await supabase
    .from("issue_duplicates")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert duplicate suggestion: ${error.message}`);
  }

  return duplicate;
}

export async function getDuplicatesForIssue(
  issueId: string,
): Promise<IssueDuplicate[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("issue_duplicates")
    .select("*")
    .or(`source_issue_id.eq.${issueId},duplicate_of_issue_id.eq.${issueId}`)
    .order("detected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get duplicates for issue: ${error.message}`);
  }

  return data || [];
}
