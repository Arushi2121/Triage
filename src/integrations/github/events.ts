import { postMessage } from "@/adapters/slack/post";
import { upsertUserByGithubId } from "@/db/users";
import { upsertInstallation } from "@/db/installations";
import { upsertRepo } from "@/db/repos";
import { upsertIssue, updateIssueEmbedding } from "@/db/issues";
import { insertWebhookEvent } from "@/db/webhook_events";
import { classifyIssue } from "@/integrations/llm/classify";
import { upsertClassification } from "@/db/classifications";
import { decideTriageActions } from "@/core/triage/decide";
import { buildTriageMessage } from "@/formatters/slack/triage_message";
import { embedIssueForStorage } from "@/integrations/llm/embed";

const TEMP_DEFAULT_CHANNEL = "C0B5AG6F747";

interface GitHubWebhookPayload {
  action?: string;
  installation?: {
    id: number;
  };
  repository?: {
    id: number;
    full_name: string;
    name: string;
    private: boolean;
    default_branch: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    open_issues_count: number;
    owner: {
      id: number;
      login: string;
      type: "User" | "Organization";
    };
  };
  issue?: {
    id: number;
    number: number;
    node_id: string;
    title: string;
    body: string | null;
    state: "open" | "closed";
    user: { id: number; login: string };
    author_association: string;
    labels: Array<{ name: string; color: string }>;
    assignees: Array<{ id: number; login: string }>;
    comments: number;
    reactions: {
      total_count: number;
      "+1": number;
      "-1": number;
      laugh: number;
      hooray: number;
      confused: number;
      heart: number;
      rocket: number;
      eyes: number;
    };
    pull_request?: object;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
  };
}

