import { GoogleGenAI } from "@google/genai";

function validateGeminiEnv(): { apiKey: string } {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Set it in .env.local (see .env.local.example).",
    );
  }

  return { apiKey };
}

let geminiClient: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const { apiKey } = validateGeminiEnv();
    geminiClient = new GoogleGenAI({ apiKey });
  }

  return geminiClient;
}
