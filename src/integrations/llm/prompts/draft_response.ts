import { z } from "zod";

export const DraftOutputSchema = z.object({
  draft_content: z
    .string()
    .min(20)
    .describe(
      "The actual comment text Triage proposes for the maintainer to post. Should sound like a maintainer wrote it: concise, respectful, on-point. No corporate language, no AI-speak, no excessive apologies.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How confident the LLM is the draft is appropriate, 0 to 1. Lower if the issue is ambiguous or the draft requires significant maintainer judgment.",
    ),
  reasoning: z
    .string()
    .min(10)
    .describe("1-2 sentence explanation of why this draft fits the situation."),
});

export type DraftOutput = z.infer<typeof DraftOutputSchema>;

export const PROMPT_VERSION = "v1";

export function buildDraftPrompt(
  issueTitle: string,
  issueBody: string | null,
  repoFullName: string,
  issueAuthor: string,
  classificationType: string,
  classificationSeverity: string,
  classificationReasoning: string,
  recommendationType: string,
  duplicateContext?: { number: number; title: string },
): string {
  let prompt = `You are drafting a response on behalf of an open-source maintainer to a GitHub issue.

Guidelines for tone:
- Sound like a real human maintainer, not corporate or AI-flavored
- Be concise — target 1-3 sentences. Long drafts are bad drafts.
- Be respectful even when closing as spam or duplicate
- Address the author by their GitHub handle (@${issueAuthor}) when natural, not always

Forbidden phrases — never use these or variants:
- "Please let us know if you have further questions"
- "Thanks for reaching out"
- "We appreciate your contribution"
- "Please feel free to..."
- "Please ensure future..."
- "We'll keep [X] in mind"
- "as we plan future updates" / "for future consideration"
- Any phrase suggesting a roadmap or timeline you don't actually know

Forbidden structural patterns:
- No exclamation points
- No emoji
- No section headers in short responses
- No closing salutation ("Best,", "Cheers,", etc.)
- No opening greeting beyond "@handle" when used

Honesty about specificity:
- If you don't know the exact docs URL or section name, say "the docs" or "the README" — never invent specific section names like "the configuration guide"
- Don't promise specific action ("we'll fix this") — instead, acknowledge ("noted")
- Don't promise timelines
- Don't reference anything you weren't told about (specific files, sections, contributors)

Good examples of tone:
- "Can you share the full error output and your Node version?"
- "Looks like a duplicate of #42 — closing in favor of that one."
- "Off-topic for this project, closing."
- "Noted, thanks."

Bad examples (DO NOT produce these):
- "Hi @user, thank you so much for your valuable contribution!"
- "We'll definitely consider this for future releases!"
- "Please feel free to share more details so we can help you better!"

CONTEXT:
- Repository: ${repoFullName}
- Issue author: @${issueAuthor}
- Issue title: ${issueTitle}
- Issue body: ${issueBody || "(no body provided)"}
- Classification: ${classificationType} (severity: ${classificationSeverity})
- Classification reasoning: ${classificationReasoning}
- Recommended action: ${recommendationType}
`;

  // Add duplicate context if relevant
  if (recommendationType === "flag-duplicate" && duplicateContext) {
    prompt += `- Likely duplicate of: issue #${duplicateContext.number} — "${duplicateContext.title}"\n`;
  }

  prompt += "\nTASK:\n";

  // Type-specific guidance
  switch (recommendationType) {
    case "request-info":
      prompt += `Draft a comment that asks the author for the specific missing information needed to triage this issue. Be specific about what would help (reproduction steps, error logs, environment details, etc.).`;
      break;

    case "route-to-docs":
      prompt += `Draft a comment acknowledging the question and pointing the author toward documentation. Don't fabricate specific URLs — instead, suggest where to look (e.g., 'the README', 'the configuration docs') or note that the maintainer should add the link.`;
      break;

    case "flag-spam":
      prompt += `Draft a brief, polite closing comment. Note that the issue appears off-topic for this project. Don't be aggressive.`;
      break;

    case "flag-duplicate":
      if (duplicateContext) {
        prompt += `Draft a comment that thanks the author, notes the issue appears to be a duplicate of #${duplicateContext.number}, and asks them to follow the linked issue instead. If the duplicate context shows the original was already resolved, suggest reopening that one if the problem persists.`;
      } else {
        prompt += `Draft a comment that notes this appears to be a duplicate. Ask the author to search for similar issues and link to the relevant one.`;
      }
      break;

    case "notify-only":
      prompt += `Draft a brief acknowledgment comment that thanks the author for the report. Don't promise specific action — just acknowledge and signal that the maintainer will review.`;
      break;

    case "urgent-attention":
      prompt += `This should never reach the draft generator (no draft for urgent). Draft a placeholder: "[Urgent — requires direct maintainer attention; no auto-draft available]" and set confidence to 0.0.`;
      break;

    default:
      prompt += `Draft a brief acknowledgment comment for this ${recommendationType} recommendation.`;
  }

  prompt += "\n\nReturn ONLY valid JSON matching the schema. Do not include any preamble or explanation outside the JSON.";

  return prompt;
}
