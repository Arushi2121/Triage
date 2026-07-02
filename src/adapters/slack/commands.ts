import type { App } from "@slack/bolt";
import { waitUntil } from "@vercel/functions";
import { resolveSlackUser } from "@/core/auth/resolve_slack_user";
import { sendLinkingPrompt } from "./dm";
import { generateDigest } from "@/core/digests/generate";
import { buildDigestMessage } from "@/formatters/slack/digest_message";
import { getSupabaseClient } from "@/db/client";

/**
 * Parse the /triage-digest command args.
 * Handles: "", "30d", "owner/repo", "owner/repo 30d"
 */
function parseCommandArgs(text: string): {
  repoFullName: string | null;
  windowDays: number;
} {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { repoFullName: null, windowDays: 7 };
  }

  const parts = trimmed.split(/\s+/);
  let repoFullName: string | null = null;
  let windowDays = 7;

  for (const part of parts) {
    if (part.includes("/")) {
      // Looks like a repo: "owner/repo"
      repoFullName = part;
    } else {
      // Try to parse as duration: "7d", "30d", "14d"
      const durationMatch = part.match(/^(\d+)d$/);
      if (durationMatch) {
        const days = parseInt(durationMatch[1], 10);
        if (days > 0 && days <= 365) {
          windowDays = days;
        }
      }
    }
  }

  return { repoFullName, windowDays };
}

/**
 * Resolve the user's default repo (first installation, first repo).
 * Returns null if no repos exist for this user.
 */
async function resolveDefaultRepo(userId: string): Promise<{
  repoId: string;
  repoFullName: string;
} | null> {
  const supabase = getSupabaseClient();

  // Find installations owned by this user
  const { data: installations, error: instError } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (instError || !installations || installations.length === 0) {
    return null;
  }

  // Find repos for that installation
  const { data: repos, error: reposError } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .eq("installation_id", installations[0].id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (reposError || !repos || repos.length === 0) {
    return null;
  }

  return {
    repoId: repos[0].id,
    repoFullName: repos[0].github_full_name,
  };
}

/**
 * Resolve a specific repo by github_full_name.
 * Only returns repos accessible via the user's installations.
 */
async function resolveSpecificRepo(
  userId: string,
  repoFullName: string,
): Promise<{ repoId: string; repoFullName: string } | null> {
  const supabase = getSupabaseClient();

  // Find installations owned by this user
  const { data: installations, error: instError } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", userId);

  if (instError || !installations || installations.length === 0) {
    return null;
  }

  const installationIds = installations.map((i) => i.id);

  // Find repo matching full_name owned by one of these installations
  const { data: repo, error: repoError } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .eq("github_full_name", repoFullName)
    .in("installation_id", installationIds)
    .is("deleted_at", null)
    .single();

  if (repoError || !repo) {
    return null;
  }

  return {
    repoId: repo.id,
    repoFullName: repo.github_full_name,
  };
}

/**
 * Background digest generation.
 * Runs after the command handler has returned. Errors here don't affect the
 * user's Slack response — they're logged only.
 */
async function runDigestBackground(params: {
  repoId: string;
  repoFullName: string;
  windowDays: number;
  channelId: string;
  client: import("@slack/bolt").App["client"];
}): Promise<void> {
  const { repoId, repoFullName, windowDays, channelId, client } = params;
  
  try {
    // Compute time window
    const windowEnd = new Date().toISOString();
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Generate the digest (DB queries + pattern detection + LLM summarization)
    const digest = await generateDigest({
      repoId,
      windowStart,
      windowEnd,
    });

    // Format for Slack
    const { text, blocks } = buildDigestMessage(digest);

    // Post to channel
    await client.chat.postMessage({
      channel: channelId,
      text,
      blocks: blocks as never,
    });

    console.log(
      `✓ Posted digest for ${repoFullName} (${digest.totalIssues} issues, ${digest.totalPRs} PRs, ${digest.patterns.length} patterns)`,
    );
  } catch (err) {
    console.error(`Background digest failed for ${repoFullName}:`, err);
    // Post error message to channel so user knows something went wrong
    try {
      await client.chat.postMessage({
        channel: channelId,
        text: `❌ Digest generation failed for *${repoFullName}*. Check server logs for details.`,
      });
    } catch (postErr) {
      console.error("Also failed to post error message:", postErr);
    }
  }
}

export function registerSlackCommands(app: App): void {
  // /triage-digest command
  app.command("/triage-digest", async ({ ack, command, client, respond }) => {
    await ack();

    try {
      const slackUserId = command.user_id;
      const channelId = command.channel_id;
      const commandText = command.text ?? "";

      // 1. Resolve Slack user to DB user (with lazy linking)
      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "needs_linking") {
        await sendLinkingPrompt(slackUserId);
        await respond({
          response_type: "ephemeral",
          text: "👋 Please check your DMs to link your GitHub account first, then try `/triage-digest` again.",
        });
        return;
      }
      const user = resolution.user;

      // 2. Parse command args
      const { repoFullName: requestedRepoFullName, windowDays } = parseCommandArgs(commandText);

      // 3. Resolve which repo
      let repo: { repoId: string; repoFullName: string } | null;
      if (requestedRepoFullName) {
        repo = await resolveSpecificRepo(user.id, requestedRepoFullName);
        if (!repo) {
          await respond({
            response_type: "ephemeral",
            text: `❌ Repo \`${requestedRepoFullName}\` not found or you don't have access.`,
          });
          return;
        }
      } else {
        repo = await resolveDefaultRepo(user.id);
        if (!repo) {
          await respond({
            response_type: "ephemeral",
            text: "❌ No repos found. Have you installed Triage on any GitHub repos yet?",
          });
          return;
        }
      }

      // 4. Send interim ephemeral message (fast — stays within Slack's 3s window)
      await respond({
        response_type: "ephemeral",
        text: `⏳ Generating digest for *${repo.repoFullName}* (last ${windowDays} days)…`,
      });

      // 5. Kick off heavy work in the background — DO NOT await
      // This lets the handler return immediately while the digest generation
      // continues via @vercel/functions waitUntil mechanism.
      waitUntil(
        runDigestBackground({
          repoId: repo.repoId,
          repoFullName: repo.repoFullName,
          windowDays,
          channelId,
          client,
        }).catch((err) => {
          console.error("Background digest generation failed:", err);
        }),
      );

      // Handler returns here — background promise continues
    } catch (error) {
      console.error("Digest command handler failed:", error);
      try {
        await respond({
          response_type: "ephemeral",
          text: "❌ Digest generation failed. Check server logs, or try again in a moment.",
        });
      } catch (respondError) {
        console.error("Failed to send error response:", respondError);
      }
    }
  });
}
