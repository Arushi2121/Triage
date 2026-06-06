import type { App } from "@slack/bolt";

import { postMessage } from "./post";

export function registerSlackEvents(app: App): void {
  app.event("app_mention", async ({ event }) => {
    await postMessage({
      channel: event.channel,
      text: "Triage online. GitHub integration coming soon.",
      threadTs: event.ts,
    });
  });
}
