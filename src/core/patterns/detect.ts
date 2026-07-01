import type { Issue, Pattern } from "@/types/db";
import { clusterBySimilarity, computeCentroid, cosineSimilarity } from "./cluster";
import { summarizePattern } from "@/integrations/llm/classify";
import {
  insertPattern,
  getActivePatternsForRepo,
} from "@/db/patterns";
import { addIssueToPattern } from "@/db/issue_patterns";
import { getSupabaseClient } from "@/db/client";

const SIMILARITY_THRESHOLD = 0.72;
const MIN_CLUSTER_SIZE = 3;
const EXISTING_PATTERN_MATCH_THRESHOLD = 0.80;

export interface IssueWithEmbedding {
  issue: Issue;
  embedding: number[];
}

export interface DetectedPattern {
  pattern: Pattern;
  isNew: boolean;  // true if we created it this run, false if we updated an existing one
  matchedIssues: Issue[];
}

/**
 * Detect cross-issue patterns via retroactive clustering.
 *
 * Algorithm:
 * 1. Cluster issues by embedding similarity (single-linkage, threshold 0.72, min size 3)
 * 2. For each cluster:
 *    a. Compute centroid
 *    b. Check against existing active patterns for this repo
 *    c. If matches an existing pattern (centroid similarity > 0.80): update issue_count and last_detected_at
 *    d. Otherwise: LLM-summarize the cluster and insert a new pattern
 * 3. Link cluster issues to the pattern via issue_patterns
 *
 * @param repoId - The repo we're detecting patterns for
 * @param issuesWithEmbeddings - Issues to cluster (typically from a time window)
 * @param repoFullName - Used in the LLM prompt for context (e.g., "owner/repo")
 * @returns Array of detected patterns (mix of new and updated)
 */
export async function detectPatterns(params: {
  repoId: string;
  issuesWithEmbeddings: IssueWithEmbedding[];
  repoFullName: string;
}): Promise<DetectedPattern[]> {
  const { repoId, issuesWithEmbeddings, repoFullName } = params;
  
  if (issuesWithEmbeddings.length < MIN_CLUSTER_SIZE) {
    return [];
  }
  
  // Step 1: Cluster
  const clusters = clusterBySimilarity({
    items: issuesWithEmbeddings,
    embeddings: issuesWithEmbeddings.map((x) => x.embedding),
    similarityThreshold: SIMILARITY_THRESHOLD,
    minClusterSize: MIN_CLUSTER_SIZE,
  });
  
  if (clusters.length === 0) {
    return [];
  }
  
  console.log(`Pattern detection: found ${clusters.length} clusters from ${issuesWithEmbeddings.length} issues`);
  
  // Step 2: Get existing active patterns to check for matches
  const existingPatterns = await getActivePatternsForRepo(repoId);
  
  // For each existing pattern, precompute its centroid from linked issues.
  // For now, since patterns table doesn't store centroid, we need to fetch linked issues' embeddings.
  // OPTIMIZATION for later: add centroid column to patterns table.
  const supabase = getSupabaseClient();
  
  const existingPatternCentroids: Array<{ pattern: Pattern; centroid: number[] }> = [];
  for (const existing of existingPatterns) {
    // Fetch issue embeddings linked to this pattern
    const { data: linkedIssues, error } = await supabase
      .from("issue_patterns")
      .select("issue_id, issues!inner(embedding)")
      .eq("pattern_id", existing.id);
    
    if (error || !linkedIssues || linkedIssues.length === 0) continue;
    
    const embeddings = linkedIssues
      .map((li: unknown) => {
        const typed = li as { issues: { embedding: number[] | null } };
        return typed.issues.embedding;
      })
      .filter((e): e is number[] => e !== null && Array.isArray(e));
    
    if (embeddings.length > 0) {
      existingPatternCentroids.push({
        pattern: existing,
        centroid: computeCentroid(embeddings),
      });
    }
  }
  
  // Step 3: Process each cluster
  const results: DetectedPattern[] = [];
  
  for (const cluster of clusters) {
    const clusterEmbeddings = cluster.map((x) => x.embedding);
    const clusterCentroid = computeCentroid(clusterEmbeddings);
    
    // Try to match against existing patterns
    let bestMatch: { pattern: Pattern; similarity: number } | null = null;
    for (const existing of existingPatternCentroids) {
      const sim = cosineSimilarity(clusterCentroid, existing.centroid);
      if (sim >= EXISTING_PATTERN_MATCH_THRESHOLD) {
        if (!bestMatch || sim > bestMatch.similarity) {
          bestMatch = { pattern: existing.pattern, similarity: sim };
        }
      }
    }
    
    if (bestMatch) {
      // Update existing pattern
      const newCount = bestMatch.pattern.issue_count + cluster.length;
      const { data: updated, error: updateError } = await supabase
        .from("patterns")
        .update({
          issue_count: newCount,
          last_detected_at: new Date().toISOString(),
        })
        .eq("id", bestMatch.pattern.id)
        .select()
        .single();
      
      if (updateError || !updated) {
        console.error(`Failed to update pattern ${bestMatch.pattern.id}:`, updateError);
        continue;
      }
      
      // Link new issues (skip if already linked — rely on unique constraint or catch error)
      for (const item of cluster) {
        try {
          await addIssueToPattern(bestMatch.pattern.id, item.issue.id, 0.85, "retroactive-cluster");
        } catch (err) {
          // Likely duplicate link; ignore
        }
      }
      
      results.push({
        pattern: updated,
        isNew: false,
        matchedIssues: cluster.map((x) => x.issue),
      });
      
      console.log(`  Updated existing pattern: "${updated.title}" (now ${newCount} issues)`);
      continue;
    }
    
    // No match: LLM-summarize and create new pattern
    const issueSnippets = cluster.slice(0, 8).map((x) => ({
      title: x.issue.title,
      bodyExcerpt: (x.issue.body ?? "").substring(0, 200),
    }));
    
    try {
      const summary = await summarizePattern({
        repoFullName,
        issueSnippets,
      });
      
      const newPattern = await insertPattern({
        repo_id: repoId,
        title: summary.summary.title,
        description: summary.summary.description,
        category: summary.summary.category,
        severity: summary.summary.severity,
        status: "active",
        issue_count: cluster.length,
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
        reasoning: summary.summary.title,
        raw_llm_response: summary.rawResponse as unknown as Parameters<typeof insertPattern>[0]['raw_llm_response'],
        prompt_version: summary.promptVersion,
        llm_model: summary.model,
        llm_temperature: summary.temperature,
        token_count_input: summary.tokenCountInput,
        token_count_output: summary.tokenCountOutput,
      });
      
      // Link all cluster issues
      for (const item of cluster) {
        try {
          await addIssueToPattern(newPattern.id, item.issue.id, summary.summary.confidence, "retroactive-cluster");
        } catch (err) {
          // Ignore duplicate link errors
        }
      }
      
      results.push({
        pattern: newPattern,
        isNew: true,
        matchedIssues: cluster.map((x) => x.issue),
      });
      
      console.log(`  Created new pattern: "${newPattern.title}" (${cluster.length} issues, ${newPattern.category})`);
    } catch (err) {
      console.error(`Failed to summarize/create pattern for cluster of ${cluster.length}:`, err);
    }
  }
  
  return results;
}
