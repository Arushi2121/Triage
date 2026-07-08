import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getSupabaseClient } from "@/db/client";
import { findSimilarIssues } from "@/db/issues";
import { upsertDetectedDuplicate } from "@/db/issue_duplicates";

const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
const MAX_DUPLICATE_CANDIDATES = 3;

/**
 * Parse a pgvector value (returned as a string like "[0.1,0.2,...]") into number[].
 * Returns null if the value cannot be parsed into a numeric array.
 */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return raw.every((n) => typeof n === "number") ? (raw as number[]) : null;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed as number[];
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  console.log("=== Backfill issue_duplicates from existing embeddings ===");
  const supabase = getSupabaseClient();

  // Fetch all issues with embeddings
  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, repo_id, title, github_issue_number, embedding")
    .not("embedding", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch issues:", error);
    process.exit(1);
  }

  if (!issues || issues.length === 0) {
    console.log("No issues with embeddings found");
    return;
  }

  console.log(`Found ${issues.length} issues with embeddings. Scanning...`);
  let detected = 0;
  let skipped = 0;

  for (const issue of issues) {
    const embedding = parseEmbedding(issue.embedding);
    if (!embedding) {
      console.error(
        `  ! Skipping #${issue.github_issue_number}: embedding could not be parsed`,
      );
      continue;
    }

    try {
      const similar = await findSimilarIssues({
        repoId: issue.repo_id,
        embedding,
        similarityThreshold: DUPLICATE_SIMILARITY_THRESHOLD,
        limit: MAX_DUPLICATE_CANDIDATES,
        excludeIssueId: issue.id,
      });

      for (const match of similar) {
        try {
          await upsertDetectedDuplicate({
            sourceIssueId: issue.id,
            duplicateOfIssueId: match.id,
            similarityScore: match.similarity,
            confidence: match.similarity,
            detectionMethod: "embedding-similarity",
          });
          detected++;
          console.log(
            `  ✓ #${issue.github_issue_number} → #${match.github_issue_number} (${(match.similarity * 100).toFixed(1)}%)`,
          );
        } catch (err) {
          skipped++;
          console.error(
            `  ✗ Failed to insert (#${issue.github_issue_number} → #${match.github_issue_number}):`,
            err,
          );
        }
      }
    } catch (err) {
      console.error(
        `Failed similarity search for issue #${issue.github_issue_number}:`,
        err,
      );
    }
  }

  console.log(
    `\nBackfill complete. Detected: ${detected}. Skipped/failed: ${skipped}.`,
  );
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
