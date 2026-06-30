import * as dotenv from "dotenv";
import * as path from "path";
import { classifyPR } from "../src/integrations/llm/classify";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TestCase {
  name: string;
  expectedType: string;
  prTitle: string;
  prBody: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDraft: boolean;
}

const testCases: TestCase[] = [
  {
    name: "bug-fix",
    expectedType: "bug-fix",
    prTitle: "Fix null pointer in getUserById",
    prBody: "Fixes #123. Added null check.",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    isDraft: false,
  },
  {
    name: "feature-addition",
    expectedType: "feature-addition",
    prTitle: "Add export to CSV button",
    prBody: "New button on admin panel to export users as CSV.",
    additions: 85,
    deletions: 3,
    changedFiles: 4,
    isDraft: false,
  },
  {
    name: "docs-only",
    expectedType: "docs-only",
    prTitle: "Update README with installation steps",
    prBody: "Adds step-by-step setup instructions.",
    additions: 42,
    deletions: 8,
    changedFiles: 1,
    isDraft: false,
  },
  {
    name: "refactor",
    expectedType: "refactor",
    prTitle: "Extract user validation into separate module",
    prBody: "Moves validation logic from controllers to a dedicated utils/validators module.",
    additions: 120,
    deletions: 95,
    changedFiles: 8,
    isDraft: false,
  },
  {
    name: "dependency-bump",
    expectedType: "dependency-bump",
    prTitle: "Bump lodash from 4.17.15 to 4.17.21",
    prBody: "Bumps lodash via npm audit fix.",
    additions: 2,
    deletions: 2,
    changedFiles: 2,
    isDraft: false,
  },
  {
    name: "breaking-change",
    expectedType: "breaking-change",
    prTitle: "Remove deprecated /api/v1 endpoints",
    prBody: "v1 API has been deprecated since 2024. Removing all /api/v1/* routes. v2 has been available since 2023.",
    additions: 12,
    deletions: 156,
    changedFiles: 14,
    isDraft: false,
  },
  {
    name: "chore",
    expectedType: "chore",
    prTitle: "Fix ESLint config for TypeScript files",
    prBody: "Updates .eslintrc to handle .ts files correctly.",
    additions: 8,
    deletions: 4,
    changedFiles: 1,
    isDraft: false,
  },
  {
    name: "wip",
    expectedType: "wip",
    prTitle: "[WIP] Trying new database driver",
    prBody: "Experimenting with a new postgres driver. Don't merge.",
    additions: 200,
    deletions: 50,
    changedFiles: 12,
    isDraft: true,
  },
];

async function main() {
  console.log("Testing Layer 8 Block B: PR Classification\n");

  let passCount = 0;
  let failCount = 0;
  const failures: Array<{ name: string; expected: string; actual: string; reasoning: string }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}: ${testCase.name}`);

    try {
      const result = await classifyPR({
        prTitle: testCase.prTitle,
        prBody: testCase.prBody,
        repoFullName: "test/repo",
        additions: testCase.additions,
        deletions: testCase.deletions,
        changedFiles: testCase.changedFiles,
        isDraft: testCase.isDraft,
      });

      const actualType = result.classification.pr_type;
      const risk = result.classification.risk;
      const confidence = result.classification.confidence;
      const reasoning = result.classification.reasoning;

      if (confidence <= 0.5) {
        throw new Error(`Expected confidence > 0.5, got ${confidence}`);
      }

      if (actualType === testCase.expectedType) {
        console.log(`✓ ${testCase.expectedType}: classified as ${actualType} / ${risk} (confidence: ${confidence.toFixed(2)})`);
        passCount++;
      } else {
        console.log(`✗ ${testCase.expectedType}: classified as ${actualType} / ${risk} (confidence: ${confidence.toFixed(2)})`);
        console.log(`  Reasoning: ${reasoning}`);
        failCount++;
        failures.push({
          name: testCase.name,
          expected: testCase.expectedType,
          actual: actualType,
          reasoning: reasoning,
        });
      }

      console.log(`  Tokens: ${result.tokenCountInput} in, ${result.tokenCountOutput} out\n`);
    } catch (error) {
      console.error(`✗ Test ${i + 1} (${testCase.name}) failed with error:`, error);
      failCount++;
      failures.push({
        name: testCase.name,
        expected: testCase.expectedType,
        actual: "ERROR",
        reasoning: error instanceof Error ? error.message : String(error),
      });
    }

    // Wait 2s between tests to reduce API load
    if (i < testCases.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\nResults: ${passCount}/${testCases.length} tests passed`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((failure) => {
      console.log(`  - ${failure.name}: expected ${failure.expected}, got ${failure.actual}`);
      console.log(`    Reasoning: ${failure.reasoning}`);
    });
  }

  if (passCount >= 6) {
    console.log("\n✓ All Layer 8 Block B tests passed (at least 6/8 correct)");
    process.exit(0);
  } else {
    console.log(`\n✗ Only ${passCount}/8 tests passed, expected at least 6`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
