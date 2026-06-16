import type { Issue, Classification } from "@/types/db";

export type TriageRecommendationType =
  | "notify-only"
  | "request-info"
  | "flag-spam"
  | "flag-duplicate"
  | "route-to-docs"
  | "urgent-attention";

export interface TriageRecommendation {
  type: TriageRecommendationType;
  priority: "low" | "medium" | "high" | "urgent";
  reasoning: string;
  suggested_action: string;
  metadata: Record<string, unknown>;
}

export interface TriageContext {
  issue: Issue;
  classification: Classification;
}
