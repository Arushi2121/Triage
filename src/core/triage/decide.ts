import type { TriageContext, TriageRecommendation } from "@/types/triage";
import { applyRules } from "./rules";

/**
 * Single entry point for triage decisions.
 *
 * Currently delegates to rule-based logic in rules.ts.
 *
 * Future layers will add:
 * - Duplicate detection via embeddings (Layer 6)
 * - Context-aware refinement from historical patterns
 * - LLM-based override for edge cases
 *
 * @param context - Issue and classification data
 * @returns Triage recommendation with type, priority, and suggested action
 */
export function decideTriageActions(
  context: TriageContext,
): TriageRecommendation {
  return applyRules(context);
}
