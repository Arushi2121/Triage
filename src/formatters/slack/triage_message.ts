import type { Issue, Classification, Draft } from "@/types/db";
import type { TriageRecommendation } from "@/types/triage";

interface DuplicateMatchMetadata {
  duplicate_of_issue_id?: string;
  duplicate_of_github_number?: number;
  duplicate_of_title?: string;
  similarity?: number;
}

function extractDuplicateMatch(
  metadata: Record<string, unknown>,
): DuplicateMatchMetadata | null {
  const number = metadata.duplicate_of_github_number;
  const title = metadata.duplicate_of_title;
  const similarity = metadata.similarity;

  // Only treat it as a real duplicate match if we have a number AND title
  if (typeof number !== "number" || typeof title !== "string") {
    return null;
  }

  return {
    duplicate_of_github_number: number,
    duplicate_of_title: title,
    similarity: typeof similarity === "number" ? similarity : undefined,
    duplicate_of_issue_id:
      typeof metadata.duplicate_of_issue_id === "string"
        ? metadata.duplicate_of_issue_id
        : undefined,
  };
}

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
  draft?: Draft | null; // Optional: draft to display with Approve/Skip buttons
}): { text: string; blocks: unknown[] } {
  const { issue, classification, recommendation, repoFullName, issueUrl, draft } =
    params;

  const emoji = EMOJI_MAP[recommendation.type] || "📥";
  const title = RECOMMENDATION_TITLES[recommendation.type] || "New Issue";
  const severityLabel = toTitleCase(classification.severity);
  const confidencePercent = Math.round(classification.confidence * 100);

  // Plain text fallback for notifications
  const text = `${emoji} ${title}: ${issue.title} in ${repoFullName}`;

  const duplicateMatch =
    recommendation.type === "flag-duplicate"
      ? extractDuplicateMatch(recommendation.metadata)
      : null;

  // Block Kit blocks
  const blocks: unknown[] = [];

  // Block 1: Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${emoji} ${title} — ${severityLabel}`,
    },
  });

  // Block 2: Issue details
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${issueUrl}|${issue.title}>*\n_by @${issue.author_github_login} in <https://github.com/${repoFullName}|${repoFullName}>_`,
    },
  });

  // Block 3: Triage recommendation
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Triage suggests:* ${recommendation.suggested_action}\n_${recommendation.reasoning}_`,
    },
  });

  // Block 3.5: Duplicate match (only when present)
  if (duplicateMatch) {
    const dupUrl = `https://github.com/${repoFullName}/issues/${duplicateMatch.duplicate_of_github_number}`;
    const similarityText =
      duplicateMatch.similarity !== undefined
        ? ` (${Math.round(duplicateMatch.similarity * 100)}% match)`
        : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔁 *Similar to:* <${dupUrl}|#${duplicateMatch.duplicate_of_github_number} — ${duplicateMatch.duplicate_of_title}>${similarityText}`,
      },
    });
  }

  // Block 3.7: Draft response (only when draft exists and is pending)
  if (draft && draft.status === "pending" && draft.content && draft.content.length > 0) {
    // Section block showing the draft content in a quoted style
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📝 Proposed response:*\n>${draft.content.split("\n").join("\n>")}`,
      },
    });

    // Actions block with Approve and Skip buttons
    blocks.push({
      type: "actions",
      block_id: `draft_actions_${draft.id}`,
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ Approve & Post",
            emoji: true,
          },
          style: "primary",
          action_id: `draft_approve_${draft.id}`,
          value: draft.id,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⊘ Skip",
            emoji: true,
          },
          action_id: `draft_skip_${draft.id}`,
          value: draft.id,
        },
      ],
    });
  }

  // Block 4: Context block with metadata
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Confidence: ${confidencePercent}% · Type: ${classification.issue_type} · Model: ${classification.llm_model}`,
      },
    ],
  });

  return { text, blocks };
}
