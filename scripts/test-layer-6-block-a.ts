import * as dotenv from "dotenv";
import * as path from "path";
import {
  embedIssueForStorage,
  embedIssueForSearch,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "../src/integrations/llm/embed";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  console.log("Testing Layer 6 Block A: Embedding Generation\n");

  // Test 1: embedIssueForStorage
  console.log("Test 1: embedIssueForStorage with sample issue");
  const storageResult = await embedIssueForStorage({
    title: "Build fails on Ubuntu 22.04",
    body: "Getting gyp errors during npm install",
  });

  if (!Array.isArray(storageResult.embedding)) {
    throw new Error("Expected embedding to be an array");
  }
  if (storageResult.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSIONS}, got ${storageResult.embedding.length}`,
    );
  }
  if (storageResult.model !== EMBEDDING_MODEL) {
    throw new Error(
      `Expected model ${EMBEDDING_MODEL}, got ${storageResult.model}`,
    );
  }

  console.log("✓ embedIssueForStorage returns valid 1536-dim embedding");
  console.log(`  DEBUG: tokenCount value: ${storageResult.tokenCount}`);
  console.log(`  Model: ${storageResult.model}, Tokens: ${storageResult.tokenCount}\n`);

  // Test 2: embedIssueForSearch
  console.log("Test 2: embedIssueForSearch with same input");
  const searchResult = await embedIssueForSearch({
    title: "Build fails on Ubuntu 22.04",
    body: "Getting gyp errors during npm install",
  });

  if (!Array.isArray(searchResult.embedding)) {
    throw new Error("Expected embedding to be an array");
  }
  if (searchResult.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSIONS}, got ${searchResult.embedding.length}`,
    );
  }
  if (searchResult.model !== EMBEDDING_MODEL) {
    throw new Error(
      `Expected model ${EMBEDDING_MODEL}, got ${searchResult.model}`,
    );
  }

  console.log("✓ embedIssueForSearch returns valid 1536-dim embedding");
  console.log(`  Model: ${searchResult.model}, Tokens: ${searchResult.tokenCount}\n`);

  // Test 3: Similarity property test
  console.log("Test 3: Semantic similarity property");

  // Generate embedding A (storage type) for a build issue
  const embeddingA = await embedIssueForStorage({
    title: "Build fails on Ubuntu 22.04 - npm install errors",
    body: null,
  });

  // Generate embedding B (search type) for semantically similar issue
  const embeddingB = await embedIssueForSearch({
    title: "Build error on Ubuntu npm install",
    body: null,
  });

  // Generate embedding C (search type) for different topic
  const embeddingC = await embedIssueForSearch({
    title: "How do I create a new user in admin panel?",
    body: null,
  });

  // Compute similarities
  const similarityAB = cosineSimilarity(
    embeddingA.embedding,
    embeddingB.embedding,
  );
  const similarityAC = cosineSimilarity(
    embeddingA.embedding,
    embeddingC.embedding,
  );

  console.log(`  Similarity A vs B (similar issues): ${similarityAB.toFixed(4)}`);
  console.log(`  Similarity A vs C (different topics): ${similarityAC.toFixed(4)}`);

  if (similarityAB <= similarityAC) {
    throw new Error(
      `Expected similarityAB (${similarityAB}) > similarityAC (${similarityAC})`,
    );
  }

  console.log("✓ Semantically similar issues have higher cosine similarity than dissimilar ones\n");

  console.log("✓ All Layer 6 Block A tests passed");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
