import { getSupabaseClient } from "./client";
import type { Classification, ClassificationInsert } from "../types/db";

export async function upsertClassification(
  data: ClassificationInsert,
): Promise<Classification> {
  const supabase = getSupabaseClient();

  const { data: classification, error } = await supabase
    .from("classifications")
    .upsert(data, { onConflict: "issue_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert classification: ${error.message}`);
  }

  return classification;
}

export async function getClassificationForIssue(
  issueId: string,
): Promise<Classification | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("classifications")
    .select("*")
    .eq("issue_id", issueId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(
      `Failed to get classification for issue: ${error.message}`,
    );
  }

  return data;
}
