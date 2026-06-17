import * as dotenv from "dotenv";
import * as path from "path";
import { strict as assert } from "node:assert";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getSupabaseClient } from "../src/db/client";
import { upsertUserByGithubId } from "../src/db/users";
import { upsertInstallation } from "../src/db/installations";
import { upsertRepo } from "../src/db/repos";
import {
  upsertIssue,
  updateIssueEmbedding,
  findSimilarIssues,
} from "../src/db/issues";
import {
  embedIssueForStorage,
  embedIssueForSearch,
} from "../src/integrations/llm/embed";

const TEST_GITHUB_USER_ID = 888888;
const TEST_GITHUB_INSTALLATION_ID = 888888;
const TEST_GITHUB_REPO_ID = 888888;

async function cleanup() {
  console.log("Cleaning up test data...");
  const supabase = getSupabaseClient();

  // Delete in FK dependency order
  await supabase.from("issues").delete().eq("github_issue_id", 888888);
  await supabase.from("issues").delete().eq("github_issue_id", 888889);
  await supabase.from("issues").delete().eq("github_issue_id", 888890);
  await supabase.from("repos").delete().eq("github_repo_id", TEST_GITHUB_REPO_ID);
  await supabase
    .from("installations")
    .delete()
    .eq("github_installation_id", TEST_GITHUB_INSTALLATION_ID);
  await supabase.from("users").delete().eq("github_id", TEST_GITHUB_USER_ID);

  console.log("✓ Cleanup complete\n");
}

