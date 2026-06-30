import type { TriageContext, TriageRecommendation, PRTriageContext } from "@/types/triage";
import { applyRules } from "./rules";
import { applyPRRules } from "./pr_rules";
import { findSimilarIssues } from "@/db/issues";

// Threshold above which we consider an issue a duplicate.
// Calibrated based on Layer 6 Block A semantic similarity tests (similar issues ~0.79).
// 0.85 is conservative — only flags strong matches.
// Tune during pilot; track in DEFERRED.md.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
const MAX_DUPLICATE_CANDIDATES = 3;

/**
 * Decide what action Triage should recommend for an issue.
 *
 * Process:
 * 1. Apply rule-based logic to get a baseline recommendation
 * 2. If an embedding is provided, check for duplicate issues in the same repo
 * 3. If a high-confidence duplicate is found, override to flag-duplicate
 *
 * Future layers will add: pattern-context refinement, LLM-based override.
 */
export async function decideTriageActions(
  context: TriageContext,
): Promise<TriageRecommendation> {
  const ruleBasedRecommendation = applyRules(context);

  // If we don't have an embedding, return the rule-based recommendation as-is
  if (!context.embedding) {
    return ruleBasedRecommendation;
  }

  // Check for duplicates among issues in the same repo
  try {
    const similarIssues = await findSimilarIssues({
      repoId: context.issue.repo_id,
      embedding: context.embedding,
      similarityThreshold: DUPLICATE_SIMILARITY_THRESHOLD,
      limit: MAX_DUPLICATE_CANDIDATES,
      excludeIssueId: context.issue.id,
    });

    if (similarIssues.length === 0) {
      return ruleBasedRecommendation;
    }

    // Found at least one strong duplicate — override the recommendation
    const topMatch = similarIssues[0];
    return {
      type: "flag-duplicate",
      priority: "low",
      reasoning: `High semantic similarity (${(topMatch.similarity * 100).toFixed(1)}%) to existing issue #${topMatch.github_issue_number}: "${topMatch.title}".`,
      suggested_action: `Likely duplicate of #${topMatch.github_issue_number}. Review before responding.`,
      metadata: {
        duplicate_of_issue_id: topMatch.id,
        duplicate_of_github_number: topMatch.github_issue_number,
        duplicate_of_title: topMatch.title,
        similarity: topMatch.similarity,
        additional_candidates: similarIssues.slice(1).map((s) => ({
          id: s.id,
          github_issue_number: s.github_issue_number,
          similarity: s.similarity,
        })),
      },
    };
  } catch (error) {
    // Duplicate detection failure should not block the recommendation flow.
    // Log and fall back to rule-based recommendation.
    console.error("Duplicate detection failed in decideTriageActions:", error);
    return ruleBasedRecommendation;
  }
}

export async function decideTriageActionsForPR(
  context: PRTriageContext,
): Promise<TriageRecommendation> {
  const ruleBasedRecommendation = applyPRRules(context);
  
  // If we don't have an embedding, return the rule-based recommendation as-is
  if (!context.embedding) {
    return ruleBasedRecommendation;
  }
  
  // Check for duplicate PRs (same as issues — duplicate PRs are real)
  try {
    const similarIssues = await findSimilarIssues({
      repoId: context.issue.repo_id,
      embedding: context.embedding,
      similarityThreshold: DUPLICATE_SIMILARITY_THRESHOLD,
      limit: MAX_DUPLICATE_CANDIDATES,
      excludeIssueId: context.issue.id,
    });
    
    if (similarIssues.length === 0) {
      return ruleBasedRecommendation;
    }
    
    // Override to flag-duplicate
    const topMatch = similarIssues[0];
    return {
      type: "flag-duplicate",
      priority: "low",
      reasoning: `Likely duplicate PR (${(topMatch.similarity * 100).toFixed(1)}% similar to #${topMatch.github_issue_number}: "${topMatch.title}").`,
      suggested_action: `Likely duplicate of #${topMatch.github_issue_number}. Review before merging.`,
      metadata: {
        duplicate_of_issue_id: topMatch.id,
        duplicate_of_github_number: topMatch.github_issue_number,
        duplicate_of_title: topMatch.title,
        similarity: topMatch.similarity,
      },
    };
  } catch (error) {
    console.error("PR duplicate detection failed:", error);
    return ruleBasedRecommendation;
  }
}
