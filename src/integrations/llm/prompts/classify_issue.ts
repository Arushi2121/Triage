import { z } from "zod";

export const ClassificationOutputSchema = z.object({
  issue_type: z.enum([
    "bug",
    "feature",
    "question",
    "duplicate",
    "spam",
    "documentation",
    "discussion",
  ]),
  severity: z.enum(["critical", "high", "medium", "low", "none"]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the classification, 0 to 1"),
  reasoning: z
    .string()
    .min(10)
    .describe("Brief explanation of the classification, 1-3 sentences"),
  suggested_labels: z
    .array(z.string())
    .describe("Suggested GitHub labels to apply, lowercase, kebab-case"),
});

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

export function buildClassifyPrompt(
  title: string,
  body: string | null,
  repoFullName: string,
): string {
  return `You are an assistant for an open-source maintainer. Your job is to analyze new GitHub issues and classify them to help with triage.

ISSUE TYPES:
- bug: Reports a defect or unexpected behavior in existing functionality
- feature: Requests new functionality not present today
- question: Asks for help or clarification, not a defect or new feature
- duplicate: Appears similar to a previously-reported issue (flag even if uncertain)
- spam: Off-topic, promotional, low-effort, or AI-generated noise
- documentation: About docs being unclear, missing, or wrong
- discussion: Open-ended discussion or RFC, not actionable yet

SEVERITY LEVELS:
- critical: System down, data loss, security vulnerability
- high: Major feature broken, blocking many users
- medium: Significant impact but workaround exists
- low: Minor inconvenience or polish item
- none: Not applicable (questions, discussions, spam)

FEW-SHOT EXAMPLES:

Example 1 (Clear Bug):
Input:
Title: "Database connection fails after timeout"
Body: "When the app runs for more than 10 minutes, all database queries start failing with 'connection closed' error. This is blocking our production deployment. Stack trace: [...]"

Output:
{
  "issue_type": "bug",
  "severity": "high",
  "confidence": 0.95,
  "reasoning": "Clear description of a defect with reproducible steps and error messages. High severity because it blocks production.",
  "suggested_labels": ["bug", "database", "high-priority"]
}

Example 2 (Feature Request):
Input:
Title: "Add dark mode support"
Body: "It would be great if the app supported dark mode. Many users prefer it for eye strain reduction."

Output:
{
  "issue_type": "feature",
  "severity": "medium",
  "confidence": 0.98,
  "reasoning": "Requests new functionality not present today. Medium severity as it's an enhancement but not critical.",
  "suggested_labels": ["enhancement", "ui", "dark-mode"]
}

Example 3 (Question That Looks Like Bug):
Input:
Title: "How do I configure SSL certificates?"
Body: "I'm trying to set up HTTPS but I can't figure out where to put the certificate files. The docs mention 'config directory' but I don't see it."

Output:
{
  "issue_type": "question",
  "severity": "none",
  "confidence": 0.85,
  "reasoning": "User is asking for help with configuration, not reporting a defect. May indicate documentation gaps but is fundamentally a support question.",
  "suggested_labels": ["question", "documentation", "ssl"]
}

Example 4 (Obvious Spam):
Input:
Title: "Best crypto trading platform 2026"
Body: "Check out this amazing new cryptocurrency exchange! Sign up now and get $100 bonus! [suspicious link]"

Output:
{
  "issue_type": "spam",
  "severity": "none",
  "confidence": 1.0,
  "reasoning": "Promotional content completely unrelated to the project. Clear spam.",
  "suggested_labels": ["spam", "invalid"]
}

Example 5 (Documentation Issue):
Input:
Title: "Installation docs missing step about Redis"
Body: "Followed the README installation guide but the app crashes on startup because Redis isn't running. The docs don't mention Redis is required. I had to dig through GitHub issues to figure this out."

Output:
{
  "issue_type": "documentation",
  "severity": "medium",
  "confidence": 0.92,
  "reasoning": "User reports the documentation is incomplete (missing a required dependency). Not a code bug; the software works as designed but docs need updating. Medium severity since it blocks new users.",
  "suggested_labels": ["docs", "good-first-issue", "redis"]
}

Example 6 (Possible Duplicate):
Input:
Title: "Search returns wrong results when filtering by date"
Body: "When I filter search by date range, items outside the range still appear. I think I saw something similar reported a few weeks ago."

Output:
{
  "issue_type": "duplicate",
  "severity": "medium",
  "confidence": 0.65,
  "reasoning": "Reporter explicitly mentions potential prior report. While it could be a separate bug, the language suggests duplicate. Lower confidence reflects uncertainty.",
  "suggested_labels": ["needs-triage", "search", "filtering"]
}

Example 7 (Discussion / RFC):
Input:
Title: "Should we migrate from REST to GraphQL?"
Body: "I've been thinking about whether GraphQL would benefit this project. We could batch requests, get better type safety, etc. Wanted to open a discussion about the tradeoffs before anyone commits."

Output:
{
  "issue_type": "discussion",
  "severity": "none",
  "confidence": 0.94,
  "reasoning": "Open-ended discussion about architectural direction. Not actionable as-is; needs community input before becoming a concrete proposal.",
  "suggested_labels": ["discussion", "rfc", "architecture"]
}

Now classify this issue from ${repoFullName}:
Title: ${title}
Body: ${body || "No body provided."}`;
}

export const PROMPT_VERSION = "v1";
