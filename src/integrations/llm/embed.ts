import { getGeminiClient } from "./client";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;

interface EmbedResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

/**
 * Generate embedding for storing an issue in the database.
 * Uses RETRIEVAL_DOCUMENT task type optimized for document storage.
 *
 * @param params - Issue title and body
 * @returns Embedding vector, model name, and token count
 */
export async function embedIssueForStorage(params: {
  title: string;
  body: string | null;
}): Promise<EmbedResult> {
  return embedIssue({
    ...params,
    taskType: "RETRIEVAL_DOCUMENT",
  });
}

/**
 * Generate embedding for searching/querying similar issues.
 * Uses RETRIEVAL_QUERY task type optimized for query matching.
 *
 * @param params - Issue title and body
 * @returns Embedding vector, model name, and token count
 */
export async function embedIssueForSearch(params: {
  title: string;
  body: string | null;
}): Promise<EmbedResult> {
  return embedIssue({
    ...params,
    taskType: "RETRIEVAL_QUERY",
  });
}

/**
 * Internal helper to generate embeddings with specified task type.
 */
async function embedIssue(params: {
  title: string;
  body: string | null;
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
}): Promise<EmbedResult> {
  const { title, body, taskType } = params;

  const ai = getGeminiClient();
  const text = `${title}\n\n${body || ""}`;

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  // Validate response structure
  if (!response.embeddings || response.embeddings.length === 0) {
    throw new Error("Gemini returned no embedding");
  }

  const embeddingData = response.embeddings[0];
  if (!embeddingData.values || embeddingData.values.length === 0) {
    throw new Error("Gemini returned no embedding");
  }

  // Validate dimensions
  const actualLength = embeddingData.values.length;
  if (actualLength !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSIONS}, got ${actualLength}`,
    );
  }

  // Token count not exposed in current @google/genai 2.8 SDK; defaulting to 0
  // Tracked in DEFERRED.md — not blocking for v1
  const tokenCount = embeddingData.statistics?.tokenCount ?? 0;

  return {
    embedding: embeddingData.values,
    model: EMBEDDING_MODEL,
    tokenCount,
  };
}
