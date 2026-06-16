import assert from "node:assert";
import type { Issue, Classification } from "@/types/db";
import type { TriageRecommendation } from "@/types/triage";
import { buildTriageMessage } from "@/formatters/slack/triage_message";

// Helper to create fake Issue object
function createFakeIssue(): Issue {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    repo_id: "22222222-2222-2222-2222-222222222222",
    github_issue_id: 12345,
    github_issue_number: 42,
    github_node_id: "I_kwDOABCDEF",
    title: "Test issue title",
    body: "Test body",
    state: "open",
    author_github_id: 99999,
    author_github_login: "testuser",
    author_association: "CONTRIBUTOR",
    labels: [],
    assignees: [],
    comments_count: 0,
    reactions: {},
    is_pull_request: false,
    embedding: null,
    embedding_model: null,
    embedded_at: null,
    github_created_at: "2026-06-16T00:00:00Z",
    github_updated_at: "2026-06-16T00:00:00Z",
    github_closed_at: null,
    created_at: "2026-06-16T00:00:00Z",
    updated_at: "2026-06-16T00:00:00Z",
    deleted_at: null,
  };
}

// Helper to create fake Classification object
function createFakeClassification(
  issue_type: string,
  severity: string,
  confidence: number,
): Classification {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    issue_id: "11111111-1111-1111-1111-111111111111",
    issue_type,
    severity,
    confidence,
    reasoning: "Test reasoning for classification",
    suggested_labels: ["test"],
    raw_llm_response: {},
    prompt_version: "v1",
    llm_model: "gemini-2.5-flash",
    llm_temperature: 0.2,
    token_count_input: 100,
    token_count_output: 50,
    classified_at: "2026-06-16T00:00:00Z",
    created_at: "2026-06-16T00:00:00Z",
    updated_at: "2026-06-16T00:00:00Z",
  };
}

// Helper to create fake TriageRecommendation
function createFakeRecommendation(
  type: string,
  priority: string,
  suggested_action: string,
): TriageRecommendation {
  return {
    type: type as TriageRecommendation["type"],
    priority: priority as TriageRecommendation["priority"],
    reasoning: "Test reasoning for recommendation",
    suggested_action,
    metadata: {},
  };
}

console.log("Testing Layer 5 Block B: Slack Triage Message Formatter\n");

// Test 1: Urgent attention
{
  const issue = createFakeIssue();
  const classification = createFakeClassification("bug", "critical", 0.95);
  const recommendation = createFakeRecommendation(
    "urgent-attention",
    "urgent",
    "Triage immediately",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  assert.strictEqual(
    (result.blocks[0] as { type: string }).type,
    "header",
    "First block should be header",
  );
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(headerText.includes("🚨"), "Header should contain urgent emoji");
  assert.ok(
    headerText.includes("Urgent Attention"),
    "Header should contain title",
  );
  assert.ok(
    headerText.includes("Critical"),
    "Header should contain severity",
  );

  const issueSection = (result.blocks[1] as { text: { text: string } }).text
    .text;
  assert.ok(
    issueSection.includes("https://github.com/owner/repo/issues/42"),
    "Should contain issue URL",
  );

  const triageSection = (result.blocks[2] as { text: { text: string } }).text
    .text;
  assert.ok(
    triageSection.includes("Triage immediately"),
    "Should contain suggested action",
  );

  assert.strictEqual(
    (result.blocks[3] as { type: string }).type,
    "context",
    "Fourth block should be context",
  );
  const contextText = (
    result.blocks[3] as {
      elements: Array<{ text: string }>;
    }
  ).elements[0].text;
  assert.ok(contextText.includes("95%"), "Should show confidence percent");

  console.log("✓ Urgent attention formatter produces correct blocks");
}

// Test 2: Flag spam
{
  const issue = createFakeIssue();
  const classification = createFakeClassification("spam", "none", 0.99);
  const recommendation = createFakeRecommendation(
    "flag-spam",
    "low",
    "Review and close if confirmed spam",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(headerText.includes("🗑️"), "Header should contain spam emoji");
  assert.ok(headerText.includes("Likely Spam"), "Header should contain title");

  console.log("✓ Flag spam formatter produces correct blocks");
}

// Test 3: Flag duplicate
{
  const issue = createFakeIssue();
  const classification = createFakeClassification("duplicate", "medium", 0.7);
  const recommendation = createFakeRecommendation(
    "flag-duplicate",
    "low",
    "Search recent issues",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(
    headerText.includes("🔁"),
    "Header should contain duplicate emoji",
  );
  assert.ok(
    headerText.includes("Possible Duplicate"),
    "Header should contain title",
  );

  console.log("✓ Flag duplicate formatter produces correct blocks");
}

// Test 4: Route to docs
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "documentation",
    "medium",
    0.88,
  );
  const recommendation = createFakeRecommendation(
    "route-to-docs",
    "medium",
    "Update docs or link to existing",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(headerText.includes("📚"), "Header should contain docs emoji");
  assert.ok(
    headerText.includes("Documentation Issue"),
    "Header should contain title",
  );

  console.log("✓ Route to docs formatter produces correct blocks");
}

// Test 5: Request info
{
  const issue = createFakeIssue();
  const classification = createFakeClassification("question", "none", 0.82);
  const recommendation = createFakeRecommendation(
    "request-info",
    "low",
    "Ask author for details",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(
    headerText.includes("❓"),
    "Header should contain question emoji",
  );
  assert.ok(
    headerText.includes("Needs More Info"),
    "Header should contain title",
  );

  console.log("✓ Request info formatter produces correct blocks");
}

// Test 6: Notify only
{
  const issue = createFakeIssue();
  const classification = createFakeClassification("feature", "low", 0.75);
  const recommendation = createFakeRecommendation(
    "notify-only",
    "low",
    "Review when convenient",
  );
  const result = buildTriageMessage({
    issue,
    classification,
    recommendation,
    repoFullName: "owner/repo",
    issueUrl: "https://github.com/owner/repo/issues/42",
  });

  assert.strictEqual(result.blocks.length, 4, "Should have 4 blocks");
  const headerText = (
    result.blocks[0] as {
      text: { text: string };
    }
  ).text.text;
  assert.ok(headerText.includes("📥"), "Header should contain inbox emoji");
  assert.ok(headerText.includes("New Issue"), "Header should contain title");

  console.log("✓ Notify only formatter produces correct blocks");
}

console.log("\n✓ All Layer 5 Block B tests passed");
