import { config } from "dotenv";
import { strict as assert } from "node:assert";

// Load environment variables from .env.local
config({ path: ".env.local" });

import { getSupabaseClient } from "../src/db/client";
import { getUserByGithubId, upsertUserByGithubId } from "../src/db/users";
import {
  getInstallationByGithubId,
  upsertInstallation,
} from "../src/db/installations";
import { getRepoByGithubId, upsertRepo } from "../src/db/repos";
import { getIssueByGithubId, upsertIssue } from "../src/db/issues";
import {
  getNotificationTargetForRepo,
  insertNotificationTarget,
} from "../src/db/notification_targets";

// Fixed test IDs to avoid collision with real data
const TEST_DATA = {
  github_user_id: 999999,
  github_username: "triage-test-user-do-not-use",
  github_username_updated: "triage-test-user-updated",
  github_installation_id: 999999,
  github_repo_id: 999999,
  github_repo_full_name: "triage-test-user-do-not-use/test-repo",
  github_issue_id: 999999,
  github_issue_number: 1,
  github_node_id: "test-node-999999",
};

// Store IDs for cleanup
let userId: string | undefined;
let installationId: string | undefined;
let repoId: string | undefined;
let issueId: string | undefined;

async function preCleanup(): Promise<void> {
  console.log("\n🧹 PRE-CLEANUP: Removing any leftover test data...");
  const supabase = getSupabaseClient();

  await supabase
    .from("notification_targets")
    .delete()
    .eq("credentials_ref", "test_default");
  await supabase
    .from("notification_targets")
    .delete()
    .eq("credentials_ref", "test_override");
  await supabase.from("issues").delete().eq("github_issue_id", TEST_DATA.github_issue_id);
  await supabase.from("repos").delete().eq("github_repo_id", TEST_DATA.github_repo_id);
  await supabase
    .from("installations")
    .delete()
    .eq("github_installation_id", TEST_DATA.github_installation_id);
  await supabase.from("users").delete().eq("github_id", TEST_DATA.github_user_id);

  console.log("  ✓ Cleanup complete\n");
}

async function cleanup(): Promise<void> {
  console.log("\n🧹 CLEANUP: Hard-deleting test data...");
  const supabase = getSupabaseClient();

  if (userId) {
    await supabase.from("notification_targets").delete().eq("user_id", userId);
  }
  if (issueId) {
    await supabase.from("issues").delete().eq("id", issueId);
  }
  if (repoId) {
    await supabase.from("repos").delete().eq("id", repoId);
  }
  if (installationId) {
    await supabase.from("installations").delete().eq("id", installationId);
  }
  if (userId) {
    await supabase.from("users").delete().eq("id", userId);
  }

  console.log("  ✓ Cleanup complete");
}

async function test1_InsertAndReadUser(): Promise<void> {
  console.log("TEST 1: Insert and read a user");

  // Insert user
  const insertedUser = await upsertUserByGithubId({
    github_id: TEST_DATA.github_user_id,
    github_username: TEST_DATA.github_username,
  });

  assert.equal(
    insertedUser.github_id,
    TEST_DATA.github_user_id,
    "Inserted user should have expected github_id",
  );
  assert.equal(
    insertedUser.github_username,
    TEST_DATA.github_username,
    "Inserted user should have expected github_username",
  );
  console.log("  ✓ User inserted successfully");

  // Save user ID for later tests
  userId = insertedUser.id;

  // Read user back
  const fetchedUser = await getUserByGithubId(TEST_DATA.github_user_id);
  assert.notEqual(
    fetchedUser,
    null,
    "getUserByGithubId should return the user",
  );
  assert.equal(fetchedUser!.id, insertedUser.id, "Fetched user ID should match");
  assert.equal(
    fetchedUser!.github_username,
    TEST_DATA.github_username,
    "Fetched username should match",
  );
  console.log("  ✓ User fetched successfully\n");
}

async function test2_UpsertIdempotency(): Promise<void> {
  console.log("TEST 2: Upsert idempotency");

  const originalUserId = userId;

  // Upsert with updated username
  const updatedUser = await upsertUserByGithubId({
    github_id: TEST_DATA.github_user_id,
    github_username: TEST_DATA.github_username_updated,
  });

  assert.equal(
    updatedUser.id,
    originalUserId,
    "Upsert should update existing user, not create a new one",
  );
  assert.equal(
    updatedUser.github_username,
    TEST_DATA.github_username_updated,
    "Username should be updated",
  );
  console.log("  ✓ Upsert updated existing user without creating duplicate\n");
}

