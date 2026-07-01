import { z } from "zod";

export const PatternSummaryOutputSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(80)
    .describe("2-8 word title describing the pattern theme"),
  description: z
    .string()
    .min(20)
    .max(400)
    .describe("1-2 sentence description of what unites these issues"),
  category: z.enum([
    "performance",
    "documentation",
    "usability",
    "compatibility",
    "feature-request",
    "bug-cluster",
    "workflow-friction",
    "other",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
});

export type PatternSummaryOutput = z.infer<typeof PatternSummaryOutputSchema>;
export const PROMPT_VERSION = "v1";

export function buildSummarizePatternPrompt(params: {
  repoFullName: string;
  issueSnippets: Array<{ title: string; bodyExcerpt: string }>;
}): string {
  const issuesText = params.issueSnippets
    .map((s, i) => `Issue ${i + 1}:\nTitle: ${s.title}\nBody: ${s.bodyExcerpt}`)
    .join("\n\n");

  return `You are analyzing a cluster of related GitHub issues from an open-source project. Your job is to identify the THEME that connects them and produce a summary a maintainer can act on.

Categories (choose exactly one):
- performance: slow response times, memory issues, resource consumption
- documentation: unclear docs, missing examples, outdated guides
- usability: confusing UX, unexpected behavior, hard-to-discover features
- compatibility: platform/version/browser incompatibilities
- feature-request: multiple requests for the same missing capability
- bug-cluster: multiple reports of the same underlying bug
- workflow-friction: setup, install, configuration pain
- other: doesn't fit the above (use sparingly)

Severity (based on how impactful the pattern is to maintainer):
- critical: blocking many users, security-adjacent
- high: recurring pain point affecting real workflows
- medium: consistent friction but not blocking
- low: minor recurring annoyance

Guidelines:
- Title should be SPECIFIC not generic. "M1 Mac installation fails" not "Installation problems."
- Description should name the shared symptom or need, not just count the issues.
- If issues span multiple themes, pick the strongest signal — don't force a merger.
- Base confidence on how similar the issues actually are. If they're loosely related, lower confidence.

Repository: ${params.repoFullName}
Cluster of ${params.issueSnippets.length} issues:

${issuesText}

Return ONLY valid JSON matching the schema. No preamble.`;
}
