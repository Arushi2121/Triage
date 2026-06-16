import type { Issue, Classification } from "@/types/db";
import type { TriageRecommendation } from "@/types/triage";

const EMOJI_MAP: Record<string, string> = {
  "urgent-attention": "🚨",
  "flag-spam": "🗑️",
  "flag-duplicate": "🔁",
  "route-to-docs": "📚",
  "request-info": "❓",
  "notify-only": "📥",
};

const RECOMMENDATION_TITLES: Record<string, string> = {
  "flag-spam": "Likely Spam",
  "flag-duplicate": "Possible Duplicate",
  "urgent-attention": "Urgent Attention",
  "route-to-docs": "Documentation Issue",
  "request-info": "Needs More Info",
  "notify-only": "New Issue",
};

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function buildTriageMessage(params: {
  issue: Issue;
  classification: Classification;
  recommendation: TriageRecommendation;
  repoFullName: string;
  issueUrl: string;
}): { text: string; blocks: unknown[] } {
  const { issue, classification, recommendation, repoFullName, issueUrl } =
    params;

  const emoji = EMOJI_MAP[recommendation.type] || "📥";
  const title = RECOMMENDATION_TITLES[recommendation.type] || "New Issue";
  const severityLabel = toTitleCase(classification.severity);
  const confidencePercent = Math.round(classification.confidence * 100);

  // Plain text fallback for notifications
  const text = `${emoji} ${title}: ${issue.title} in ${repoFullName}`;

  // Block Kit blocks
  const blocks: unknown[] = [
    // Block 1: Header
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${title} — ${severityLabel}`,
      },
    },

    // Block 2: Issue details
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${issueUrl}|${issue.title}>*\n_by @${issue.author_github_login} in <https://github.com/${repoFullName}|${repoFullName}>_`,
      },
    },

    // Block 3: Triage recommendation
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Triage suggests:* ${recommendation.suggested_action}\n_${recommendation.reasoning}_`,
      },
    },

    // Block 4: Context block with metadata
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Confidence: ${confidencePercent}% · Type: ${classification.issue_type} · Model: ${classification.llm_model}`,
        },
      ],
    },
  ];

  return { text, blocks };
}
