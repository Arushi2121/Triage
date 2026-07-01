import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { generateDigest } from "../src/core/digests/generate";
import { getSupabaseClient } from "../src/db/client";

async function main() {
  console.log("=== Testing Layer 9 Block B: generateDigest ===");

  // Find a repo that has issues
  const supabase = getSupabaseClient();
  const { data: repos, error } = await supabase
    .from("repos")
    .select("id, github_full_name")
    .limit(5);
  if (error || !repos || repos.length === 0) {
    console.error("No repos found — cannot run integration test");
    process.exit(1);
  }
  const repo = repos[0];
  console.log(`Using repo: ${repo.github_full_name} (${repo.id})`);

  // 30-day window ending now (widest reasonable window)
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Window: ${windowStart} → ${windowEnd}`);
  console.log("Generating digest...");

  const digest = await generateDigest({
    repoId: repo.id,
    windowStart,
    windowEnd,
  });

  console.log("\n=== Digest Data ===");
  console.log(`Repo: ${digest.repoFullName}`);
  console.log(`Total issues: ${digest.totalIssues}`);
  console.log(`Total PRs: ${digest.totalPRs}`);
  console.log(`Issues by type:`, digest.issuesByType);
  console.log(`PRs by type:`, digest.prsByType);
  console.log(`Duplicates caught: ${digest.duplicatesCaught}`);
  console.log(`Patterns detected: ${digest.patterns.length}`);
  for (const p of digest.patterns) {
    console.log(`  - ${p.isNew ? "[NEW]" : "[UPDATED]"} ${p.pattern.title} (${p.matchedIssues.length} issues, ${p.pattern.category}/${p.pattern.severity})`);
  }
  console.log(`Persisted digest ID: ${digest.digestId}`);

  console.log("\n✓ Layer 9 Block B integration test complete");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
