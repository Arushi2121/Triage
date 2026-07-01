import assert from "node:assert";
import { clusterBySimilarity, cosineSimilarity, computeCentroid } from "../src/core/patterns/cluster";

console.log("=== Testing Layer 9 Block A: cluster.ts ===");

// Test 1: Identical vectors → similarity 1
{
  const v = [1, 0, 0];
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9);
  console.log("✓ Identical vectors have similarity 1");
}

// Test 2: Orthogonal vectors → similarity 0
{
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  console.log("✓ Orthogonal vectors have similarity 0");
}

// Test 3: Empty input → empty output
{
  const result = clusterBySimilarity({
    items: [],
    embeddings: [],
    similarityThreshold: 0.5,
    minClusterSize: 3,
  });
  assert.strictEqual(result.length, 0);
  console.log("✓ Empty input produces empty output");
}

// Test 4: Below minClusterSize → no clusters
{
  const result = clusterBySimilarity({
    items: ["a", "b"],
    embeddings: [[1, 0], [1, 0]],
    similarityThreshold: 0.5,
    minClusterSize: 3,
  });
  assert.strictEqual(result.length, 0);
  console.log("✓ Cluster below minClusterSize excluded");
}

// Test 5: 3 similar + 1 distant → one cluster of 3
{
  const result = clusterBySimilarity({
    items: ["a", "b", "c", "d"],
    embeddings: [
      [1, 0, 0],
      [0.99, 0.01, 0],
      [0.98, 0.02, 0],
      [0, 1, 0],
    ],
    similarityThreshold: 0.9,
    minClusterSize: 3,
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].length, 3);
  console.log("✓ 3 similar + 1 distant produces one 3-cluster");
}

// Test 6: Two separate clusters
{
  const result = clusterBySimilarity({
    items: ["a", "b", "c", "d", "e", "f"],
    embeddings: [
      [1, 0, 0], [1, 0, 0], [1, 0, 0],
      [0, 1, 0], [0, 1, 0], [0, 1, 0],
    ],
    similarityThreshold: 0.9,
    minClusterSize: 3,
  });
  assert.strictEqual(result.length, 2);
  console.log("✓ Two separate clusters detected");
}

// Test 7: Centroid of identical vectors is same vector
{
  const c = computeCentroid([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  assert.deepStrictEqual(c, [1, 2, 3]);
  console.log("✓ Centroid of identical vectors is same vector");
}

// Test 8: Centroid is mean
{
  const c = computeCentroid([[0, 0], [2, 0], [4, 0]]);
  assert.deepStrictEqual(c, [2, 0]);
  console.log("✓ Centroid is arithmetic mean");
}

console.log("\n✓ All Layer 9 Block A tests passed");
