import type { PRTriageContext, TriageRecommendation } from "@/types/triage";

/**
 * Apply rule-based triage logic for PRs.
 * Rules evaluated in priority order — first match wins.
 * Pure function, no side effects.
 */
export function applyPRRules(context: PRTriageContext): TriageRecommendation {
  const { classification, additions, deletions, changedFiles, isDraft } = context;
  const totalLines = additions + deletions;
  
  // Rule 1: Draft PRs - hands off, not ready for review
  if (isDraft) {
    return {
      type: "notify-only",
      priority: "low",
      reasoning: `PR is marked draft: ${classification.reasoning}`,
      suggested_action: "Wait for author to mark ready for review",
      metadata: { is_draft: true },
    };
  }

  // Rule 2: WIP type - same as draft, author signal
  if (classification.issue_type === "wip") {
    return {
      type: "notify-only",
      priority: "low",
      reasoning: `PR marked work-in-progress: ${classification.reasoning}`,
      suggested_action: "Wait for author to indicate readiness",
      metadata: { wip: true },
    };
  }

  // Rule 3: Breaking change - always needs careful review regardless of size
  if (classification.issue_type === "breaking-change") {
    return {
      type: "request-review",
      priority: "urgent",
      reasoning: `Breaking change: ${classification.reasoning}`,
      suggested_action: "Requires thorough review — backward compatibility impact",
      metadata: { breaking: true },
    };
  }

  // Rule 4: Critical risk - needs attention
  if (classification.severity === "critical") {
    return {
      type: "request-review",
      priority: "urgent",
      reasoning: `Critical risk PR: ${classification.reasoning}`,
      suggested_action: "Review immediately before merging",
      metadata: {},
    };
  }

  // Rule 5: Very large PR (>500 lines) - needs review regardless of type
  if (totalLines > 500) {
    return {
      type: "request-review",
      priority: "high",
      reasoning: `Large PR with ${totalLines} lines across ${changedFiles} files: ${classification.reasoning}`,
      suggested_action: "Large change — review carefully, consider breaking into smaller PRs",
      metadata: { large_pr: true, total_lines: totalLines },
    };
  }

  // Rule 6: Dependency bump with low risk - approve-merge candidate (if confidence high)
  if (
    classification.issue_type === "dependency-bump" &&
    classification.severity === "low" &&
    classification.confidence > 0.85
  ) {
    return {
      type: "approve-merge",
      priority: "low",
      reasoning: `Minor dependency bump: ${classification.reasoning}`,
      suggested_action: "Safe to merge after CI passes",
      metadata: {},
    };
  }

  // Rule 7: Docs-only with no risk - approve-merge candidate
  if (
    classification.issue_type === "docs-only" &&
    (classification.severity === "none" || classification.severity === "low")
  ) {
    return {
      type: "approve-merge",
      priority: "low",
      reasoning: `Docs-only change: ${classification.reasoning}`,
      suggested_action: "Safe to merge",
      metadata: {},
    };
  }

  // Rule 8: Chore with low/none risk - approve-merge candidate
  if (
    classification.issue_type === "chore" &&
    (classification.severity === "none" || classification.severity === "low")
  ) {
    return {
      type: "approve-merge",
      priority: "low",
      reasoning: `Chore PR: ${classification.reasoning}`,
      suggested_action: "Safe to merge after CI passes",
      metadata: {},
    };
  }

  // Rule 9: High risk PR - needs review
  if (classification.severity === "high") {
    return {
      type: "request-review",
      priority: "high",
      reasoning: `High risk PR: ${classification.reasoning}`,
      suggested_action: "Review core functionality changes carefully",
      metadata: {},
    };
  }

  // Rule 10: Bug fix with medium risk - standard review
  if (
    classification.issue_type === "bug-fix" &&
    classification.severity === "medium"
  ) {
    return {
      type: "request-review",
      priority: "medium",
      reasoning: `Bug fix: ${classification.reasoning}`,
      suggested_action: "Verify the fix addresses the underlying issue",
      metadata: {},
    };
  }

  // Rule 11: Feature addition with medium risk - review needed
  if (
    classification.issue_type === "feature-addition" &&
    classification.severity === "medium"
  ) {
    return {
      type: "request-review",
      priority: "medium",
      reasoning: `Feature addition: ${classification.reasoning}`,
      suggested_action: "Review feature design and test coverage",
      metadata: {},
    };
  }

  // Default: notify-only for everything else (refactor, low-severity PRs)
  return {
    type: "notify-only",
    priority:
      classification.severity === "medium" ? "medium" : "low",
    reasoning: `Standard PR: ${classification.reasoning}`,
    suggested_action: "Review when convenient",
    metadata: {},
  };
}
