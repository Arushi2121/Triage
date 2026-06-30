import { z } from "zod";

export const PRDraftOutputSchema = z.object({
  draft_content: z
    .string()
    .min(20)
    .describe("The actual comment text. Should sound like a real maintainer wrote it: concise, direct, respectful. No corporate language, no AI-speak."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence the draft is appropriate, 0 to 1."),
  reasoning: z
    .string()
    .min(10)
    .describe("1-2 sentence explanation of why this draft fits the situation."),
});

export type PRDraftOutput = z.infer<typeof PRDraftOutputSchema>;

export const PROMPT_VERSION = "v1";

export function buildDraftPRPrompt(params: {
  prTitle: string;
  prBody: string | null;
  repoFullName: string;
  prAuthor: string;
  classificationType: string;
  classificationRisk: string;
  classificationReasoning: string;
  recommendationType: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  duplicateContext?: { number: number; title: string };
}): string {
  const {
    prTitle,
    prBody,
    repoFullName,
    prAuthor,
    classificationType,
    classificationRisk,
    classificationReasoning,
    recommendationType,
    additions,
    deletions,
    changedFiles,
    duplicateContext,
  } = params;

  const sizeContext = `${changedFiles} files changed, +${additions}/-${deletions} lines`;

  let prompt = `You are drafting a response on behalf of an open-source maintainer to a Pull Request submitted by a contributor.

Guidelines for tone:
- Sound like a real human maintainer reviewing a contribution
- Be concise — target 1-3 sentences
- Be respectful and appreciative of the contributor's effort
- Address the PR author by their GitHub handle (@${prAuthor}) when natural

Forbidden phrases — never use these or variants:
- "Please let us know if you have further questions"
- "Thanks for reaching out"
- "We appreciate your contribution to our project"
- "Please feel free to..."
- "We'll merge this soon" or specific timeline promises
- "Once we have time to review"

Forbidden structural patterns:
- No exclamation points
- No emoji
- No section headers in short responses
- No closing salutation

Honesty about specificity:
- Don't invent specific reviewer names or maintainer commitments
- If recommending review of a specific area, name the area generically ("the auth changes") not specifically ("the changes to UserAuthMiddleware.ts")
- Don't promise CI will pass or that the change is "perfect"

Good examples of tone:
- "Thanks @user. Will merge after CI passes."
- "Looks good overall. Could you walk through the rationale for the new caching layer?"
- "Closing — this conflicts with the approach we settled on in #234. Happy to discuss alternatives."
- "Noted, thanks."

Bad examples (DO NOT produce):
- "Hi @user, thank you so much for this amazing contribution!"
- "We really appreciate the time you took to put this together!"
- "Please don't hesitate to reach out if you have any questions!"

CONTEXT:
- Repository: ${repoFullName}
- PR author: @${prAuthor}
- PR title: ${prTitle}
- PR body: ${prBody || "(no body provided)"}
- Size: ${sizeContext}
- Classification: ${classificationType} (risk: ${classificationRisk})
- Classification reasoning: ${classificationReasoning}
- Recommended action: ${recommendationType}
`;

  // Add duplicate context if relevant
  if (recommendationType === "flag-duplicate" && duplicateContext) {
    prompt += `- Likely duplicate of: PR/issue #${duplicateContext.number} — "${duplicateContext.title}"\n`;
  }

  prompt += "\nTASK:\n";

  // Type-specific guidance
  switch (recommendationType) {
    case "approve-merge":
      prompt += `Draft a comment that acknowledges the PR positively and indicates it looks ready to merge. Should be brief — this PR is safe enough to merge after CI. Reference the type of change (e.g., 'docs fix', 'dep bump') when natural.`;
      break;

    case "request-review":
      prompt += `Draft a comment that thanks the contributor and notes specific areas worth reviewing. Reference the classification type and what about it needs careful review (e.g., 'the breaking change to the auth API', 'the new caching layer logic'). The maintainer will do the actual review — your job is to set the agenda.`;
      break;

    case "request-changes":
      prompt += `Draft a comment thanking the contributor and noting that some changes are needed before merging. Be specific about what needs to change. If the body doesn't have enough info, ask for what's missing (tests, documentation, smaller scope, etc.).`;
      break;

    case "close-as-stale":
      prompt += `Draft a polite closing comment. Note that the PR appears stale or no longer relevant. Invite the contributor to reopen if they want to continue.`;
      break;

    case "notify-only":
      prompt += `Draft a brief acknowledgment. Don't over-promise action. Just signal the PR was seen and will be reviewed.`;
      break;

    case "flag-duplicate":
      if (duplicateContext) {
        prompt += `Draft a comment thanking the contributor and noting the PR appears similar to #${duplicateContext.number}. Suggest they look at that one and either rebase on top of it or close in favor of the existing work.`;
      } else {
        prompt += `Draft a comment noting this appears to be a duplicate. Ask the contributor to search for similar PRs and coordinate.`;
      }
      break;

    default:
      prompt += `Draft a brief acknowledgment comment for this ${recommendationType} recommendation.`;
  }

  prompt += "\n\nReturn ONLY valid JSON matching the schema. Do not include any preamble or explanation outside the JSON.";

  return prompt;
}
