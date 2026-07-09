// Dashboard-specific types. Keeps Triage core types clean.
// Extended by Blocks B, C, D.

export interface DashboardMetrics {
  totalIssuesClassified: number;
  patternsDetected: number;
  duplicatesCaught: number;
  draftsApproved: number;
}

export interface DashboardUser {
  id: string;
  githubUsername: string;
  slackUserId: string | null;
}

export type RecentActivityEvent =
  | {
      kind: "pattern_detected";
      timestamp: string;
      patternTitle: string;
      severity: string;
      category: string;
    }
  | {
      kind: "draft_approved";
      timestamp: string;
      issueTitle: string;
      issueNumber: number;
      repoFullName: string;
    }
  | {
      kind: "issue_classified";
      timestamp: string;
      issueTitle: string;
      issueNumber: number;
      issueType: string;
      repoFullName: string;
    };

export interface OverviewData {
  metrics: DashboardMetrics;
  recentActivity: RecentActivityEvent[];
}

export interface PatternListItem {
  id: string;
  title: string;
  category: string;
  severity: string;
  issue_count: number;
  status: string;
  first_detected_at: string;
  last_detected_at: string;
  repo_full_name: string;
}

export interface PatternDetail extends PatternListItem {
  description: string;
  reasoning: string;
  suggested_actions: string[];
  contributing_issues: Array<{
    id: string;
    github_issue_number: number;
    title: string;
    state: string;
    is_pull_request: boolean;
    github_url: string;
    confidence: number;
  }>;
}

export type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

export type CategoryFilter =
  | "all"
  | "performance"
  | "documentation"
  | "usability"
  | "compatibility"
  | "feature-request"
  | "bug-cluster"
  | "workflow-friction"
  | "other";

export interface IssueListItem {
  id: string;
  github_issue_number: number;
  title: string;
  is_pull_request: boolean;
  state: string;
  classification_type: string | null;
  draft_status: string | null;
  repo_full_name: string;
  github_url: string;
  created_at: string;
}

export type IssueClassificationFilter =
  | "all"
  | "bug"
  | "feature"
  | "question"
  | "documentation"
  | "discussion"
  | "spam"
  | "unclassified";

export type IssueStateFilter = "all" | "open" | "closed";

export type IssueItemTypeFilter = "all" | "issue" | "pr";
