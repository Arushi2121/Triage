import { zodToJsonSchema } from "zod-to-json-schema";
import { getGeminiClient } from "./client";
import {
  ClassificationOutputSchema,
  ClassificationOutput,
  buildClassifyPrompt,
  PROMPT_VERSION,
} from "./prompts/classify_issue";

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
