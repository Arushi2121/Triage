import { WebClient } from "@slack/web-api";
import { getSlackBotToken } from "./client";

let webClient: WebClient | undefined;

function getWebClient(): WebClient {
  if (!webClient) {
    webClient = new WebClient(getSlackBotToken());
  }
  return webClient;
}

export async function updateMessageAfterApprove(params: {
  channel: string;
  messageTs: string;
  actorGithubUsername: string;
  commentUrl: string;
  wasEdited: boolean;
}): Promise<void> {
  const editedSuffix = params.wasEdited ? " with edits" : "";
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  await getWebClient().chat.update({
    channel: params.channel,
    ts: params.messageTs,
    text: `✅ Posted${editedSuffix} by @${params.actorGithubUsername} at ${timestamp}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Posted${editedSuffix}* by @${params.actorGithubUsername} at ${timestamp}\n<${params.commentUrl}|View comment on GitHub>`,
        },
      },
    ],
  });
}

export async function updateMessageAfterSkip(params: {
  channel: string;
  messageTs: string;
  actorGithubUsername: string;
}): Promise<void> {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  await getWebClient().chat.update({
    channel: params.channel,
    ts: params.messageTs,
    text: `⊘ Skipped by @${params.actorGithubUsername} at ${timestamp}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⊘ *Skipped* by @${params.actorGithubUsername} at ${timestamp}`,
        },
      },
    ],
  });
}

export async function updateMessageNeedsLinking(params: {
  channel: string;
  messageTs: string;
}): Promise<void> {
  await getWebClient().chat.update({
    channel: params.channel,
    ts: params.messageTs,
    text: `⏳ Please check your DMs to link your GitHub account first.`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⏳ *Linking required*\nCheck your DMs from Triage for instructions, then click the buttons again.`,
        },
      },
    ],
  });
}
