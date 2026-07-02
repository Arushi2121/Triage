import type { App } from "@slack/bolt";
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
    .is("deleted_at", null)
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
    .eq("user_id", userId)
    .is("deleted_at", null);

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

      // 4. Compute time window
      const windowEnd = new Date().toISOString();
      const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

      // 5. Post interim message so user knows something is happening
      await respond({
        response_type: "ephemeral",
        text: `⏳ Generating digest for *${repo.repoFullName}* (last ${windowDays} days)…`,
      });

      // 6. Generate the digest (this is the heavy work — DB queries + pattern detection + LLM summarization)
      const digest = await generateDigest({
        repoId: repo.repoId,
        windowStart,
        windowEnd,
      });

      // 7. Format for Slack
      const { text, blocks } = buildDigestMessage(digest);

      // 8. Post to channel
      await client.chat.postMessage({
        channel: channelId,
        text,
        blocks: blocks as never,
      });

      console.log(
        `✓ Posted digest for ${repo.repoFullName} (${digest.totalIssues} issues, ${digest.totalPRs} PRs, ${digest.patterns.length} patterns)`,
      );
    } catch (error) {
      console.error("Digest command failed:", error);
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
