import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { postIssueComment } from "../src/integrations/github/post_comment";
import { getSupabaseClient } from "../src/db/client";

async function testPostComment() {
  console.log("\n=== Testing Layer 7 Block F: postIssueComment ===\n");

  const supabase = getSupabaseClient();

  // Step 1: Fetch the most recent issue from Arushi2121/test-for-triage
  console.log("Fetching most recent issue from Arushi2121/test-for-triage...");

  const { data: issues, error: issuesError } = await supabase
    .from("issues")
    .select(
      `
      id,
      github_issue_number,
      repo_id,
      repos!inner (
        github_full_name,
        installation_id,
        installations!inner (
          github_installation_id
        )
      )
    `,
    )
    .eq("repos.github_full_name", "Arushi2121/test-for-triage")
    .order("github_created_at", { ascending: false })
    .limit(1);

  if (issuesError) {
    console.error("❌ Failed to fetch issue:", issuesError.message);
    process.exit(1);
  }

  if (!issues || issues.length === 0) {
    console.error(
      "❌ No issues found for Arushi2121/test-for-triage. Create a test issue first.",
    );
    process.exit(1);
  }

  const issue = issues[0];
  const repo = Array.isArray(issue.repos) ? issue.repos[0] : issue.repos;
  const installation = Array.isArray(repo.installations)
    ? repo.installations[0]
    : repo.installations;

  const issueNumber = issue.github_issue_number;
  const repoFullName = repo.github_full_name;
  const installationId = installation.github_installation_id;

  console.log(`✓ Using issue #${issueNumber} from ${repoFullName}`);

  // Step 2: Split repo name into owner and repo
  const [owner, repoName] = repoFullName.split("/");

  // Step 3: Post a test comment
  console.log("\nPosting test comment...");

  try {
    const result = await postIssueComment({
      installationId,
      owner,
      repo: repoName,
      issueNumber,
      draftContent:
        "Hello from Triage Block F test. If you see this comment with attribution, the posting infrastructure works.",
      maintainerHandle: "Arushi2121",
    });

    console.log(`✓ Posted comment to issue #${issueNumber}`);
    console.log(`  Comment ID: ${result.commentId}`);
    console.log(`  URL: ${result.commentUrl}`);
  } catch (error) {
    console.error("❌ Failed to post comment:", error);
    process.exit(1);
  }

  console.log("\n✓ All Layer 7 Block F tests passed\n");
}

testPostComment();
