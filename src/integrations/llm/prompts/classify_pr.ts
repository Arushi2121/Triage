import { z } from "zod";

export const PRClassificationOutputSchema = z.object({
  pr_type: z.enum([
    "bug-fix",
    "feature-addition",
    "docs-only",
    "refactor",
    "dependency-bump",
    "breaking-change",
    "chore",
    "wip",
  ]),
  risk: z.enum(["critical", "high", "medium", "low", "none"]),
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

export type PRClassificationOutput = z.infer<typeof PRClassificationOutputSchema>;

export const PROMPT_VERSION = "v1";

export function buildClassifyPRPrompt(
  prTitle: string,
  prBody: string | null,
  repoFullName: string,
  additions: number,
  deletions: number,
  changedFiles: number,
  isDraft: boolean,
): string {
  const sizeContext = `${changedFiles} files changed, +${additions}/-${deletions} lines`;
  const draftPrefix = isDraft ? "[DRAFT PR] " : "";
  
  return `You are classifying a GitHub Pull Request for an open-source maintainer's triage workflow.

Classify the PR by type AND risk level. Risk for PRs means "how risky is merging this?" — not how urgent the underlying problem is.

PR Types:
- bug-fix: Fixes a specific bug or regression. Should reference an issue or describe the bug.
- feature-addition: Adds new user-facing functionality.
- docs-only: Only changes to documentation files (README, /docs, comments). No code logic changes.
- refactor: Code structure changes that preserve behavior. Renames, extractions, simplifications.
- dependency-bump: Updates one or more dependencies. Often automated (Dependabot).
- breaking-change: Changes that break backward compatibility (API changes, removed features).
- chore: Config, CI, build, formatting, tests-only. Not user-facing.
- wip: Explicitly marked work-in-progress, exploratory, or incomplete.

Risk Levels:
- critical: Breaking change OR touches security/auth/payments. Requires careful review.
- high: Affects core functionality. Many files changed (>20). Non-trivial logic changes.
- medium: New feature or moderate refactor. Some surface area but isolated.
- low: Small fix, docs, or single-file change. Limited blast radius.
- none: Chore, formatting, comment-only changes.

Guidelines:
- If PR is marked draft, lean toward "wip" type unless the title/body explicitly states it's ready for review.
- A large PR (>500 lines changed) is at least "high" risk regardless of type.
- A single-file docs change is "docs-only" with "none" risk.
- Dependency bumps are usually "low" risk unless they include major version jumps mentioned in the body.

Repository: ${repoFullName}
PR title: ${draftPrefix}${prTitle}
PR body: ${prBody || "(no body provided)"}
Size: ${sizeContext}

Examples:

Example 1:
Title: "Fix race condition in user session cleanup"
Body: "Closes #234. The session cleanup task was deleting active sessions due to a race condition with concurrent logins. Added a mutex around the cleanup query."
Size: 2 files changed, +18/-5 lines
Classification: { "pr_type": "bug-fix", "risk": "medium", "confidence": 0.92, "reasoning": "Bug fix referencing a specific issue, with a clear technical explanation. Touches session logic which affects users but blast radius is limited.", "suggested_labels": ["bug", "fix"] }

Example 2:
Title: "Add OAuth login support"
Body: "Implements OAuth flow for Google and GitHub providers. Adds new /auth routes, updates the user model with provider_id column."
Size: 14 files changed, +432/-12 lines
Classification: { "pr_type": "feature-addition", "risk": "high", "confidence": 0.95, "reasoning": "New feature touching authentication (security-sensitive area), with significant surface area across many files. Requires careful review of auth flow.", "suggested_labels": ["feature", "auth"] }

Example 3:
Title: "Update Node.js to 22.x in CI"
Body: "Bumps Node.js version in .github/workflows/ci.yml from 20 to 22."
Size: 1 file changed, +2/-2 lines
Classification: { "pr_type": "chore", "risk": "low", "confidence": 0.97, "reasoning": "Single-file CI config update. No code changes, minimal blast radius.", "suggested_labels": ["ci", "chore"] }

Example 4:
Title: "BREAKING: rename getUserId() to getUserUUID()"
Body: "Removes the deprecated getUserId() method. All callers must migrate to getUserUUID(). See MIGRATION.md."
Size: 8 files changed, +24/-31 lines
Classification: { "pr_type": "breaking-change", "risk": "critical", "confidence": 0.98, "reasoning": "Explicitly breaking change removing public API. Requires major version bump and migration documentation.", "suggested_labels": ["breaking-change", "api"] }

Example 5:
Title: "[WIP] Trying out new caching layer"
Body: "Don't merge yet. Experimenting with Redis-based caching. Tests not yet passing."
Size: 6 files changed, +180/-22 lines
Classification: { "pr_type": "wip", "risk": "medium", "confidence": 0.95, "reasoning": "Explicitly marked WIP in title and body, with author noting tests don't pass. Not ready for review.", "suggested_labels": ["wip", "experimental"] }

Example 6:
Title: "Fix typo in installation docs"
Body: "Changes 'instal' to 'install' in README.md step 3."
Size: 1 file changed, +1/-1 lines
Classification: { "pr_type": "docs-only", "risk": "none", "confidence": 0.99, "reasoning": "Single-character docs typo fix. No risk.", "suggested_labels": ["docs", "typo"] }

Example 7:
Title: "Bump axios from 1.6.0 to 1.7.2"
Body: "Bumps axios from 1.6.0 to 1.7.2. Release notes available at https://github.com/axios/axios/releases."
Size: 2 files changed, +3/-3 lines
Classification: { "pr_type": "dependency-bump", "risk": "low", "confidence": 0.95, "reasoning": "Minor version dependency bump (1.6 → 1.7) via Dependabot pattern. Low risk for minor semver.", "suggested_labels": ["dependencies"] }

Return ONLY valid JSON matching the schema. Do not include any preamble or explanation outside the JSON.`;
}
