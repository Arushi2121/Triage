import { getSupabaseClient } from "./client";
import type { Installation, InstallationInsert } from "../types/db";

export async function getInstallationByGithubId(
  githubInstallationId: number,
): Promise<Installation | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("installations")
    .select("*")
    .eq("github_installation_id", githubInstallationId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(
      `Failed to get installation by GitHub ID: ${error.message}`,
    );
  }

  return data;
}

export async function upsertInstallation(
  data: InstallationInsert,
): Promise<Installation> {
  const supabase = getSupabaseClient();

  const { data: installation, error } = await supabase
    .from("installations")
    .upsert(data, { onConflict: "github_installation_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert installation: ${error.message}`);
  }

  return installation;
}