async function test3_ForeignKeyChain(): Promise<void> {
  console.log("TEST 3: Foreign key chain - installation, repo, issue");

  // Insert installation
  const insertedInstallation = await upsertInstallation({
    user_id: userId!,
    github_installation_id: TEST_DATA.github_installation_id,
    github_account_login: TEST_DATA.github_username_updated,
    github_account_id: TEST_DATA.github_user_id,
    github_account_type: "User",
    github_target_type: "all",
  });

  installationId = insertedInstallation.id;

  const fetchedInstallation = await getInstallationByGithubId(
    TEST_DATA.github_installation_id,
  );
  assert.notEqual(
    fetchedInstallation,
    null,
    "Installation should be fetchable",
  );
  assert.equal(
    fetchedInstallation!.id,
    installationId,
    "Fetched installation ID should match",
  );
  console.log("  ✓ Installation created and fetched");

  // Insert repo
  const insertedRepo = await upsertRepo({
    installation_id: installationId,
    github_repo_id: TEST_DATA.github_repo_id,
    github_full_name: TEST_DATA.github_repo_full_name,
  });

  repoId = insertedRepo.id;

  const fetchedRepo = await getRepoByGithubId(TEST_DATA.github_repo_id);
  assert.notEqual(fetchedRepo, null, "Repo should be fetchable");
  assert.equal(fetchedRepo!.id, repoId, "Fetched repo ID should match");
  console.log("  ✓ Repo created and fetched");

  // Insert issue
  const now = new Date().toISOString();
  const insertedIssue = await upsertIssue({
    repo_id: repoId,
    github_issue_id: TEST_DATA.github_issue_id,
    github_issue_number: TEST_DATA.github_issue_number,
    github_node_id: TEST_DATA.github_node_id,
    title: "Test issue",
    state: "open",
    author_github_id: TEST_DATA.github_user_id,
    author_github_login: TEST_DATA.github_username_updated,
    author_association: "OWNER",
    github_created_at: now,
    github_updated_at: now,
  });

  issueId = insertedIssue.id;

  const fetchedIssue = await getIssueByGithubId(TEST_DATA.github_issue_id);
  assert.notEqual(fetchedIssue, null, "Issue should be fetchable");
  assert.equal(fetchedIssue!.id, issueId, "Fetched issue ID should match");
  assert.equal(fetchedIssue!.title, "Test issue", "Issue title should match");
  console.log("  ✓ Issue created and fetched\n");
}

async function test4_HybridNotificationLookup(): Promise<void> {
  console.log("TEST 4: Hybrid notification target lookup");

  // Insert default notification target (repo_id is NULL)
  const defaultTarget = await insertNotificationTarget({
    user_id: userId!,
    repo_id: null,
    platform: "slack",
    config: { workspace_id: "TXXX", channel_id: "CXXX" },
    credentials_ref: "test_default",
    is_active: true,
  });

  console.log("  ✓ Default notification target created");

  // Fetch should return default target
  const fetchedDefault = await getNotificationTargetForRepo(
    userId!,
    repoId!,
    "slack",
  );
  assert.notEqual(
    fetchedDefault,
    null,
    "Should find default notification target",
  );
  assert.equal(
    fetchedDefault!.credentials_ref,
    "test_default",
    "Should return default target",
  );
  console.log("  ✓ Hybrid lookup returned default target (no override exists)");

  // Insert repo-specific override
  const overrideTarget = await insertNotificationTarget({
    user_id: userId!,
    repo_id: repoId!,
    platform: "slack",
    config: { workspace_id: "TYYY", channel_id: "CYYY" },
    credentials_ref: "test_override",
    is_active: true,
  });

  console.log("  ✓ Override notification target created");

  // Fetch should now return override target
  const fetchedOverride = await getNotificationTargetForRepo(
    userId!,
    repoId!,
    "slack",
  );
  assert.notEqual(
    fetchedOverride,
    null,
    "Should find override notification target",
  );
  assert.equal(
    fetchedOverride!.credentials_ref,
    "test_override",
    "Should return override target, not default",
  );
  console.log(
    "  ✓ Hybrid lookup returned override target (prefers repo-specific)\n",
  );
}

async function test5_SoftDeletePreventsReads(): Promise<void> {
  console.log("TEST 5: Soft-delete prevents future reads");

  const supabase = getSupabaseClient();

  // Soft-delete the user
  await supabase
    .from("users")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId!);

  console.log("  ✓ User soft-deleted");

  // Try to fetch - should return null
  const fetchedUser = await getUserByGithubId(TEST_DATA.github_user_id);
  assert.equal(
    fetchedUser,
    null,
    "getUserByGithubId should return null for soft-deleted user",
  );
  console.log("  ✓ Soft-deleted user correctly excluded from reads\n");
}

async function main(): Promise<void> {
  console.log("🧪 Starting Layer 2 Database Tests\n");

  try {
    await preCleanup();
    await test1_InsertAndReadUser();
    await test2_UpsertIdempotency();
    await test3_ForeignKeyChain();
    await test4_HybridNotificationLookup();
    await test5_SoftDeletePreventsReads();
    await cleanup();

    console.log("\n✅ All Layer 2 tests passed\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.log("\nAttempting cleanup after failure...");
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error("Cleanup also failed:", cleanupError);
    }
    throw error;
  }
}

main();
