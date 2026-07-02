import type { DigestData } from "@/core/digests/generate";
import type { DetectedPattern } from "@/core/patterns/detect";

const CATEGORY_EMOJI: Record<string, string> = {
  "performance": "⚡",
  "documentation": "📖",
  "usability": "🧭",
  "compatibility": "🔀",
  "feature-request": "✨",
  "bug-cluster": "🐛",
  "workflow-friction": "🔧",
  "other": "🔖",
};

const SEVERITY_LABEL: Record<string, string> = {
  "critical": "Critical",
  "high": "High",
  "medium": "Medium",
  "low": "Low",
};

const ISSUE_TYPE_EMOJI: Record<string, string> = {
  "bug": "🐛",
  "feature": "✨",
  "question": "❓",
  "duplicate": "🔁",
  "spam": "🗑️",
  "documentation": "📖",
  "discussion": "💬",
  "unclassified": "❔",
};

const PR_TYPE_EMOJI: Record<string, string> = {
  "bug-fix": "🐛",
  "feature-addition": "✨",
  "docs-only": "📖",
  "refactor": "🔧",
  "dependency-bump": "📦",
  "breaking-change": "💥",
  "chore": "🧹",
  "wip": "🚧",
  "unclassified": "❔",
};

const MAX_PATTERNS_SHOWN = 5;

/**
 * Format a time window as a readable range.
 * "Last 7 days", "Last 30 days", or explicit dates for other windows.
 */
function formatWindow(windowStart: string, windowEnd: string): string {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 7) return "Last 7 days";
  if (days === 14) return "Last 14 days";
  if (days === 30) return "Last 30 days";
  // Fall back to date range for arbitrary windows
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} — ${end.toLocaleDateString(undefined, opts)}`;
}

/**
 * Format a type count map as inline text: "🐛 5 bug · ✨ 3 feature · ❓ 2 question"
 * Skips zero counts. Emoji map varies for issues vs PRs.
 */
function formatTypeBreakdown(
  counts: Record<string, number>,
  emojiMap: Record<string, string>,
): string {
  const entries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "_(none)_";
  return entries
    .map(([type, count]) => {
      const emoji = emojiMap[type] ?? "•";
      return `${emoji} ${count} ${type}`;
    })
    .join(" · ");
}

/**
 * Sort patterns for display: severity (critical → low), then issue count desc.
 */
function sortPatternsForDisplay(patterns: DetectedPattern[]): DetectedPattern[] {
  const severityRank: Record<string, number> = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
  };
  return [...patterns].sort((a, b) => {
    const aRank = severityRank[a.pattern.severity] ?? 99;
    const bRank = severityRank[b.pattern.severity] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return b.pattern.issue_count - a.pattern.issue_count;
  });
}

export function buildDigestMessage(digest: DigestData): {
  text: string;
  blocks: unknown[];
} {
  const {
    repoFullName,
    windowStart,
    windowEnd,
    totalIssues,
    issuesByType,
    totalPRs,
    prsByType,
    patterns,
    duplicatesCaught,
  } = digest;

  const windowLabel = formatWindow(windowStart, windowEnd);
  const sortedPatterns = sortPatternsForDisplay(patterns);
  const patternsShown = sortedPatterns.slice(0, MAX_PATTERNS_SHOWN);
  const patternsOverflow = sortedPatterns.length - patternsShown.length;

  // Plain text fallback for Slack notification previews
  const text = `📊 Triage Digest for ${repoFullName} — ${totalIssues} issues, ${totalPRs} PRs, ${patterns.length} patterns detected`;

  const blocks: unknown[] = [];

  // Block 1: Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `📊 Triage Digest — ${repoFullName}`,
    },
  });

  // Block 2: Window subtitle
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `_${windowLabel}_`,
      },
    ],
  });

  // Block 3: Overview counts
  const overviewParts: string[] = [];
  overviewParts.push(`*${totalIssues}* issues`);
  overviewParts.push(`*${totalPRs}* PRs`);
  if (duplicatesCaught > 0) {
    overviewParts.push(`*${duplicatesCaught}* duplicates caught`);
  }
  if (patterns.length > 0) {
    overviewParts.push(`*${patterns.length}* patterns detected`);
  }
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📈 *Overview*\n${overviewParts.join(" · ")}`,
    },
  });

  // Block 4: Issues breakdown (only if there are issues)
  if (totalIssues > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎯 *Issues by type*\n${formatTypeBreakdown(issuesByType, ISSUE_TYPE_EMOJI)}`,
      },
    });
  }

  // Block 5: PRs breakdown (only if there are PRs)
  if (totalPRs > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔀 *PRs by type*\n${formatTypeBreakdown(prsByType, PR_TYPE_EMOJI)}`,
      },
    });
  }

  // Block 6: Divider before patterns (if patterns exist)
  if (patternsShown.length > 0) {
    blocks.push({ type: "divider" });

    // Block 7: Patterns header
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🧠 *Patterns detected*`,
      },
    });

    // Block 8-N: One section per pattern (up to MAX_PATTERNS_SHOWN)
    for (const item of patternsShown) {
      const p = item.pattern;
      const categoryEmoji = CATEGORY_EMOJI[p.category] ?? "🔖";
      const severityLabel = SEVERITY_LABEL[p.severity] ?? p.severity;
      const newBadge = item.isNew ? " · _new_" : "";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${categoryEmoji} *${p.title}*\n_${p.description}_\n${p.issue_count} issues · ${severityLabel} · ${p.category}${newBadge}`,
        },
      });
    }

    // Block N+1: Overflow note if there are more patterns
    if (patternsOverflow > 0) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_… and ${patternsOverflow} more pattern${patternsOverflow === 1 ? "" : "s"} not shown_`,
          },
        ],
      });
    }
  }

  // Block final: Footer context
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Digest generated at ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · Triage`,
      },
    ],
  });

  return { text, blocks };
}
