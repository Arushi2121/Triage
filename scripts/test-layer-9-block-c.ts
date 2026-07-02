import assert from "node:assert";
import { buildDigestMessage } from "../src/formatters/slack/digest_message";
import type { DigestData } from "../src/core/digests/generate";
import type { DetectedPattern } from "../src/core/patterns/detect";
import type { Pattern, Issue } from "../src/types/db";

console.log("=== Testing Layer 9 Block C: buildDigestMessage ===");

function makePattern(
  title: string,
  severity: string,
  issue_count: number,
  isNew = true,
  category = "documentation",
): DetectedPattern {
  const pattern: Pattern = {
    id: `pattern-${title}`,
    repo_id: "repo-1",
    title,
    description: `Description of ${title}`,
    category,
    severity,
    status: "active",
    issue_count,
    first_detected_at: new Date().toISOString(),
    last_detected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Pattern;
  return { pattern, isNew, matchedIssues: [] as Issue[] };
}

function baseDigest(overrides: Partial<DigestData> = {}): DigestData {
  return {
    repoId: "repo-1",
    repoFullName: "test-owner/test-repo",
    windowStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    windowEnd: new Date().toISOString(),
    totalIssues: 0,
    issuesByType: {},
    totalPRs: 0,
    prsByType: {},
    patterns: [],
    duplicatesCaught: 0,
    digestId: "digest-1",
    ...overrides,
  };
}

// Test 1: Empty digest still renders header + footer
{
  const result = buildDigestMessage(baseDigest());
  assert.ok(result.text.length > 0, "text should be non-empty");
  assert.ok(Array.isArray(result.blocks), "blocks should be array");
  assert.ok(result.blocks.length >= 3, "empty digest should still have header + overview + footer");
  console.log("✓ Empty digest produces valid message");
}

// Test 2: Small digest with 1 pattern
{
  const result = buildDigestMessage(baseDigest({
    totalIssues: 5,
    issuesByType: { bug: 3, question: 2 },
    totalPRs: 2,
    prsByType: { "docs-only": 2 },
    patterns: [makePattern("Docs quality issues", "medium", 3)],
    duplicatesCaught: 1,
  }));
  assert.ok(result.text.includes("5 issues"), "text should show issue count");
  assert.ok(result.text.includes("1 patterns"), "text should show pattern count");
  // Blocks: header, context (window), overview, issues breakdown, PRs breakdown, divider, patterns header, pattern section, divider, footer
  assert.ok(result.blocks.length >= 8, `expected 8+ blocks for small digest, got ${result.blocks.length}`);
  console.log(`✓ Small digest produces ${result.blocks.length} blocks`);
}

// Test 3: Full digest with pattern overflow and proper sorting
{
  const result = buildDigestMessage(baseDigest({
    totalIssues: 25,
    issuesByType: { bug: 12, feature: 8, question: 5 },
    totalPRs: 8,
    prsByType: { "bug-fix": 3, "feature-addition": 3, "docs-only": 2 },
    patterns: [
      makePattern("Critical pattern", "critical", 10),
      makePattern("High pattern A", "high", 8),
      makePattern("High pattern B", "high", 6),
      makePattern("Medium pattern A", "medium", 5),
      makePattern("Medium pattern B", "medium", 4),
      makePattern("Low pattern", "low", 3, false),
    ],
    duplicatesCaught: 4,
  }));
  // 6 patterns, max shown = 5, so overflow message should mention 1 more
  const blocksJson = JSON.stringify(result.blocks);
  assert.ok(blocksJson.includes("1 more pattern"), "should show overflow message for 6th pattern");
  // Critical should appear in output, Low should not (it's 6th)
  assert.ok(blocksJson.includes("Critical pattern"), "critical pattern should be shown");
  assert.ok(!blocksJson.includes("Low pattern"), "low pattern should be hidden (6th position)");
  // Verify critical appears before medium in the output
  assert.ok(blocksJson.indexOf("Critical pattern") < blocksJson.indexOf("Medium pattern A"), "critical patterns should be sorted before medium");
  console.log(`✓ Full digest sorts patterns and shows overflow (${result.blocks.length} blocks)`);
}

// Test 4: Formatter doesn't crash on unknown category/severity/type
{
  const result = buildDigestMessage(baseDigest({
    totalIssues: 2,
    issuesByType: { "unknown-type": 2 },
    patterns: [makePattern("Weird pattern", "unusual-severity", 3, true, "unknown-category")],
  }));
  assert.ok(result.blocks.length > 0, "should render even with unknown values");
  console.log("✓ Unknown category/severity/type doesn't crash formatter");
}

console.log("\n✓ All Layer 9 Block C tests passed");
