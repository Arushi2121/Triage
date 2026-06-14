import { getSupabaseClient } from "./client";
import type { WebhookEvent, WebhookEventInsert } from "../types/db";

export async function insertWebhookEvent(
  data: WebhookEventInsert,
): Promise<WebhookEvent> {
  const supabase = getSupabaseClient();

  const { data: event, error } = await supabase
    .from("webhook_events")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert webhook event: ${error.message}`);
  }

  return event;
}

export async function markEventProcessed(
  id: string,
  status: string,
  errorMessage: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("webhook_events")
    .update({
      processing_status: status,
      processing_error: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark event as processed: ${error.message}`);
  }
}

export async function getUnprocessedEvents(): Promise<WebhookEvent[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .in("processing_status", ["received", "processing"])
    .order("received_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get unprocessed events: ${error.message}`);
  }

  return data || [];
}
