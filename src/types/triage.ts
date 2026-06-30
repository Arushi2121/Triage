import type { Issue, Classification } from "@/types/db";

export type TriageRecommendationType =
  // Issue recommendations
  | "notify-only"
  | "request-info"
  | "flag-spam"
  | "flag-duplicate"
  | "route-to-docs"
  | "urgent-attention"
  // PR recommendations
  | "approve-merge"
  | "request-review"
  | "request-changes"
  | "close-as-stale";

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
  embedding?: number[]; // Optional: pre-computed embedding for duplicate detection
}

// PRClassification type from db (PR is stored as an Issue row with is_pull_request=true,
// but classification stays the same Classification row — Layer 8 stores PR classifications
// in the existing classifications table)

export interface PRTriageContext {
  issue: Issue;                  // PR is stored as issue
  classification: Classification; // PR classification stored in same table
  embedding?: number[];
  // PR-specific metadata extracted from the payload at decide time
  additions: number;
  deletions: number;
  changedFiles: number;
  isDraft: boolean;
}
