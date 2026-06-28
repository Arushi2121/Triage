import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables before importing modules that need them
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getSupabaseClient } from "../src/db/client";
import { updateIssueEmbedding, findSimilarIssues, type SimilarIssue } from "../src/db/issues";
import { embedIssueForStorage } from "../src/integrations/llm/embed";

interface IssueRow {
  id: string;
  title: string;
  body: string | null;
  github_issue_number: number;
  repo_id: string;
}

interface Flags {
  dryRun: boolean;
  limit: number | null;
  repoId: string | null;
  skipReport: boolean;
}

interface DuplicatePair {
  issueA: {
    id: string;
    github_issue_number: number;
    title: string;
  };
  issueB: {
    id: string;
    github_issue_number: number;
    title: string;
  };
  similarity: number;
}

function parseFlags(): Flags {
  const args = process.argv.slice(2);
  const flags: Flags = {
    dryRun: false,
    limit: null,
    repoId: null,
    skipReport: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--skip-report") {
      flags.skipReport = true;
    } else if (arg === "--limit" && i + 1 < args.length) {
      const limitValue = parseInt(args[i + 1], 10);
      if (!isNaN(limitValue) && limitValue > 0) {
        flags.limit = limitValue;
        i++; // Skip next arg
      } else {
        console.error(`Invalid limit value: ${args[i + 1]}`);
        process.exit(1);
      }
    } else if (arg === "--repo-id" && i + 1 < args.length) {
      flags.repoId = args[i + 1];
      i++; // Skip next arg
    }
  }

  return flags;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function phase1Backfill(flags: Flags): Promise<{ successCount: number; errorCount: number }> {
  console.log("\n=== PHASE 1: EMBEDDING BACKFILL ===\n");
  console.log("Querying for issues missing embeddings...");
  const supabase = getSupabaseClient();

  let query = supabase
    .from("issues")
    .select("id, title, body, github_issue_number, repo_id")
    .is("embedding", null)
    .is("deleted_at", null)
    .order("github_created_at", { ascending: false });

  if (flags.repoId) {
    query = query.eq("repo_id", flags.repoId);
  }
  if (flags.limit) {
    query = query.limit(flags.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to query issues:", error.message);
    process.exit(1);
  }

  const issuesList: IssueRow[] = (data ?? []) as IssueRow[];
  console.log(`Found ${issuesList.length} issues missing embeddings\n`);

  if (issuesList.length === 0) {
    console.log("✓ No issues need embeddings.");
    return { successCount: 0, errorCount: 0 };
  }

  if (flags.dryRun) {
    console.log("DRY RUN: Would process these issues, but skipping actual embedding.");
    return { successCount: 0, errorCount: 0 };
  }

  // Process in batches
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 1000;
  const batches: IssueRow[][] = [];

  for (let i = 0; i < issuesList.length; i += BATCH_SIZE) {
    batches.push(issuesList.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Processing ${batches.length} batches of ${BATCH_SIZE} (last batch may be smaller)...\n`,
  );

  let successCount = 0;
  let errorCount = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // Process issues sequentially within the batch
    for (const issue of batch) {
      try {
        const embedResult = await embedIssueForStorage({
          title: issue.title,
          body: issue.body,
        });

        await updateIssueEmbedding(issue.id, embedResult.embedding, embedResult.model);

        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `  ERROR on issue ${issue.id.substring(0, 8)} (github #${issue.github_issue_number}): ${errorMsg}`,
        );
      }
    }

    console.log(
      `Batch ${batchIdx + 1}/${batches.length} done. Successes: ${successCount}, Errors: ${errorCount}`,
    );

    // Delay between batches (except after the last batch)
    if (batchIdx < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nEmbedding phase complete. Successes: ${successCount}, Errors: ${errorCount}`);
  return { successCount, errorCount };
}

async function phase2DuplicateAnalysis(flags: Flags): Promise<void> {
  console.log("\n=== PHASE 2: DUPLICATE ANALYSIS ===\n");

  const supabase = getSupabaseClient();

  // Determine which repos to analyze
  let repoQuery = supabase
    .from("issues")
    .select("repo_id")
    .not("embedding", "is", null)
    .is("deleted_at", null);

  if (flags.repoId) {
    repoQuery = repoQuery.eq("repo_id", flags.repoId);
  }

  const { data: repoData, error: repoError } = await repoQuery;

  if (repoError) {
    console.error("Failed to query repos:", repoError.message);
    process.exit(1);
  }

  const repoIds = Array.from(
    new Set((repoData ?? []).map((row: { repo_id: string }) => row.repo_id)),
  );

  console.log(`Analyzing ${repoIds.length} repos for duplicates...\n`);

  if (repoIds.length === 0) {
    console.log("No repos with embeddings found. Skipping duplicate analysis.");
    return;
  }

  // Fetch repo names
  const repoNamesMap = new Map<string, string>();
  for (const repoId of repoIds) {
    const { data: repoInfo } = await supabase
      .from("repos")
      .select("github_full_name")
      .eq("id", repoId)
      .single();
    if (repoInfo) {
      repoNamesMap.set(repoId, repoInfo.github_full_name);
    }
  }

  const allPairsByRepo = new Map<string, DuplicatePair[]>();

  for (const repoId of repoIds) {
    const repoName = repoNamesMap.get(repoId) || repoId;
    console.log(`Analyzing repo: ${repoName}`);

    // Fetch all issues for this repo with embeddings
    const { data: issuesData } = await supabase
      .from("issues")
      .select("id, title, body, github_issue_number")
      .eq("repo_id", repoId)
      .not("embedding", "is", null)
      .is("deleted_at", null);

    const issues: IssueRow[] = (issuesData ?? []) as IssueRow[];

    if (issues.length < 2) {
      console.log(`  Skipping (only ${issues.length} issue with embedding)\n`);
      continue;
    }

    console.log(`  Found ${issues.length} issues with embeddings`);

    // Track seen pairs to avoid duplicates
    const seenPairs = new Set<string>();
    const pairs: DuplicatePair[] = [];

    // TODO Block G or post-pilot: optimize via pairwise SQL query instead of per-issue findSimilarIssues calls
    for (const issue of issues) {
      // NOTE: We regenerate embeddings for the query side rather than fetching stored vectors from Supabase.
      // This is wasteful but simpler for v1. Optimize in DEFERRED list.
      // IMPORTANT: Uses embedIssueForStorage (RETRIEVAL_DOCUMENT) for both sides
      // because this is a document-to-document comparison, not a user-query-to-document search.
      // Using RETRIEVAL_QUERY here artificially deflates similarity scores.
      const queryEmbedding = await embedIssueForStorage({
        title: issue.title,
        body: issue.body,
      });

      const similarIssues: SimilarIssue[] = await findSimilarIssues({
        repoId,
        embedding: queryEmbedding.embedding,
        similarityThreshold: 0.85,
        limit: 5,
        excludeIssueId: issue.id,
      });

      for (const similar of similarIssues) {
        // Create canonical pair key (sorted ids)
        const pairKey = [issue.id, similar.id].sort().join(":");

        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          pairs.push({
            issueA: {
              id: issue.id,
              github_issue_number: issue.github_issue_number,
              title: issue.title,
            },
            issueB: {
              id: similar.id,
              github_issue_number: similar.github_issue_number,
              title: similar.title,
            },
            similarity: similar.similarity,
          });
        }
      }

      // Small delay to respect rate limits
      await sleep(100);
    }

    console.log(`  Found ${pairs.length} duplicate pairs\n`);
    allPairsByRepo.set(repoId, pairs);
  }

  // Generate report
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0] + "Z";
  const reportsDir = path.resolve(process.cwd(), "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `backfill-${timestamp}.md`);

  let totalPairs = 0;
  let totalIssues = 0;

  for (const pairs of allPairsByRepo.values()) {
    totalPairs += pairs.length;
  }

  // Count total issues with embeddings
  const { count: embeddedCount, error: countError } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null)
    .is("deleted_at", null);

  if (countError) {
    console.error("Failed to count embedded issues:", countError.message);
  }
  totalIssues = embeddedCount ?? 0;

  // Build report
  let report = `# Triage Backlog Analysis Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Repos analyzed: ${repoIds.length}\n`;
  report += `- Issues with embeddings: ${totalIssues}\n`;
  report += `- Duplicate pairs found (≥85% similarity): ${totalPairs}\n\n`;
  report += `## Duplicate Pairs by Repo\n\n`;

  for (const [repoId, pairs] of allPairsByRepo.entries()) {
    const repoName = repoNamesMap.get(repoId) || repoId;
    report += `### Repo: ${repoName}\n\n`;
    report += `${pairs.length} duplicate pairs found\n\n`;

    if (pairs.length === 0) {
      report += `_No duplicates detected_\n\n`;
      continue;
    }

    // Sort pairs by similarity descending
    const sortedPairs = pairs.sort((a, b) => b.similarity - a.similarity);

    sortedPairs.forEach((pair, idx) => {
      const similarityPercent = Math.round(pair.similarity * 100);
      report += `#### Pair ${idx + 1}: ${similarityPercent}% similar\n\n`;
      report += `- **#${pair.issueA.github_issue_number}**: ${pair.issueA.title}\n`;
      report += `- **#${pair.issueB.github_issue_number}**: ${pair.issueB.title}\n\n`;
    });
  }

  report += `## Methodology\n\n`;
  report += `- Embeddings: gemini-embedding-001 (1536 dimensions)\n`;
  report += `- Similarity metric: cosine similarity\n`;
  report += `- Threshold: 0.85 (issues above this are flagged as potential duplicates)\n`;
  report += `- Generated by: scripts/backfill-embeddings.ts\n`;

  fs.writeFileSync(reportPath, report, "utf-8");

  console.log(`\n✓ Report written to: ${reportPath}`);
  console.log(`  ${totalPairs} duplicate pairs found across ${repoIds.length} repos`);
}

async function main() {
  const startTime = Date.now();
  const flags = parseFlags();

  console.log("Triage Embedding Backfill + Duplicate Analysis");
  console.log("==============================================");
  console.log(
    `Flags: dry-run=${flags.dryRun}, limit=${flags.limit ?? "none"}, repo-id=${flags.repoId ?? "none"}, skip-report=${flags.skipReport}\n`,
  );

  // Phase 1: Backfill embeddings
  const { successCount, errorCount } = await phase1Backfill(flags);

  // Early exit conditions
  if (flags.dryRun) {
    console.log("\nDRY RUN complete. No embeddings generated.");
    process.exit(0);
  }

  if (flags.skipReport) {
    console.log("\nSkipping duplicate analysis (--skip-report flag set).");
    const endTime = Date.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);
    console.log(`\nTotal elapsed: ${elapsedSeconds}s`);
    process.exit(errorCount > 0 ? 1 : 0);
  }

  // Phase 2: Duplicate analysis
  await phase2DuplicateAnalysis(flags);

  // Final summary
  const endTime = Date.now();
  const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);

  console.log("\n==============================================");
  console.log("Backfill + Analysis complete");
  console.log(`Phase 1: ${successCount} successes, ${errorCount} errors`);
  console.log(`Total elapsed: ${elapsedSeconds}s\n`);

  if (errorCount > 0) {
    console.log("Exit code: 1 (errors detected)");
    process.exit(1);
  } else {
    console.log("Exit code: 0 (success)");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
