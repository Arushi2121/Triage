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

/**
 * Insert a detected duplicate, or return the existing row if already recorded.
 * Idempotent: safe to call from event handlers that may re-process the same issue.
 */
export async function upsertDetectedDuplicate(params: {
  sourceIssueId: string;
  duplicateOfIssueId: string;
  similarityScore: number;
  confidence: number;
  detectionMethod?: string;
  rawLlmResponse?: unknown;
  reasoning?: string;
}): Promise<IssueDuplicate> {
  const supabase = getSupabaseClient();

  // Check for existing row first (avoid uniqueness violations)
  const { data: existing } = await supabase
    .from("issue_duplicates")
    .select("*")
    .eq("source_issue_id", params.sourceIssueId)
    .eq("duplicate_of_issue_id", params.duplicateOfIssueId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const defaultReasoning = `Embedding-based similarity detection: ${(params.similarityScore * 100).toFixed(1)}% similar (threshold-based auto-detection).`;

  const { data: inserted, error } = await supabase
    .from("issue_duplicates")
    .insert({
      source_issue_id: params.sourceIssueId,
      duplicate_of_issue_id: params.duplicateOfIssueId,
      similarity_score: params.similarityScore,
      confidence: params.confidence,
      detection_method: params.detectionMethod ?? "embedding-similarity",
      raw_llm_response: (params.rawLlmResponse ?? null) as IssueDuplicateInsert["raw_llm_response"],
      reasoning: params.reasoning ?? defaultReasoning,
      status: "suggested",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert detected duplicate: ${error.message}`);
  }

  return inserted;
}
