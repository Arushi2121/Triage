import { zodToJsonSchema } from "zod-to-json-schema";
import { getGeminiClient } from "./client";
import {
  DraftOutputSchema,
  DraftOutput,
  buildDraftPrompt,
  PROMPT_VERSION,
} from "./prompts/draft_response";

export async function draftResponse(params: {
  issueTitle: string;
  issueBody: string | null;
  repoFullName: string;
  issueAuthor: string;
  classificationType: string;
  classificationSeverity: string;
  classificationReasoning: string;
  recommendationType: string;
  duplicateContext?: { number: number; title: string };
}): Promise<{
  draft: DraftOutput;
  rawResponse: object;
  model: string;
  temperature: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  promptVersion: string;
}> {
  const {
    issueTitle,
    issueBody,
    repoFullName,
    issueAuthor,
    classificationType,
    classificationSeverity,
    classificationReasoning,
    recommendationType,
    duplicateContext,
  } = params;

  const MODEL = "gemini-2.5-flash";
  const TEMPERATURE = 0.4; // Slightly higher than classify (0.2) — drafts need some warmth, not robotic determinism

  const ai = getGeminiClient();
  const prompt = buildDraftPrompt(
    issueTitle,
    issueBody,
    repoFullName,
    issueAuthor,
    classificationType,
    classificationSeverity,
    classificationReasoning,
    recommendationType,
    duplicateContext,
  );
  const jsonSchema = zodToJsonSchema(DraftOutputSchema);

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

  // Parse JSON
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(textResponse);
  } catch (parseError) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    );
  }

  // Validate against Zod schema
  const validation = DraftOutputSchema.safeParse(parsedJson);
  if (!validation.success) {
    throw new Error(
      `LLM response failed schema validation: ${validation.error.message}`,
    );
  }

  // Token count extraction — use the SAME UsageMetadataShape pattern as classify.ts to avoid the Vercel ESLint issue
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
    draft: validation.data,
    rawResponse: parsedJson as object,
    model: MODEL,
    temperature: TEMPERATURE,
    tokenCountInput,
    tokenCountOutput,
    promptVersion: PROMPT_VERSION,
  };
}
