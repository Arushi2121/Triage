import type { TriageContext, TriageRecommendation } from "@/types/triage";

/**
 * Apply rule-based triage logic to an issue + classification.
 * Rules are evaluated in priority order — first match wins.
 * Pure function with no side effects.
 */
export function applyRules(context: TriageContext): TriageRecommendation {
  const { classification } = context;

  // Rule 1: Spam classification
  if (classification.issue_type === "spam") {
    return {
      type: "flag-spam",
      priority: "low",
      reasoning: `Classified as spam with ${classification.confidence} confidence: ${classification.reasoning}`,
      suggested_action: "Review and close if confirmed spam",
      metadata: {},
    };
  }

  // Rule 2: Duplicate classification
  if (classification.issue_type === "duplicate") {
    return {
      type: "flag-duplicate",
      priority: "low",
      reasoning: `Possible duplicate based on classification: ${classification.reasoning}`,
      suggested_action: "Search recent issues for similar reports",
      metadata: { needs_embedding_check: true },
    };
  }

  // Rule 3: Critical severity — genuine emergency, no auto-draft, escalate to human
  if (classification.severity === "critical") {
    return {
      type: "urgent-attention",
      priority: "urgent",
      reasoning: `Critical severity: ${classification.reasoning}`,
      suggested_action: "Triage immediately — possible system-critical issue",
      metadata: {},
    };
  }

  // Rule 4: Bugs and features — draftable at any non-critical severity.
  // Returns notify-only (NOT urgent-attention) so events.ts draft generation runs
  // (its trigger is `recommendation.type !== "urgent-attention"`).
  // Rationale: bug reports benefit from drafts asking for reproduction info; feature
  // requests benefit from drafts acknowledging + asking about use case.
  if (
    classification.issue_type === "bug" ||
    classification.issue_type === "feature"
  ) {
    const priority: TriageRecommendation["priority"] =
      classification.severity === "high"
        ? "high"
        : classification.severity === "medium"
          ? "medium"
          : "low";
    return {
      type: "notify-only",
      priority,
      reasoning: `${classification.issue_type} report at ${classification.severity} severity — drafting response for maintainer review.`,
      suggested_action:
        classification.issue_type === "bug"
          ? "Draft asks for reproduction steps, environment, and expected vs actual behavior."
          : "Draft acknowledges the request and asks about use case, priority, and any workarounds already tried.",
      metadata: {
        draft_intent: classification.issue_type === "bug" ? "bug-triage" : "feature-triage",
      },
    };
  }

  // Rule 5: High severity for non-bug/feature types (docs, discussion, etc.)
  if (classification.severity === "high") {
    return {
      type: "urgent-attention",
      priority: "high",
      reasoning: `High severity: ${classification.reasoning}`,
      suggested_action: "Address within the day",
      metadata: {},
    };
  }

  // Rule 6: Documentation issue
  if (classification.issue_type === "documentation") {
    return {
      type: "route-to-docs",
      priority: "medium",
      reasoning: `Documentation issue: ${classification.reasoning}`,
      suggested_action: "Update docs or close with link to existing docs",
      metadata: {},
    };
  }

  // Rule 7: Question
  if (classification.issue_type === "question") {
    return {
      type: "request-info",
      priority: "low",
      reasoning: `Question requires clarification: ${classification.reasoning}`,
      suggested_action: "Ask author for specific details or point to existing docs",
      metadata: {},
    };
  }

  // Rule 8: Default fallback (discussion, other with medium/low severity)
  return {
    type: "notify-only",
    priority: classification.severity === "medium" ? "medium" : "low",
    reasoning: `Standard issue, no special handling: ${classification.reasoning}`,
    suggested_action: "Review when convenient",
    metadata: {},
  };
}