export async function handleGitHubEvent(
  eventType: string,
  payload: GitHubWebhookPayload,
  deliveryId: string,
): Promise<void> {
  console.log(`GitHub event received: ${eventType}`, {
    action: payload.action,
    repository: payload.repository?.full_name,
    deliveryId,
  });

  // Helper function to persist issue events and notify Slack
  async function persistAndNotifyIssueEvent(
    eventDescriptor: "New issue" | "Issue closed" | "Issue reopened" | "Issue edited",
    requireClosedAt: boolean = false,
    shouldClassify: boolean = false,
  ): Promise<void> {
    let storageFailed = false;
    let classificationFailed = false;
    let embeddingFailed = false;
    let issueId: string | null = null;
    let savedIssue: Awaited<ReturnType<typeof upsertIssue>> | null = null;
    let savedClassification: Awaited<ReturnType<typeof upsertClassification>> | null = null;
    let recommendation: import("@/types/triage").TriageRecommendation | null = null;

    try {
      // STEP 1: Validate payload has required fields
      if (!payload.installation?.id) {
        throw new Error("Missing installation.id in webhook payload");
      }
      if (!payload.repository?.id) {
        throw new Error("Missing repository.id in webhook payload");
      }
      if (!payload.repository?.full_name) {
        throw new Error("Missing repository.full_name in webhook payload");
      }
      if (!payload.repository.owner?.id) {
        throw new Error("Missing repository.owner.id in webhook payload");
      }
      if (!payload.repository.owner?.login) {
        throw new Error("Missing repository.owner.login in webhook payload");
      }
      if (!payload.repository.owner?.type) {
        throw new Error("Missing repository.owner.type in webhook payload");
      }
      if (!payload.issue?.id) {
        throw new Error("Missing issue.id in webhook payload");
      }
      if (!payload.issue?.number) {
        throw new Error("Missing issue.number in webhook payload");
      }
      if (!payload.issue?.node_id) {
        throw new Error("Missing issue.node_id in webhook payload");
      }
      if (!payload.issue?.title) {
        throw new Error("Missing issue.title in webhook payload");
      }
      if (!payload.issue?.state) {
        throw new Error("Missing issue.state in webhook payload");
      }
      if (!payload.issue?.user?.id) {
        throw new Error("Missing issue.user.id in webhook payload");
      }
      if (!payload.issue?.user?.login) {
        throw new Error("Missing issue.user.login in webhook payload");
      }
      if (!payload.issue?.author_association) {
        throw new Error(
          "Missing issue.author_association in webhook payload",
        );
      }
      if (!payload.issue?.created_at) {
        throw new Error("Missing issue.created_at in webhook payload");
      }
      if (!payload.issue?.updated_at) {
        throw new Error("Missing issue.updated_at in webhook payload");
      }
      if (requireClosedAt && !payload.issue?.closed_at) {
        throw new Error("Missing issue.closed_at in webhook payload for closed event");
      }

      // STEP 2: Upsert the user (repository owner)
      const user = await upsertUserByGithubId({
        github_id: payload.repository.owner.id,
        github_username: payload.repository.owner.login,
      });

      // STEP 3: Upsert the installation
      // TODO: Fetch github_target_type from GitHub API instead of defaulting to 'all'
      const installation = await upsertInstallation({
        user_id: user.id,
        github_installation_id: payload.installation.id,
        github_account_login: payload.repository.owner.login,
        github_account_id: payload.repository.owner.id,
        github_account_type: payload.repository.owner.type,
        github_target_type: "all",
      });

      // STEP 4: Upsert the repo
      const repo = await upsertRepo({
        installation_id: installation.id,
        github_repo_id: payload.repository.id,
        github_full_name: payload.repository.full_name,
        github_default_branch: payload.repository.default_branch || "main",
        github_private: payload.repository.private ?? false,
        star_count: payload.repository.stargazers_count ?? 0,
        issue_count_open: payload.repository.open_issues_count ?? 0,
        language_primary: payload.repository.language,
        description: payload.repository.description,
      });

      // STEP 5: Upsert the issue
      savedIssue = await upsertIssue({
        repo_id: repo.id,
        github_issue_id: payload.issue.id,
        github_issue_number: payload.issue.number,
        github_node_id: payload.issue.node_id,
        title: payload.issue.title,
        body: payload.issue.body,
        state: payload.issue.state,
        author_github_id: payload.issue.user.id,
        author_github_login: payload.issue.user.login,
        author_association: payload.issue.author_association,
        labels: payload.issue.labels ?? [],
        assignees: payload.issue.assignees ?? [],
        comments_count: payload.issue.comments ?? 0,
        reactions: payload.issue.reactions ?? {},
        is_pull_request: payload.issue.pull_request !== undefined,
        github_created_at: payload.issue.created_at,
        github_updated_at: payload.issue.updated_at,
        github_closed_at: payload.issue.closed_at,
      });
      issueId = savedIssue.id;

      // STEP 6: Insert webhook_event record (audit log)
      await insertWebhookEvent({
        installation_id: installation.id,
        repo_id: repo.id,
        issue_id: savedIssue.id,
        github_delivery_id: deliveryId,
        event_type: eventType,
        event_action: payload.action ?? null,
        payload: payload as never,
        signature_valid: true,
        processing_status: "completed",
        processed_at: new Date().toISOString(),
      });

      console.log(
        `✓ Stored issue #${payload.issue.number} from ${payload.repository.full_name}`,
      );
    } catch (error) {
      console.error("Failed to store webhook data:", error);
      storageFailed = true;
    }

    // STEP 5.5: Classify the issue (only if shouldClassify is true and storage succeeded)
    if (shouldClassify && !storageFailed && issueId !== null) {
      try {
        const result = await classifyIssue({
          issueTitle: payload.issue!.title,
          issueBody: payload.issue!.body,
          repoFullName: payload.repository!.full_name,
        });

        savedClassification = await upsertClassification({
          issue_id: issueId,
          issue_type: result.classification.issue_type,
          severity: result.classification.severity,
          confidence: result.classification.confidence,
          reasoning: result.classification.reasoning,
          suggested_labels: result.classification.suggested_labels,
          raw_llm_response: result.rawResponse as never,
          prompt_version: result.promptVersion,
          llm_model: result.model,
          llm_temperature: result.temperature,
          token_count_input: result.tokenCountInput,
          token_count_output: result.tokenCountOutput,
        });

        console.log(
          `✓ Classified issue #${payload.issue!.number} as ${result.classification.issue_type}/${result.classification.severity}`,
        );
      } catch (error) {
        console.error("Classification failed:", error);
        classificationFailed = true;
      }
    }

    // STEP 5.7: Generate and save embedding (only if storage succeeded and we have an issue)
    if (!storageFailed && savedIssue && issueId !== null) {
      try {
        const embedResult = await embedIssueForStorage({
          title: payload.issue!.title,
          body: payload.issue!.body,
        });

        await updateIssueEmbedding(issueId, embedResult.embedding, embedResult.model);

        console.log(
          `✓ Embedded issue #${payload.issue!.number} (${embedResult.embedding.length} dims)`,
        );
      } catch (error) {
        console.error("Embedding generation failed:", error);
        embeddingFailed = true;
      }
    }

    // STEP 5.6: Decide triage actions (only if we have both issue and classification)
    if (savedIssue && savedClassification) {
      try {
        recommendation = decideTriageActions({
          issue: savedIssue,
          classification: savedClassification,
        });
        console.log(
          `✓ Triage recommendation for issue #${payload.issue!.number}: ${recommendation.type} (priority: ${recommendation.priority})`,
        );
      } catch (error) {
        console.error("Triage decision failed:", error);
      }
    }

    // STEP 7: Post to Slack (always attempt, even if storage failed)
    try {
      const title = payload.issue?.title || "Untitled";
      const author = payload.issue?.user?.login || "unknown";
      const repo = payload.repository?.full_name || "unknown";

      // Path A: rich message when we have a recommendation
      if (recommendation && savedIssue && savedClassification) {
        const issueUrl = `https://github.com/${repo}/issues/${payload.issue!.number}`;
        const { text, blocks } = buildTriageMessage({
          issue: savedIssue,
          classification: savedClassification,
          recommendation,
          repoFullName: repo,
          issueUrl,
        });
        await postMessage({
          channel: TEMP_DEFAULT_CHANNEL,
          text,
          blocks,
        });
      } else {
        // Path B: plain text fallback for non-opened events OR when classification/recommendation failed
        const flagSuffix = storageFailed
          ? " (storage failed)"
          : classificationFailed
            ? " (classification skipped)"
            : "";
        const message = `${eventDescriptor}${flagSuffix}: ${title} by ${author} in ${repo}`;
        await postMessage({
          channel: TEMP_DEFAULT_CHANNEL,
          text: message,
        });
      }
    } catch (slackError) {
      console.error("Failed to post to Slack:", slackError);
    }
  }

  switch (eventType) {
    case "issues": {
      if (payload.action === "opened") {
        await persistAndNotifyIssueEvent("New issue", false, true);
      } else if (payload.action === "closed") {
        await persistAndNotifyIssueEvent("Issue closed", true);
      } else if (payload.action === "reopened") {
        await persistAndNotifyIssueEvent("Issue reopened");
      } else if (payload.action === "edited") {
        await persistAndNotifyIssueEvent("Issue edited");
      }
      break;
    }

    default: {
      console.log(`Unhandled GitHub event type: ${eventType}`);
    }
  }
}
