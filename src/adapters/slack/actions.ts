import type { App } from "@slack/bolt";
import { resolveSlackUser } from "@/core/auth/resolve_slack_user";
import { getDraftById, updateDraftStatus } from "@/db/drafts";
import { getUserByGithubUsername, linkSlackToGithubUser } from "@/db/users";
import { insertAction } from "@/db/actions";
import { getSupabaseClient } from "@/db/client";
import { postIssueComment } from "@/integrations/github/post_comment";
import {
  sendLinkingPrompt,
  sendLinkingSuccess,
  sendLinkingFailure,
} from "./dm";
import {
  updateMessageAfterApprove,
  updateMessageAfterSkip,
  updateMessageNeedsLinking,
} from "./update_message";

export function registerSlackActions(app: App): void {
  // APPROVE button handler
  app.action(/^draft_approve_/, async ({ ack, body, action }) => {
    await ack();

    try {
      const actionTyped = action as { action_id: string };
      const bodyTyped = body as {
        user: { id: string };
        channel: { id: string };
        message: { ts: string };
      };

      const draftId = actionTyped.action_id.replace("draft_approve_", "");
      const slackUserId = bodyTyped.user.id;
      const channelId = bodyTyped.channel.id;
      const messageTs = bodyTyped.message.ts;

      // 1. Resolve Slack user to DB user
      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "needs_linking") {
        await sendLinkingPrompt(slackUserId);
        await updateMessageNeedsLinking({ channel: channelId, messageTs });
        return;
      }
      const user = resolution.user;

      // 2. Get draft, verify still pending (idempotency)
      const draft = await getDraftById(draftId);
      if (!draft) {
        console.error(`Draft ${draftId} not found`);
        return;
      }
      if (draft.status !== "pending") {
        console.log(`Draft ${draftId} already ${draft.status}, skipping`);
        return;
      }

      // 3. Get issue context (needed for GitHub API)
      const supabase = getSupabaseClient();
      const { data: issueData, error: issueError } = await supabase
        .from("issues")
        .select(
          "github_issue_number, repo_id, repos!inner(github_full_name, installation_id, installations!inner(github_installation_id))",
        )
        .eq("id", draft.issue_id)
        .single();

      if (issueError || !issueData) {
        throw new Error(
          `Failed to load issue context: ${issueError?.message}`,
        );
      }

      const issueTyped = issueData as unknown as {
        github_issue_number: number;
        repo_id: string;
        repos: {
          github_full_name: string;
          installations: { github_installation_id: number };
        };
      };

      const [owner, repoName] = issueTyped.repos.github_full_name.split("/");
      const installationId = issueTyped.repos.installations.github_installation_id;

      // 4. Post comment to GitHub
      const result = await postIssueComment({
        installationId,
        owner,
        repo: repoName,
        issueNumber: issueTyped.github_issue_number,
        draftContent: draft.content,
        maintainerHandle: user.github_username,
      });

      // 5. Update draft status
      await updateDraftStatus(draftId, "posted", user.id);

      // 6. Insert action row
      await insertAction({
        user_id: user.id,
        repo_id: issueTyped.repo_id,
        issue_id: draft.issue_id,
        draft_id: draftId,
        actor_type: "user",
        action_type: "github-comment-posted",
        target_platform: "github",
        status: "completed",
        payload: {
          comment_id: result.commentId,
          comment_url: result.commentUrl,
        } as never,
      });

      // 7. Update Slack message
      await updateMessageAfterApprove({
        channel: channelId,
        messageTs,
        actorGithubUsername: user.github_username,
        commentUrl: result.commentUrl,
        wasEdited: false,
      });

      console.log(`✓ Approved + posted: draft ${draftId} → ${result.commentUrl}`);
    } catch (error) {
      console.error("Approve action failed:", error);
    }
  });

  // SKIP button handler
  app.action(/^draft_skip_/, async ({ ack, body, action }) => {
    await ack();

    try {
      const actionTyped = action as { action_id: string };
      const bodyTyped = body as {
        user: { id: string };
        channel: { id: string };
        message: { ts: string };
      };

      const draftId = actionTyped.action_id.replace("draft_skip_", "");
      const slackUserId = bodyTyped.user.id;
      const channelId = bodyTyped.channel.id;
      const messageTs = bodyTyped.message.ts;

      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "needs_linking") {
        await sendLinkingPrompt(slackUserId);
        await updateMessageNeedsLinking({ channel: channelId, messageTs });
        return;
      }
      const user = resolution.user;

      const draft = await getDraftById(draftId);
      if (!draft || draft.status !== "pending") return;

      await updateDraftStatus(draftId, "rejected", user.id);

      // Get repo_id for the action insert
      const supabase = getSupabaseClient();
      const { data: issueData } = await supabase
        .from("issues")
        .select("repo_id")
        .eq("id", draft.issue_id)
        .single();

      const repoId = issueData ? (issueData as { repo_id: string }).repo_id : draft.issue_id;

      await insertAction({
        user_id: user.id,
        repo_id: repoId,
        issue_id: draft.issue_id,
        draft_id: draftId,
        actor_type: "user",
        action_type: "slack-card-updated",
        target_platform: "slack",
        status: "completed",
        payload: { action: "skipped" } as never,
      });

      await updateMessageAfterSkip({
        channel: channelId,
        messageTs,
        actorGithubUsername: user.github_username,
      });

      console.log(`⊘ Skipped: draft ${draftId}`);
    } catch (error) {
      console.error("Skip action failed:", error);
    }
  });

  // EDIT button handler — opens a modal
  app.action(/^draft_edit_/, async ({ ack, body, action, client }) => {
    await ack();

    try {
      const actionTyped = action as { action_id: string };
      const bodyTyped = body as {
        user: { id: string };
        channel: { id: string };
        message: { ts: string };
        trigger_id: string;
      };

      const draftId = actionTyped.action_id.replace("draft_edit_", "");
      const slackUserId = bodyTyped.user.id;
      const channelId = bodyTyped.channel.id;
      const messageTs = bodyTyped.message.ts;

      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "needs_linking") {
        await sendLinkingPrompt(slackUserId);
        await updateMessageNeedsLinking({ channel: channelId, messageTs });
        return;
      }

      const draft = await getDraftById(draftId);
      if (!draft || draft.status !== "pending") return;

      // Open modal pre-filled with draft content
      // private_metadata carries draft_id + channel + messageTs for the submission handler
      const privateMetadata = JSON.stringify({ draftId, channelId, messageTs });

      await client.views.open({
        trigger_id: bodyTyped.trigger_id,
        view: {
          type: "modal",
          callback_id: "draft_edit_modal",
          private_metadata: privateMetadata,
          title: { type: "plain_text", text: "Edit & Post" },
          submit: { type: "plain_text", text: "Post" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            {
              type: "input",
              block_id: "edited_content_block",
              label: { type: "plain_text", text: "Edit the response" },
              element: {
                type: "plain_text_input",
                action_id: "edited_content_input",
                multiline: true,
                initial_value: draft.content,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error("Edit action failed:", error);
    }
  });

  // EDIT MODAL SUBMISSION handler
  app.view("draft_edit_modal", async ({ ack, body, view }) => {
    await ack();

    try {
      const privateMetadata = JSON.parse(view.private_metadata) as {
        draftId: string;
        channelId: string;
        messageTs: string;
      };

      const editedContent =
        view.state.values.edited_content_block.edited_content_input.value || "";

      const slackUserId = body.user.id;
      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "needs_linking") {
        await sendLinkingPrompt(slackUserId);
        return;
      }
      const user = resolution.user;

      const draft = await getDraftById(privateMetadata.draftId);
      if (!draft || draft.status !== "pending") return;

      // Get issue context (same as approve)
      const supabase = getSupabaseClient();
      const { data: issueData, error: issueError } = await supabase
        .from("issues")
        .select(
          "github_issue_number, repo_id, repos!inner(github_full_name, installation_id, installations!inner(github_installation_id))",
        )
        .eq("id", draft.issue_id)
        .single();

      if (issueError || !issueData)
        throw new Error("Failed to load issue context");

      const issueTyped = issueData as unknown as {
        github_issue_number: number;
        repo_id: string;
        repos: {
          github_full_name: string;
          installations: { github_installation_id: number };
        };
      };

      const [owner, repoName] = issueTyped.repos.github_full_name.split("/");
      const installationId =
        issueTyped.repos.installations.github_installation_id;

      // Post EDITED content to GitHub
      const result = await postIssueComment({
        installationId,
        owner,
        repo: repoName,
        issueNumber: issueTyped.github_issue_number,
        draftContent: editedContent,
        maintainerHandle: user.github_username,
      });

      // Update draft with edited content + status
      const supabaseClient = getSupabaseClient();
      await supabaseClient
        .from("drafts")
        .update({
          status: "edited",
          edited_content: editedContent,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", privateMetadata.draftId);

      await insertAction({
        user_id: user.id,
        repo_id: issueTyped.repo_id,
        issue_id: draft.issue_id,
        draft_id: privateMetadata.draftId,
        actor_type: "user",
        action_type: "github-comment-posted",
        target_platform: "github",
        status: "completed",
        payload: {
          comment_id: result.commentId,
          comment_url: result.commentUrl,
          edited: true,
        } as never,
      });

      await updateMessageAfterApprove({
        channel: privateMetadata.channelId,
        messageTs: privateMetadata.messageTs,
        actorGithubUsername: user.github_username,
        commentUrl: result.commentUrl,
        wasEdited: true,
      });

      console.log(
        `✓ Edited + posted: draft ${privateMetadata.draftId} → ${result.commentUrl}`,
      );
    } catch (error) {
      console.error("Edit modal submission failed:", error);
    }
  });

  // DM message handler for linking flow
  app.message(async ({ message }) => {
    try {
      const msg = message as {
        channel_type?: string;
        user?: string;
        text?: string;
        channel: string;
      };

      // Only handle DMs (channel_type === 'im') with text
      if (msg.channel_type !== "im" || !msg.user || !msg.text) return;

      const slackUserId = msg.user;
      const text = msg.text.trim();

      // Check if this user is already linked
      const resolution = await resolveSlackUser(slackUserId);
      if (resolution.status === "linked") {
        // Already linked, ignore — user can DM us for other reasons later
        return;
      }

      // Treat the message as a GitHub username
      const githubUsername = text.replace(/^@/, ""); // strip leading @ if present

      // Basic validation: GitHub usernames are alphanumeric + hyphens, 1-39 chars
      if (!/^[a-zA-Z0-9-]{1,39}$/.test(githubUsername)) {
        await sendLinkingFailure(
          slackUserId,
          "That doesn't look like a valid GitHub username",
        );
        return;
      }

      // Find the user row by github_username
      const existingUser = await getUserByGithubUsername(githubUsername);
      if (!existingUser) {
        await sendLinkingFailure(
          slackUserId,
          `No Triage user found with GitHub handle '@${githubUsername}'. Make sure you've installed Triage on a GitHub repo first.`,
        );
        return;
      }

      // Link them
      await linkSlackToGithubUser(existingUser.github_id, slackUserId);
      await sendLinkingSuccess(slackUserId, githubUsername);

      console.log(`✓ Linked Slack ${slackUserId} → GitHub @${githubUsername}`);
    } catch (error) {
      console.error("DM linking handler failed:", error);
    }
  });
}
