import assert from "node:assert";
import type { Issue, Classification } from "@/types/db";
import { decideTriageActionsForPR } from "@/core/triage/decide";
import type { PRTriageContext } from "@/types/triage";

// Helper to create fake Issue object for PR
function createFakePRIssue(): Issue {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    repo_id: "22222222-2222-2222-2222-222222222222",
    github_issue_id: 12345,
    github_issue_number: 42,
    github_node_id: "PR_kwDOABCDEF",
    title: "Test PR",
    body: "Test body",
    state: "open",
    author_github_id: 99999,
    author_github_login: "testuser",
    author_association: "CONTRIBUTOR",
    labels: [],
    assignees: [],
    comments_count: 0,
    reactions: {},
    is_pull_request: true,
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
  confidence: number = 0.85,
): Classification {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    issue_id: "11111111-1111-1111-1111-111111111111",
    issue_type,
    severity,
    confidence,
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

async function main() {
  console.log("Testing Layer 8 Block C: PR-specific decide rules\n");

  // Test 1: Draft PR → notify-only
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "bug-fix",
      "medium",
      "Bug fix in draft state",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 10,
      deletions: 5,
      changedFiles: 2,
      isDraft: true,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "notify-only", "Draft PR should be notify-only");
    assert.strictEqual(result.priority, "low", "Draft PR should be low priority");
    assert.strictEqual(result.metadata.is_draft, true, "Metadata should mark as draft");
    console.log("✓ Test 1: Draft PR → notify-only (low)");
  }

  // Test 2: WIP classification → notify-only
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "wip",
      "medium",
      "Work in progress",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 50,
      deletions: 20,
      changedFiles: 5,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "notify-only", "WIP PR should be notify-only");
    assert.strictEqual(result.priority, "low", "WIP PR should be low priority");
    assert.strictEqual(result.metadata.wip, true, "Metadata should mark as WIP");
    console.log("✓ Test 2: WIP classification → notify-only (low)");
  }

  // Test 3: Breaking change → request-review, urgent
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "breaking-change",
      "critical",
      "Removes deprecated API",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 20,
      deletions: 50,
      changedFiles: 8,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "request-review", "Breaking change should request review");
    assert.strictEqual(result.priority, "urgent", "Breaking change should be urgent");
    assert.strictEqual(result.metadata.breaking, true, "Metadata should mark as breaking");
    console.log("✓ Test 3: Breaking change → request-review (urgent)");
  }

  // Test 4: Critical risk → request-review, urgent
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "feature-addition",
      "critical",
      "Touches auth system",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 100,
      deletions: 10,
      changedFiles: 12,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "request-review", "Critical risk should request review");
    assert.strictEqual(result.priority, "urgent", "Critical risk should be urgent");
    console.log("✓ Test 4: Critical risk → request-review (urgent)");
  }

  // Test 5: Large PR (600+ lines) → request-review, high
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "refactor",
      "medium",
      "Large refactor",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 400,
      deletions: 250,
      changedFiles: 15,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "request-review", "Large PR should request review");
    assert.strictEqual(result.priority, "high", "Large PR should be high priority");
    assert.strictEqual(result.metadata.large_pr, true, "Metadata should mark as large PR");
    assert.strictEqual(result.metadata.total_lines, 650, "Metadata should include total lines");
    console.log("✓ Test 5: Large PR (650 lines) → request-review (high)");
  }

  // Test 6: Dependency bump with low risk, high confidence → approve-merge
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "dependency-bump",
      "low",
      "Minor version bump",
      0.90,
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 2,
      deletions: 2,
      changedFiles: 2,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "approve-merge", "Dependency bump should approve merge");
    assert.strictEqual(result.priority, "low", "Dependency bump should be low priority");
    console.log("✓ Test 6: Dependency bump (low risk, high confidence) → approve-merge (low)");
  }

  // Test 7: Docs-only with none risk → approve-merge
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "docs-only",
      "none",
      "Typo fix in README",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 1,
      deletions: 1,
      changedFiles: 1,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "approve-merge", "Docs-only should approve merge");
    assert.strictEqual(result.priority, "low", "Docs-only should be low priority");
    console.log("✓ Test 7: Docs-only (none risk) → approve-merge (low)");
  }

  // Test 8: Chore with low risk → approve-merge
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "chore",
      "low",
      "CI config update",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 3,
      deletions: 2,
      changedFiles: 1,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "approve-merge", "Chore should approve merge");
    assert.strictEqual(result.priority, "low", "Chore should be low priority");
    console.log("✓ Test 8: Chore (low risk) → approve-merge (low)");
  }

  // Test 9: High severity feature → request-review, high
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "feature-addition",
      "high",
      "Core functionality change",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 120,
      deletions: 30,
      changedFiles: 8,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "request-review", "High severity should request review");
    assert.strictEqual(result.priority, "high", "High severity should be high priority");
    console.log("✓ Test 9: High severity feature → request-review (high)");
  }

  // Test 10: Bug-fix with medium risk → request-review, medium
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "bug-fix",
      "medium",
      "Fixes session issue",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 25,
      deletions: 10,
      changedFiles: 3,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "request-review", "Bug-fix should request review");
    assert.strictEqual(result.priority, "medium", "Bug-fix should be medium priority");
    console.log("✓ Test 10: Bug-fix (medium risk) → request-review (medium)");
  }

  // Test 11: Refactor with low risk (falls to default) → notify-only
  {
    const issue = createFakePRIssue();
    const classification = createFakeClassification(
      "refactor",
      "low",
      "Small code cleanup",
    );
    const context: PRTriageContext = {
      issue,
      classification,
      additions: 30,
      deletions: 25,
      changedFiles: 4,
      isDraft: false,
    };
    const result = await decideTriageActionsForPR(context);

    assert.strictEqual(result.type, "notify-only", "Low refactor should be notify-only");
    assert.strictEqual(result.priority, "low", "Low refactor should be low priority");
    console.log("✓ Test 11: Refactor (low risk) → notify-only (low)");
  }

  console.log("\n✓ All Layer 8 Block C tests passed");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
