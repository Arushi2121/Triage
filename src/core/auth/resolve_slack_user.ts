import type { User } from "@/types/db";
import { getUserBySlackId } from "@/db/users";

/**
 * Result type for Slack user resolution.
 * Future auth strategies will return the same type so callers don't change.
 */
export type SlackUserResolution =
  | { status: "linked"; user: User }
  | { status: "needs_linking"; slackUserId: string };

/**
 * Resolve a Slack user ID to a DB user.
 *
 * Current implementation (v1): Direct DB lookup by slack_user_id column.
 * Future implementations may add: OAuth token validation, workspace context,
 * multi-account resolution, etc. Callers don't need to know — they get a
 * uniform { status: 'linked' | 'needs_linking' } result.
 *
 * @param slackUserId - The Slack user ID from an interactivity payload (e.g., 'U01ABC123')
 * @returns Resolution result indicating linked user or needs-linking state
 */
export async function resolveSlackUser(
  slackUserId: string,
): Promise<SlackUserResolution> {
  const user = await getUserBySlackId(slackUserId);
  if (user) {
    return { status: "linked", user };
  }
  return { status: "needs_linking", slackUserId };
}

/**
 * Send the linking prompt DM to a Slack user.
 *
 * Block E uses this when resolveSlackUser returns 'needs_linking'.
 * Defined here for cohesion — all "what to do when not linked" logic lives in one module.
 *
 * NOTE: This is a placeholder. Block E provides the actual implementation by passing
 * a sendDM callback. We keep this here as a typed contract.
 */
export interface SlackDMSender {
  sendLinkingPrompt(slackUserId: string): Promise<void>;
}
