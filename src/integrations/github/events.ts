import { postMessage } from "@/adapters/slack/post";

const TEMP_DEFAULT_CHANNEL = "C0B5AG6F747";

interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    title?: string;
    user?: {
      login?: string;
    };
  };
  repository?: {
    full_name?: string;
  };
}

export async function handleGitHubEvent(
  eventType: string,
  payload: GitHubWebhookPayload,
): Promise<void> {
  console.log(`GitHub event received: ${eventType}`, {
    action: payload.action,
    repository: payload.repository?.full_name,
  });

  switch (eventType) {
    case "issues": {
      if (payload.action === "opened") {
        const title = payload.issue?.title || "Untitled";
        const author = payload.issue?.user?.login || "unknown";
        const repo = payload.repository?.full_name || "unknown";

        const message = `New issue: ${title} by ${author} in ${repo}`;
// LAYER-1-SHORTCUT: Posting to Slack directly here.
// Layer 5 will replace this with: classifyIssue() → dispatchTriageResult().
// See CONTEXT.md for the proper three-ring flow.
        await postMessage({
          channel: TEMP_DEFAULT_CHANNEL,
          text: message,
        });
      }
      break;
    }

    default: {
      console.log(`Unhandled GitHub event type: ${eventType}`);
    }
  }
}
