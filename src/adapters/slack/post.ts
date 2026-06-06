import { WebClient } from "@slack/web-api";

import { getSlackBotToken } from "./client";

export interface PostMessageOptions {
  channel: string;
  text: string;
  threadTs?: string;
}

let webClient: WebClient | undefined;

function getWebClient(): WebClient {
  if (!webClient) {
    webClient = new WebClient(getSlackBotToken());
  }
  return webClient;
}

export async function postMessage(options: PostMessageOptions): Promise<void> {
  await getWebClient().chat.postMessage({
    channel: options.channel,
    text: options.text,
    thread_ts: options.threadTs,
  });
}
