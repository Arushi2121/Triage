import { getSupabaseClient } from "./client";
import type { Draft, DraftInsert } from "../types/db";

export async function insertDraft(data: DraftInsert): Promise<Draft> {
  const supabase = getSupabaseClient();

  const { data: draft, error } = await supabase
    .from("drafts")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert draft: ${error.message}`);
  }

  return draft;
}

export async function getDraftById(id: string): Promise<Draft | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get draft by ID: ${error.message}`);
  }

  return data;
}

export async function getPendingDraftsForUser(
  userId: string,
): Promise<Draft[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("drafts")
    .select(
      `
      *,
      issues!inner (
        repo_id,
        repos!inner (
          installation_id,
          installations!inner (
            user_id
          )
        )
      )
    `,
    )
    .eq("status", "pending")
    .eq("issues.repos.installations.user_id", userId)
    .is("issues.deleted_at", null)
    .is("issues.repos.deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get pending drafts for user: ${error.message}`);
  }

  return data || [];
}

export async function updateDraftStatus(
  id: string,
  status: string,
  reviewedByUserId: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("drafts")
    .update({
      status,
      reviewed_by_user_id: reviewedByUserId,
      reviewed_at: reviewedByUserId ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update draft status: ${error.message}`);
  }
}
