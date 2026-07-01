import { zodToJsonSchema } from "zod-to-json-schema";
import { getGeminiClient } from "./client";
import {
  ClassificationOutputSchema,
  ClassificationOutput,
  buildClassifyPrompt,
  PROMPT_VERSION,
} from "./prompts/classify_issue";
import {
  PRClassificationOutputSchema,
  PRClassificationOutput,
  buildClassifyPRPrompt,
  PROMPT_VERSION as PR_PROMPT_VERSION,
} from "./prompts/classify_pr";
import {
  PatternSummaryOutputSchema,
  PatternSummaryOutput,
  buildSummarizePatternPrompt,
  PROMPT_VERSION as PATTERN_PROMPT_VERSION,
} from "./prompts/summarize_pattern";

export async function classifyIssue(params: {
  issueTitle: string;
  issueBody: string | null;
  repoFullName: string;
}): Promise<{
  classification: ClassificationOutput;
  rawResponse: object;
  model: string;
  temperature: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  promptVersion: string;
}> {
  const { issueTitle, issueBody, repoFullName } = params;

  const ai = getGeminiClient();
  const prompt = buildClassifyPrompt(issueTitle, issueBody, repoFullName);
  const jsonSchema = zodToJsonSchema(ClassificationOutputSchema);

  const MODEL = "gemini-2.5-flash";
  const TEMPERATURE = 0.2;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: TEMPERATURE,
    },
  });

  // Extract text from response (property, not function in @google/genai 2.8.x)
  const textResponse = response.text;
  if (!textResponse) {
    throw new Error("Gemini response is missing text content");
  }

  // Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(textResponse);
  } catch (error) {
    throw new Error(
      `Gemini returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Validate with Zod
  let classification: ClassificationOutput;
  try {
    classification = ClassificationOutputSchema.parse(parsedJson);
  } catch (error) {
    throw new Error(
      `Gemini response failed schema validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Extract token counts from usageMetadata
  // The SDK might use different property names depending on version
  let tokenCountInput = 0;
  let tokenCountOutput = 0;

  type UsageMetadataShape = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    inputTokenCount?: number;
    outputTokenCount?: number;
  };

  if (response.usageMetadata) {
    const metadata = response.usageMetadata as UsageMetadataShape;

    // Try different possible property names
    if ("promptTokenCount" in metadata && "candidatesTokenCount" in metadata) {
      tokenCountInput = metadata.promptTokenCount ?? 0;
      tokenCountOutput = metadata.candidatesTokenCount ?? 0;
    } else if ("inputTokenCount" in metadata && "outputTokenCount" in metadata) {
      tokenCountInput = metadata.inputTokenCount ?? 0;
      tokenCountOutput = metadata.outputTokenCount ?? 0;
    } else {
      console.warn("Unknown usageMetadata format:", metadata);
    }
  } else {
    console.warn("No usageMetadata in response");
  }

  return {
    classification,
    rawResponse: parsedJson as object,
    model: MODEL,
    temperature: TEMPERATURE,
    tokenCountInput,
    tokenCountOutput,
    promptVersion: PROMPT_VERSION,
  };
}

export async function classifyPR(params: {
  prTitle: string;
  prBody: string | null;
  repoFullName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDraft: boolean;
}): Promise<{
  classification: PRClassificationOutput;
  rawResponse: object;
  model: string;
  temperature: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  promptVersion: string;
}> {
  const { prTitle, prBody, repoFullName, additions, deletions, changedFiles, isDraft } = params;
  const ai = getGeminiClient();
  const prompt = buildClassifyPRPrompt(
    prTitle,
    prBody,
    repoFullName,
    additions,
    deletions,
    changedFiles,
    isDraft,
  );
  const jsonSchema = zodToJsonSchema(PRClassificationOutputSchema);
  
  const MODEL = "gemini-2.5-flash";
  const TEMPERATURE = 0.2;
  
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: TEMPERATURE,
    },
  });
  
  const textResponse = response.text;
  if (!textResponse) {
    throw new Error("Gemini response is missing text content");
  }
  
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(textResponse);
  } catch (parseError) {
    throw new Error(`Failed to parse PR LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  const validation = PRClassificationOutputSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new Error(`PR LLM response failed schema validation: ${validation.error.message}`);
  }
  
  type UsageMetadataShape = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    inputTokenCount?: number;
    outputTokenCount?: number;
  };
  
  let tokenCountInput = 0;
  let tokenCountOutput = 0;
  if (response.usageMetadata) {
    const metadata = response.usageMetadata as UsageMetadataShape;
    if ("promptTokenCount" in metadata && "candidatesTokenCount" in metadata) {
      tokenCountInput = metadata.promptTokenCount ?? 0;
      tokenCountOutput = metadata.candidatesTokenCount ?? 0;
    } else if ("inputTokenCount" in metadata && "outputTokenCount" in metadata) {
      tokenCountInput = metadata.inputTokenCount ?? 0;
      tokenCountOutput = metadata.outputTokenCount ?? 0;
    } else {
      console.warn("Unknown usageMetadata format:", metadata);
    }
  }
  
  return {
    classification: validation.data,
    rawResponse: parsedJson as object,
    model: MODEL,
    temperature: TEMPERATURE,
    tokenCountInput,
    tokenCountOutput,
    promptVersion: PR_PROMPT_VERSION,
  };
}

export async function summarizePattern(params: {
  repoFullName: string;
  issueSnippets: Array<{ title: string; bodyExcerpt: string }>;
}): Promise<{
  summary: PatternSummaryOutput;
  rawResponse: object;
  model: string;
  temperature: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  promptVersion: string;
}> {
  const ai = getGeminiClient();
  const prompt = buildSummarizePatternPrompt(params);
  const jsonSchema = zodToJsonSchema(PatternSummaryOutputSchema);
  
  const MODEL = "gemini-2.5-flash";
  const TEMPERATURE = 0.3;
  
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: TEMPERATURE,
    },
  });
  
  const textResponse = response.text;
  if (!textResponse) {
    throw new Error("Gemini response is missing text content");
  }
  
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(textResponse);
  } catch (parseError) {
    throw new Error(`Failed to parse pattern summary as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  const validation = PatternSummaryOutputSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new Error(`Pattern summary failed schema validation: ${validation.error.message}`);
  }
  
  type UsageMetadataShape = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    inputTokenCount?: number;
    outputTokenCount?: number;
  };
  
  let tokenCountInput = 0;
  let tokenCountOutput = 0;
  if (response.usageMetadata) {
    const metadata = response.usageMetadata as UsageMetadataShape;
    if ("promptTokenCount" in metadata && "candidatesTokenCount" in metadata) {
      tokenCountInput = metadata.promptTokenCount ?? 0;
      tokenCountOutput = metadata.candidatesTokenCount ?? 0;
    } else if ("inputTokenCount" in metadata && "outputTokenCount" in metadata) {
      tokenCountInput = metadata.inputTokenCount ?? 0;
      tokenCountOutput = metadata.outputTokenCount ?? 0;
    }
  }
  
  return {
    summary: validation.data,
    rawResponse: parsedJson as object,
    model: MODEL,
    temperature: TEMPERATURE,
    tokenCountInput,
    tokenCountOutput,
    promptVersion: PATTERN_PROMPT_VERSION,
  };
}
