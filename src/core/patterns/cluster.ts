/**
 * Single-linkage clustering: given a list of items with embeddings,
 * connect items with cosine similarity above threshold, return
 * connected components (clusters) with size >= minClusterSize.
 *
 * Time complexity: O(n^2). Acceptable for n < 1000 issues per repo.
 */
export function clusterBySimilarity<T>(params: {
  items: T[];
  embeddings: number[][];
  similarityThreshold: number;
  minClusterSize: number;
}): T[][] {
  const { items, embeddings, similarityThreshold, minClusterSize } = params;
  if (items.length !== embeddings.length) {
    throw new Error("items and embeddings length mismatch");
  }
  if (items.length === 0) return [];
  
  // Union-Find for connected components
  const parent: number[] = items.map((_, i) => i);
  
  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }
  
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  
  // Compare every pair, union if above threshold
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= similarityThreshold) {
        union(i, j);
      }
    }
  }
  
  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }
  
  // Filter by minClusterSize and return items
  const clusters: T[][] = [];
  for (const indices of groups.values()) {
    if (indices.length >= minClusterSize) {
      clusters.push(indices.map((idx) => items[idx]));
    }
  }
  
  return clusters;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimension mismatch");
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute the centroid (mean) of a set of embeddings.
 * Used for matching new clusters to existing patterns.
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error("Cannot compute centroid of empty set");
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }
  return centroid;
}
