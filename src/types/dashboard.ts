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
