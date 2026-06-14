import { getSupabaseClient } from "./client";
import type { Digest, DigestInsert } from "../types/db";

export async function insertDigest(data: DigestInsert): Promise<Digest> {
  const supabase = getSupabaseClient();

  const { data: digest, error } = await supabase
    .from("digests")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert digest: ${error.message}`);
  }

  return digest;
}

export async function getRecentDigestsForUser(
  userId: string,
  limit: number,
): Promise<Digest[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("digests")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to get recent digests for user: ${error.message}`,
    );
  }

  return data || [];
}
