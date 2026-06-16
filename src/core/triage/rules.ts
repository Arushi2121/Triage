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

  // Rule 3: Critical severity
  if (classification.severity === "critical") {
    return {
      type: "urgent-attention",
      priority: "urgent",
      reasoning: `Critical severity: ${classification.reasoning}`,
      suggested_action: "Triage immediately — possible system-critical issue",
      metadata: {},
    };
  }

  // Rule 4: High severity
  if (classification.severity === "high") {
    return {
      type: "urgent-attention",
      priority: "high",
      reasoning: `High severity: ${classification.reasoning}`,
      suggested_action: "Address within the day",
      metadata: {},
    };
  }

  // Rule 5: Documentation issue
  if (classification.issue_type === "documentation") {
    return {
      type: "route-to-docs",
      priority: "medium",
      reasoning: `Documentation issue: ${classification.reasoning}`,
      suggested_action: "Update docs or close with link to existing docs",
      metadata: {},
    };
  }

  // Rule 6: Question
  if (classification.issue_type === "question") {
    return {
      type: "request-info",
      priority: "low",
      reasoning: `Question requires clarification: ${classification.reasoning}`,
      suggested_action: "Ask author for specific details or point to existing docs",
      metadata: {},
    };
  }

  // Rule 7: Default (bug, feature, discussion with medium/low severity)
  return {
    type: "notify-only",
    priority: classification.severity === "medium" ? "medium" : "low",
    reasoning: `Standard issue, no special handling: ${classification.reasoning}`,
    suggested_action: "Review when convenient",
    metadata: {},
  };
}
