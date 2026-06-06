import { createHandler } from "@vercel/slack-bolt";

import { getSlackApp, getSlackReceiver } from "@/adapters/slack/client";

let handler: ReturnType<typeof createHandler> | undefined;

function getHandler(): ReturnType<typeof createHandler> {
  if (!handler) {
    handler = createHandler(getSlackApp(), getSlackReceiver());
  }
  return handler;
}

export async function POST(request: Request): Promise<Response> {
  return getHandler()(request);
}
