import { App } from "@slack/bolt";
import { VercelReceiver } from "@vercel/slack-bolt";

import { registerSlackEvents } from "./events";
import { registerSlackActions } from "./actions";

function validateSlackEnv(): { botToken: string; signingSecret: string } {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!botToken) {
    throw new Error(
      "Missing SLACK_BOT_TOKEN. Set it in .env.local (see .env.local.example).",
    );
  }

  if (!signingSecret) {
    throw new Error(
      "Missing SLACK_SIGNING_SECRET. Set it in .env.local (see .env.local.example).",
    );
  }

  return { botToken, signingSecret };
}

let botToken: string | undefined;
let receiver: VercelReceiver | undefined;
let app: App | undefined;

function initializeSlack(): { app: App; receiver: VercelReceiver } {
  if (!app || !receiver) {
    const env = validateSlackEnv();
    botToken = env.botToken;

    receiver = new VercelReceiver({
      signingSecret: env.signingSecret,
    });

    app = new App({
      token: env.botToken,
      signingSecret: env.signingSecret,
      receiver,
      deferInitialization: true,
    });

    registerSlackEvents(app);
    registerSlackActions(app);
  }

  return { app, receiver };
}

export function getSlackBotToken(): string {
  if (!botToken) {
    botToken = validateSlackEnv().botToken;
  }
  return botToken;
}

export function getSlackApp(): App {
  return initializeSlack().app;
}

export function getSlackReceiver(): VercelReceiver {
  return initializeSlack().receiver;
}
