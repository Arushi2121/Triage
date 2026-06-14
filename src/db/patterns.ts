import { getSupabaseClient } from "./client";
import type { Pattern, PatternInsert } from "../types/db";

export async function insertPattern(data: PatternInsert): Promise<Pattern> {
  const supabase = getSupabaseClient();

  const { data: pattern, error } = await supabase
    .from("patterns")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert pattern: ${error.message}`);
  }

  return pattern;
}

export async function getActivePatternsForRepo(
  repoId: string,
): Promise<Pattern[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .eq("repo_id", repoId)
    .eq("status", "active")
    .order("severity", { ascending: true })
    .order("last_detected_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to get active patterns for repo: ${error.message}`,
    );
  }

  return data || [];
}
