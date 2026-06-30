import * as dotenv from "dotenv";
import * as path from "path";
import { draftPRResponse } from "../src/integrations/llm/draft";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Testing Layer 8 Block D: PR Draft Generation\n");

  // Test 1: approve-merge
  console.log("Test 1: approve-merge (dependency bump)");
  try {
    const result1 = await draftPRResponse({
      prTitle: "Bump axios from 1.6.0 to 1.7.2",
      prBody: "Bumps axios from 1.6.0 to 1.7.2. Release notes available at https://github.com/axios/axios/releases.",
      repoFullName: "test/repo",
      prAuthor: "dependabot",
      classificationType: "dependency-bump",
      classificationRisk: "low",
      classificationReasoning: "Minor version bump via Dependabot",
      recommendationType: "approve-merge",
      additions: 3,
      deletions: 3,
      changedFiles: 2,
    });

    if (result1.draft.draft_content.length <= 20) {
      throw new Error(
        `Expected draft_content length > 20, got ${result1.draft.draft_content.length}`,
      );
    }
    if (result1.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result1.draft.confidence}`,
      );
    }

    console.log("✓ approve-merge draft generated successfully");
    console.log(`  Confidence: ${result1.draft.confidence.toFixed(2)}`);
    console.log(`  Draft: "${result1.draft.draft_content}"`);
    console.log(
      `  Tokens: ${result1.tokenCountInput} in, ${result1.tokenCountOutput} out\n`,
    );
  } catch (error) {
    console.error("Test 1 failed:", error);
    throw error;
  }

  await sleep(2000); // Wait 2s between tests to reduce API load

  // Test 2: request-review
  console.log("Test 2: request-review (high-risk feature)");
  try {
    const result2 = await draftPRResponse({
      prTitle: "Add OAuth support for Google/GitHub providers",
      prBody: "Implements OAuth flow for Google and GitHub providers. Adds new /auth routes, updates the user model.",
      repoFullName: "test/repo",
      prAuthor: "contributor",
      classificationType: "feature-addition",
      classificationRisk: "high",
      classificationReasoning: "Auth-sensitive change with significant surface area",
      recommendationType: "request-review",
      additions: 432,
      deletions: 12,
      changedFiles: 14,
    });

    if (result2.draft.draft_content.length <= 20) {
      throw new Error(
        `Expected draft_content length > 20, got ${result2.draft.draft_content.length}`,
      );
    }
    if (result2.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result2.draft.confidence}`,
      );
    }

    console.log("✓ request-review draft generated successfully");
    console.log(`  Confidence: ${result2.draft.confidence.toFixed(2)}`);
    console.log(`  Draft: "${result2.draft.draft_content}"`);
    console.log(
      `  Tokens: ${result2.tokenCountInput} in, ${result2.tokenCountOutput} out\n`,
    );
  } catch (error) {
    console.error("Test 2 failed:", error);
    throw error;
  }

  await sleep(2000); // Wait 2s between tests to reduce API load

  // Test 3: request-changes
  console.log("Test 3: request-changes (missing test coverage)");
  try {
    const result3 = await draftPRResponse({
      prTitle: "Fix login bug",
      prBody: "This fixes the login issue.",
      repoFullName: "test/repo",
      prAuthor: "contributor",
      classificationType: "bug-fix",
      classificationRisk: "medium",
      classificationReasoning: "Bug fix but missing test coverage and reproduction",
      recommendationType: "request-changes",
      additions: 25,
      deletions: 10,
      changedFiles: 3,
    });

    if (result3.draft.draft_content.length <= 20) {
      throw new Error(
        `Expected draft_content length > 20, got ${result3.draft.draft_content.length}`,
      );
    }
    if (result3.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result3.draft.confidence}`,
      );
    }

    console.log("✓ request-changes draft generated successfully");
    console.log(`  Confidence: ${result3.draft.confidence.toFixed(2)}`);
    console.log(`  Draft: "${result3.draft.draft_content}"`);
    console.log(
      `  Tokens: ${result3.tokenCountInput} in, ${result3.tokenCountOutput} out\n`,
    );
  } catch (error) {
    console.error("Test 3 failed:", error);
    throw error;
  }

  await sleep(2000); // Wait 2s between tests to reduce API load

  // Test 4: close-as-stale
  console.log("Test 4: close-as-stale (inactive WIP)");
  try {
    const result4 = await draftPRResponse({
      prTitle: "WIP: experimental refactor",
      prBody: "Trying a new approach to the data layer. Don't merge yet.",
      repoFullName: "test/repo",
      prAuthor: "contributor",
      classificationType: "wip",
      classificationRisk: "medium",
      classificationReasoning: "Inactive WIP from months ago",
      recommendationType: "close-as-stale",
      additions: 200,
      deletions: 150,
      changedFiles: 20,
    });

    if (result4.draft.draft_content.length <= 20) {
      throw new Error(
        `Expected draft_content length > 20, got ${result4.draft.draft_content.length}`,
      );
    }
    if (result4.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result4.draft.confidence}`,
      );
    }

    console.log("✓ close-as-stale draft generated successfully");
    console.log(`  Confidence: ${result4.draft.confidence.toFixed(2)}`);
    console.log(`  Draft: "${result4.draft.draft_content}"`);
    console.log(
      `  Tokens: ${result4.tokenCountInput} in, ${result4.tokenCountOutput} out\n`,
    );
  } catch (error) {
    console.error("Test 4 failed:", error);
    throw error;
  }

  await sleep(2000); // Wait 2s between tests to reduce API load

  // Test 5: notify-only
  console.log("Test 5: notify-only (low-impact refactor)");
  try {
    const result5 = await draftPRResponse({
      prTitle: "Small refactor of helper function",
      prBody: "Extracts validation logic into a separate helper for readability.",
      repoFullName: "test/repo",
      prAuthor: "contributor",
      classificationType: "refactor",
      classificationRisk: "low",
      classificationReasoning: "Internal cleanup, low impact",
      recommendationType: "notify-only",
      additions: 30,
      deletions: 25,
      changedFiles: 4,
    });

    if (result5.draft.draft_content.length <= 20) {
      throw new Error(
        `Expected draft_content length > 20, got ${result5.draft.draft_content.length}`,
      );
    }
    if (result5.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result5.draft.confidence}`,
      );
    }

    console.log("✓ notify-only draft generated successfully");
    console.log(`  Confidence: ${result5.draft.confidence.toFixed(2)}`);
    console.log(`  Draft: "${result5.draft.draft_content}"`);
    console.log(
      `  Tokens: ${result5.tokenCountInput} in, ${result5.tokenCountOutput} out\n`,
    );
  } catch (error) {
    console.error("Test 5 failed:", error);
    throw error;
  }

  console.log("✓ All Layer 8 Block D tests passed");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
