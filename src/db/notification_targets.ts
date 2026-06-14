import { getSupabaseClient } from "./client";
import type {
  NotificationTarget,
  NotificationTargetInsert,
  NotificationTargetUpdate,
} from "../types/db";

export async function getNotificationTargetForRepo(
  userId: string,
  repoId: string,
  platform: string,
): Promise<NotificationTarget | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("notification_targets")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`repo_id.eq.${repoId},repo_id.is.null`)
    .order("repo_id", { nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get notification target for repo: ${error.message}`,
    );
  }

  return data;
}

export async function insertNotificationTarget(
  data: NotificationTargetInsert,
): Promise<NotificationTarget> {
  const supabase = getSupabaseClient();

  const { data: target, error } = await supabase
    .from("notification_targets")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert notification target: ${error.message}`);
  }

  return target;
}

export async function updateNotificationTarget(
  id: string,
  data: NotificationTargetUpdate,
): Promise<NotificationTarget> {
  const supabase = getSupabaseClient();

  const { data: target, error } = await supabase
    .from("notification_targets")
    .update(data)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update notification target: ${error.message}`);
  }

  return target;
}
