import { getSupabaseClient } from "@/db/client";
import type { User } from "@/types/db";
import type { OverviewData, RecentActivityEvent } from "@/types/dashboard";

/**
 * Load overview data for a user: aggregated metrics + recent activity feed.
 * Scoped to the user's accessible repos via their installations.
 */
export async function loadOverviewData(user: User): Promise<OverviewData> {
  const supabase = getSupabaseClient();

  // Resolve user's accessible repo IDs
  const { data: installations } = await supabase
    .from("installations")
    .select("id")
    .eq("user_id", user.id);

  const installationIds = (installations ?? []).map((i) => i.id);

  if (installationIds.length === 0) {
    return {
      metrics: {
        totalIssuesClassified: 0,
        patternsDetected: 0,
        duplicatesCaught: 0,
        draftsApproved: 0,
      },
      recentActivity: [],
    };
  }

  const { data: repos } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .in("installation_id", installationIds)
    .is("deleted_at", null);

  const repoIdToFullName = new Map<string, string>();
  for (const r of repos ?? []) {
    repoIdToFullName.set(r.id, r.github_full_name);
  }

  const repoIds = Array.from(repoIdToFullName.keys());

  if (repoIds.length === 0) {
    return {
      metrics: {
        totalIssuesClassified: 0,
        patternsDetected: 0,
        duplicatesCaught: 0,
        draftsApproved: 0,
      },
      recentActivity: [],
    };
  }

  // Get issue IDs for the user's repos (used by classification/duplicate metrics)
  const { data: userIssues } = await supabase
    .from("issues")
    .select("id, repo_id")
    .in("repo_id", repoIds)
    .is("deleted_at", null);

  const issueIdSet = new Set((userIssues ?? []).map((i) => i.id));

  // Metric: Duplicates caught (rows in issue_duplicates for the user's issues)
  let duplicatesCaught = 0;
  if (issueIdSet.size > 0) {
    const { count } = await supabase
      .from("issue_duplicates")
      .select("*", { count: "exact", head: true })
      .in("source_issue_id", Array.from(issueIdSet));
    duplicatesCaught = count ?? 0;
  }

  // Metric 1: Issues classified
  let totalIssuesClassified = 0;
  if (issueIdSet.size > 0) {
    const { count } = await supabase
      .from("classifications")
      .select("*", { count: "exact", head: true })
      .in("issue_id", Array.from(issueIdSet))
      .not("issue_type", "is", null);
    totalIssuesClassified = count ?? 0;
  }

  // Metric 2: Patterns detected (active)
  const { count: patternsCount } = await supabase
    .from("patterns")
    .select("*", { count: "exact", head: true })
    .in("repo_id", repoIds)
    .eq("status", "active");
  const patternsDetected = patternsCount ?? 0;

  // Metric 4: Drafts approved (github-comment-posted actions with completed status)
  let draftsApproved = 0;
  if (issueIdSet.size > 0) {
    const { count } = await supabase
      .from("actions")
      .select("*", { count: "exact", head: true })
      .in("issue_id", Array.from(issueIdSet))
      .eq("action_type", "github-comment-posted")
      .eq("status", "completed");
    draftsApproved = count ?? 0;
  }

  // Recent activity: aggregate 3 sources, sort, cap at 10

  // A. Recent patterns
  const { data: recentPatterns } = await supabase
    .from("patterns")
    .select("title, severity, category, last_detected_at")
    .in("repo_id", repoIds)
    .eq("status", "active")
    .order("last_detected_at", { ascending: false })
    .limit(10);

  // B. Recent draft approvals
  const { data: recentApprovals } = await supabase
    .from("actions")
    .select("issue_id, created_at")
    .in(
      "issue_id",
      issueIdSet.size > 0
        ? Array.from(issueIdSet)
        : ["00000000-0000-0000-0000-000000000000"],
    )
    .eq("action_type", "github-comment-posted")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch titles for approved-draft issues
  const approvalIssueIds = (recentApprovals ?? []).map((a) => a.issue_id);
  const approvalIssuesById = new Map<
    string,
    { title: string; number: number; repoId: string }
  >();
  if (approvalIssueIds.length > 0) {
    const { data: approvalIssues } = await supabase
      .from("issues")
      .select("id, title, github_issue_number, repo_id")
      .in("id", approvalIssueIds);
    for (const ai of approvalIssues ?? []) {
      approvalIssuesById.set(ai.id, {
        title: ai.title,
        number: ai.github_issue_number,
        repoId: ai.repo_id,
      });
    }
  }

  // C. Recent classifications
  const recentClassificationsIssueIds = Array.from(issueIdSet).slice(0, 500);
  const { data: recentClassifications } =
    recentClassificationsIssueIds.length > 0
      ? await supabase
          .from("classifications")
          .select("issue_id, issue_type, created_at")
          .in("issue_id", recentClassificationsIssueIds)
          .not("issue_type", "is", null)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [] };

  const classificationIssueIds = (recentClassifications ?? []).map(
    (c) => c.issue_id,
  );
  const classificationIssuesById = new Map<
    string,
    { title: string; number: number; repoId: string }
  >();
  if (classificationIssueIds.length > 0) {
    const { data: classIssues } = await supabase
      .from("issues")
      .select("id, title, github_issue_number, repo_id")
      .in("id", classificationIssueIds);
    for (const ci of classIssues ?? []) {
      classificationIssuesById.set(ci.id, {
        title: ci.title,
        number: ci.github_issue_number,
        repoId: ci.repo_id,
      });
    }
  }

  // Merge all three streams
  const events: RecentActivityEvent[] = [];

  for (const p of recentPatterns ?? []) {
    events.push({
      kind: "pattern_detected",
      timestamp: p.last_detected_at,
      patternTitle: p.title,
      severity: p.severity,
      category: p.category,
    });
  }

  for (const a of recentApprovals ?? []) {
    const issue = approvalIssuesById.get(a.issue_id);
    if (!issue) continue;
    events.push({
      kind: "draft_approved",
      timestamp: a.created_at,
      issueTitle: issue.title,
      issueNumber: issue.number,
      repoFullName: repoIdToFullName.get(issue.repoId) ?? "unknown",
    });
  }

  for (const c of recentClassifications ?? []) {
    const issue = classificationIssuesById.get(c.issue_id);
    if (!issue) continue;
    events.push({
      kind: "issue_classified",
      timestamp: c.created_at,
      issueTitle: issue.title,
      issueNumber: issue.number,
      issueType: c.issue_type,
      repoFullName: repoIdToFullName.get(issue.repoId) ?? "unknown",
    });
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const recentActivity = events.slice(0, 10);

  return {
    metrics: {
      totalIssuesClassified,
      patternsDetected,
      duplicatesCaught,
      draftsApproved,
    },
    recentActivity,
  };
}
