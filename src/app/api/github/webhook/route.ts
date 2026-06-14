import { NextRequest, NextResponse } from "next/server";

import { handleGitHubEvent } from "@/integrations/github/events";
import { verifyGitHubSignature } from "@/integrations/github/verify";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const eventType = request.headers.get("x-github-event");
    const deliveryId = request.headers.get("x-github-delivery");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-hub-signature-256 header" },
        { status: 401 },
      );
    }

    if (!eventType) {
      return NextResponse.json(
        { error: "Missing x-github-event header" },
        { status: 400 },
      );
    }

    if (!deliveryId) {
      return NextResponse.json(
        { error: "Missing x-github-delivery header" },
        { status: 400 },
      );
    }

    const isValid = verifyGitHubSignature(rawBody, signature);

    if (!isValid) {
      console.error("GitHub webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const payload = JSON.parse(rawBody);

    await handleGitHubEvent(eventType, payload, deliveryId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error handling GitHub webhook:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
