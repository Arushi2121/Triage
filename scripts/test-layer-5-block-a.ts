import assert from "node:assert";
import type { Issue, Classification } from "@/types/db";
import { decideTriageActions } from "@/core/triage/decide";

// Helper to create fake Issue object
function createFakeIssue(): Issue {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    repo_id: "22222222-2222-2222-2222-222222222222",
    github_issue_id: 12345,
    github_issue_number: 42,
    github_node_id: "I_kwDOABCDEF",
    title: "Test issue",
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
  reasoning: string,
): Classification {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    issue_id: "11111111-1111-1111-1111-111111111111",
    issue_type,
    severity,
    confidence: 0.85,
    reasoning,
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

console.log("Testing Layer 5 Block A: Core Triage Decision Engine\n");

// Test 1: Spam classification
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "spam",
    "none",
    "Promotional content detected",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(result.type, "flag-spam", "Spam should flag as spam");
  assert.strictEqual(result.priority, "low", "Spam should be low priority");
  assert.ok(
    result.reasoning.includes("spam"),
    "Reasoning should mention spam",
  );
  assert.ok(
    result.reasoning.includes("Promotional content detected"),
    "Reasoning should include classification reasoning",
  );
  assert.strictEqual(
    result.suggested_action,
    "Review and close if confirmed spam",
  );
  console.log("✓ Spam classification → flag-spam");
}

// Test 2: Duplicate classification
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "duplicate",
    "medium",
    "Similar to previously reported issue",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "flag-duplicate",
    "Duplicate should flag as duplicate",
  );
  assert.strictEqual(
    result.priority,
    "low",
    "Duplicate should be low priority",
  );
  assert.ok(
    result.reasoning.includes("duplicate"),
    "Reasoning should mention duplicate",
  );
  assert.strictEqual(
    result.metadata.needs_embedding_check,
    true,
    "Metadata should flag for embedding check",
  );
  console.log(
    "✓ Duplicate classification → flag-duplicate with embedding metadata",
  );
}

// Test 3: Critical severity
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "bug",
    "critical",
    "Database crashes on startup",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "urgent-attention",
    "Critical should need urgent attention",
  );
  assert.strictEqual(
    result.priority,
    "urgent",
    "Critical should be urgent priority",
  );
  assert.ok(
    result.reasoning.includes("Critical severity"),
    "Reasoning should mention critical",
  );
  assert.ok(
    result.reasoning.includes("Database crashes on startup"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ Critical severity → urgent-attention (urgent)");
}

// Test 4: High severity bug
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "bug",
    "high",
    "Authentication failing for OAuth users",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "urgent-attention",
    "High severity should need urgent attention",
  );
  assert.strictEqual(
    result.priority,
    "high",
    "High severity should be high priority",
  );
  assert.ok(
    result.reasoning.includes("High severity"),
    "Reasoning should mention high",
  );
  assert.ok(
    result.reasoning.includes("Authentication failing"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ High severity bug → urgent-attention (high)");
}

// Test 5: Documentation issue
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "documentation",
    "medium",
    "Installation guide missing Redis setup",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "route-to-docs",
    "Documentation should route to docs",
  );
  assert.strictEqual(
    result.priority,
    "medium",
    "Documentation should be medium priority",
  );
  assert.ok(
    result.reasoning.includes("Documentation issue"),
    "Reasoning should mention documentation",
  );
  assert.ok(
    result.reasoning.includes("Installation guide missing"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ Documentation type → route-to-docs");
}

// Test 6: Question
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "question",
    "none",
    "User asking how to configure SSL",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "request-info",
    "Question should request info",
  );
  assert.strictEqual(result.priority, "low", "Question should be low priority");
  assert.ok(
    result.reasoning.includes("Question requires clarification"),
    "Reasoning should mention question",
  );
  assert.ok(
    result.reasoning.includes("User asking how to configure"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ Question type → request-info");
}

// Test 7: Plain feature with medium severity
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "feature",
    "medium",
    "Request for dark mode support",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "notify-only",
    "Standard feature should be notify-only",
  );
  assert.strictEqual(
    result.priority,
    "medium",
    "Medium severity should be medium priority",
  );
  assert.ok(
    result.reasoning.includes("Standard issue"),
    "Reasoning should mention standard issue",
  );
  assert.ok(
    result.reasoning.includes("Request for dark mode"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ Plain feature (medium) → notify-only (medium)");
}

// Test 8: Plain feature with low severity
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "feature",
    "low",
    "Minor UI polish request",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "notify-only",
    "Standard feature should be notify-only",
  );
  assert.strictEqual(
    result.priority,
    "low",
    "Low severity should be low priority",
  );
  assert.ok(
    result.reasoning.includes("Standard issue"),
    "Reasoning should mention standard issue",
  );
  assert.ok(
    result.reasoning.includes("Minor UI polish"),
    "Reasoning should include classification reasoning",
  );
  console.log("✓ Plain feature (low) → notify-only (low)");
}

// EDGE CASE 1: Spam classified as critical
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "spam",
    "critical",
    "Crypto scam detected",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "flag-spam",
    "Spam should flag as spam even if critical",
  );
  assert.strictEqual(
    result.priority,
    "low",
    "Spam should be low priority regardless of severity",
  );
  console.log("✓ Critical spam → flag-spam (rule 1 wins over rule 3)");
}

// EDGE CASE 2: Duplicate classified as high severity
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "duplicate",
    "high",
    "Similar to high-priority issue reported last week",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "flag-duplicate",
    "Duplicate should flag as duplicate even if high severity",
  );
  assert.strictEqual(
    result.metadata.needs_embedding_check,
    true,
    "Duplicate should still set embedding check metadata",
  );
  console.log("✓ High-severity duplicate → flag-duplicate (rule 2 wins over rule 4)");
}

// EDGE CASE 3: Documentation marked critical
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "documentation",
    "critical",
    "Missing security warning in docs",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "urgent-attention",
    "Critical severity should override documentation type",
  );
  assert.strictEqual(
    result.priority,
    "urgent",
    "Critical severity should be urgent priority",
  );
  console.log("✓ Critical documentation → urgent-attention (rule 3 wins over rule 5)");
}

// EDGE CASE 4: Bug with severity 'none' (unusual but valid)
{
  const issue = createFakeIssue();
  const classification = createFakeClassification(
    "bug",
    "none",
    "Misclassified or edge case bug",
  );
  const result = decideTriageActions({ issue, classification });

  assert.strictEqual(
    result.type,
    "notify-only",
    "Bug with 'none' severity should fall to default",
  );
  assert.strictEqual(
    result.priority,
    "low",
    "Severity 'none' should map to low priority",
  );
  console.log("✓ Bug with 'none' severity → notify-only/low (falls to default)");
}

console.log("\n✓ All Layer 5 Block A tests passed");
