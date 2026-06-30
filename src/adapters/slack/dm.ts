import { WebClient } from "@slack/web-api";
import { getSlackBotToken } from "./client";

let webClient: WebClient | undefined;

function getWebClient(): WebClient {
  if (!webClient) {
    webClient = new WebClient(getSlackBotToken());
  }
  return webClient;
}

export async function sendLinkingPrompt(slackUserId: string): Promise<void> {
  await getWebClient().chat.postMessage({
    channel: slackUserId,
    text: "Hi! To use Triage's interactive buttons, I need to link your Slack identity to your GitHub account. Please reply to this DM with your GitHub username (no @ symbol). For example: arushi2121",
  });
}

export async function sendLinkingSuccess(
  slackUserId: string,
  githubUsername: string,
): Promise<void> {
  await getWebClient().chat.postMessage({
    channel: slackUserId,
    text: `✓ Linked to GitHub @${githubUsername}. You can now use Triage's interactive buttons. Click again on any pending Slack message.`,
  });
}

export async function sendLinkingFailure(
  slackUserId: string,
  reason: string,
): Promise<void> {
  await getWebClient().chat.postMessage({
    channel: slackUserId,
    text: `❌ Linking failed: ${reason}. Please reply with a valid GitHub username.`,
  });
}
