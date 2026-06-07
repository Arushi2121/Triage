import { createHmac, timingSafeEqual } from "node:crypto";

function getWebhookSecret(): string {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Missing GITHUB_WEBHOOK_SECRET. Set it in .env.local (see .env.local.example).",
    );
  }

  return secret;
}

export function verifyGitHubSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = getWebhookSecret();

  const hmac = createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}
