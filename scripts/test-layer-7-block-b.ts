import * as dotenv from "dotenv";
import * as path from "path";
import { draftResponse } from "../src/integrations/llm/draft";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Testing Layer 7 Block B: Draft Generation\n");

  // Test 1: request-info
  console.log("Test 1: request-info");
  try {
    const result1 = await draftResponse({
      issueTitle: "Build fails on macOS",
      issueBody: "I get an error when I run npm install",
      repoFullName: "test/repo",
      issueAuthor: "testuser",
      classificationType: "bug",
      classificationSeverity: "medium",
      classificationReasoning:
        "Vague bug report lacking reproduction details",
      recommendationType: "request-info",
    });

    if (result1.draft.draft_content.length <= 30) {
      throw new Error(
        `Expected draft_content length > 30, got ${result1.draft.draft_content.length}`,
      );
    }
    if (result1.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result1.draft.confidence}`,
      );
    }

    console.log("✓ request-info draft generated successfully");
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

  // Test 2: route-to-docs
  console.log("Test 2: route-to-docs");
  try {
    const result2 = await draftResponse({
      issueTitle: "How do I configure SSL?",
      issueBody: "I want to set up HTTPS",
      repoFullName: "test/repo",
      issueAuthor: "questioner",
      classificationType: "question",
      classificationSeverity: "none",
      classificationReasoning: "Documentation question",
      recommendationType: "route-to-docs",
    });

    if (result2.draft.draft_content.length <= 30) {
      throw new Error(
        `Expected draft_content length > 30, got ${result2.draft.draft_content.length}`,
      );
    }
    if (result2.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result2.draft.confidence}`,
      );
    }

    console.log("✓ route-to-docs draft generated successfully");
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

  // Test 3: flag-spam
  console.log("Test 3: flag-spam");
  try {
    const result3 = await draftResponse({
      issueTitle: "BUY CRYPTO NOW $$$",
      issueBody: "click here for amazing deals",
      repoFullName: "test/repo",
      issueAuthor: "spammer",
      classificationType: "spam",
      classificationSeverity: "none",
      classificationReasoning: "Off-topic promotional content",
      recommendationType: "flag-spam",
    });

    if (result3.draft.draft_content.length <= 30) {
      throw new Error(
        `Expected draft_content length > 30, got ${result3.draft.draft_content.length}`,
      );
    }
    if (result3.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result3.draft.confidence}`,
      );
    }

    console.log("✓ flag-spam draft generated successfully");
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

  // Test 4: flag-duplicate (WITH duplicateContext)
  console.log("Test 4: flag-duplicate (with context)");
  try {
    const result4 = await draftResponse({
      issueTitle: "App crashes on startup",
      issueBody: "When I launch the app it immediately crashes",
      repoFullName: "test/repo",
      issueAuthor: "reporter",
      classificationType: "duplicate",
      classificationSeverity: "high",
      classificationReasoning: "Similar to existing issue",
      recommendationType: "flag-duplicate",
      duplicateContext: {
        number: 42,
        title: "Startup crash on Linux",
      },
    });

    if (result4.draft.draft_content.length <= 30) {
      throw new Error(
        `Expected draft_content length > 30, got ${result4.draft.draft_content.length}`,
      );
    }
    if (result4.draft.confidence <= 0.5) {
      throw new Error(
        `Expected confidence > 0.5, got ${result4.draft.confidence}`,
      );
    }
    if (!result4.draft.draft_content.includes("#42")) {
      throw new Error("Expected draft to mention issue #42");
    }

    console.log("✓ flag-duplicate draft generated successfully");
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
  console.log("Test 5: notify-only");
  try {
    const result5 = await draftResponse({
      issueTitle: "Add light mode theme option",
      issueBody: "Would be nice to support light mode in addition to dark.",
      repoFullName: "test/repo",
      issueAuthor: "contributor",
      classificationType: "feature",
      classificationSeverity: "low",
      classificationReasoning: "Standard feature request",
      recommendationType: "notify-only",
    });

    if (result5.draft.draft_content.length <= 30) {
      throw new Error(
        `Expected draft_content length > 30, got ${result5.draft.draft_content.length}`,
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

  console.log("✓ All Layer 7 Block B tests passed");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