async function main() {
  console.log("Testing Layer 6 Block C: Similarity Search\n");

  try {
    // PRE-CLEANUP
    await cleanup();

    // SETUP: Create test user/installation/repo
    console.log("Setting up test data...");
    const user = await upsertUserByGithubId({
      github_id: TEST_GITHUB_USER_ID,
      github_username: "test-layer-6c-user",
    });

    const installation = await upsertInstallation({
      user_id: user.id,
      github_installation_id: TEST_GITHUB_INSTALLATION_ID,
      github_account_login: "test-layer-6c-user",
      github_account_id: TEST_GITHUB_USER_ID,
      github_account_type: "User",
      github_target_type: "all",
    });

    const repo = await upsertRepo({
      installation_id: installation.id,
      github_repo_id: TEST_GITHUB_REPO_ID,
      github_full_name: "test-layer-6c-user/test-repo",
      github_default_branch: "main",
      github_private: false,
      star_count: 0,
      issue_count_open: 3,
      language_primary: "TypeScript",
      description: "Test repo for similarity search",
    });

    console.log(`✓ Created test repo: ${repo.github_full_name}\n`);

    // INSERT THREE ISSUES with embeddings
    console.log("Creating test issues with embeddings...");

    // Issue A: Database connection timeout
    const issueAData = await upsertIssue({
      repo_id: repo.id,
      github_issue_id: 888888,
      github_issue_number: 1,
      github_node_id: "test-node-id-888888",
      title: "Database connection drops after timeout",
      body: "All queries fail after 5 minutes of idle time",
      state: "open",
      author_github_id: TEST_GITHUB_USER_ID,
      author_github_login: "test-layer-6c-user",
      author_association: "OWNER",
      labels: [],
      assignees: [],
      comments_count: 0,
      reactions: {},
      is_pull_request: false,
      github_created_at: new Date().toISOString(),
      github_updated_at: new Date().toISOString(),
      github_closed_at: null,
    });

    const embedA = await embedIssueForStorage({
      title: issueAData.title,
      body: issueAData.body,
    });
    await updateIssueEmbedding(issueAData.id, embedA.embedding, embedA.model);
    console.log(`✓ Created Issue A: "${issueAData.title}"`);

    // Issue B: Similar to A (DB connection idle)
    const issueBData = await upsertIssue({
      repo_id: repo.id,
      github_issue_id: 888889,
      github_issue_number: 2,
      github_node_id: "test-node-id-888889",
      title: "DB connection failing on long idle periods",
      body: "After being idle for several minutes, connections die",
      state: "open",
      author_github_id: TEST_GITHUB_USER_ID,
      author_github_login: "test-layer-6c-user",
      author_association: "OWNER",
      labels: [],
      assignees: [],
      comments_count: 0,
      reactions: {},
      is_pull_request: false,
      github_created_at: new Date().toISOString(),
      github_updated_at: new Date().toISOString(),
      github_closed_at: null,
    });

    const embedB = await embedIssueForStorage({
      title: issueBData.title,
      body: issueBData.body,
    });
    await updateIssueEmbedding(issueBData.id, embedB.embedding, embedB.model);
    console.log(`✓ Created Issue B: "${issueBData.title}"`);

    // Issue C: Unrelated (dark mode feature)
    const issueCData = await upsertIssue({
      repo_id: repo.id,
      github_issue_id: 888890,
      github_issue_number: 3,
      github_node_id: "test-node-id-888890",
      title: "Add dark mode to settings",
      body: "Would be nice to have a dark theme option",
      state: "open",
      author_github_id: TEST_GITHUB_USER_ID,
      author_github_login: "test-layer-6c-user",
      author_association: "OWNER",
      labels: [],
      assignees: [],
      comments_count: 0,
      reactions: {},
      is_pull_request: false,
      github_created_at: new Date().toISOString(),
      github_updated_at: new Date().toISOString(),
      github_closed_at: null,
    });

    const embedC = await embedIssueForStorage({
      title: issueCData.title,
      body: issueCData.body,
    });
    await updateIssueEmbedding(issueCData.id, embedC.embedding, embedC.model);
    console.log(`✓ Created Issue C: "${issueCData.title}"\n`);

    // TEST 1: Search for similar issues using Issue A's content as query
    console.log("Test 1: Finding semantically similar issues");
    const queryEmbed = await embedIssueForSearch({
      title: issueAData.title,
      body: issueAData.body,
    });

    const similarIssues = await findSimilarIssues({
      repoId: repo.id,
      embedding: queryEmbed.embedding,
      similarityThreshold: 0.6,
      limit: 5,
      excludeIssueId: issueAData.id,
    });

    console.log(`  Found ${similarIssues.length} similar issues:`);
    for (const issue of similarIssues) {
      console.log(
        `    - Issue #${issue.github_issue_number}: "${issue.title}" (similarity: ${issue.similarity.toFixed(4)})`,
      );
    }

    // Assert: result contains Issue B
    const containsB = similarIssues.some((i) => i.id === issueBData.id);
    assert(
      containsB,
      "Expected similar issues to contain Issue B (semantically similar)",
    );

    // Assert: result does NOT contain Issue A (excluded)
    const containsA = similarIssues.some((i) => i.id === issueAData.id);
    assert(
      !containsA,
      "Expected similar issues to NOT contain Issue A (excluded)",
    );

    // Assert: result does NOT contain Issue C (below threshold)
    const containsC = similarIssues.some((i) => i.id === issueCData.id);
    assert(
      !containsC,
      "Expected similar issues to NOT contain Issue C (different topic)",
    );

    console.log(
      "✓ findSimilarIssues correctly identifies semantic duplicates\n",
    );

    // TEST 2: Strict threshold filtering
    console.log("Test 2: Strict similarity threshold");
    const strictResults = await findSimilarIssues({
      repoId: repo.id,
      embedding: queryEmbed.embedding,
      similarityThreshold: 0.99,
      limit: 5,
      excludeIssueId: issueAData.id,
    });

    console.log(`  Found ${strictResults.length} issues with threshold 0.99`);
    assert(
      strictResults.length === 0,
      "Expected no results with very strict threshold (0.99)",
    );
    console.log("✓ Strict threshold filters out non-exact matches\n");

    console.log("✓ All Layer 6 Block C tests passed");
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  } finally {
    // Always cleanup
    await cleanup();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
