import type { User } from "@/types/db";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ListPatternsInputSchema,
  executeListPatterns,
} from "./tools/list_patterns";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;  // JSON Schema object
}

/**
 * Registry of tools available for a given user.
 * All tools are user-scoped — they only see the user's data.
 */
export function getToolsForUser(user: User): McpToolDefinition[] {
  void user;  // reserved for future per-user tool filtering
  return [
    {
      name: "list_patterns",
      description: "List cross-issue patterns detected by Triage in the maintainer's repositories. Patterns are themes across multiple issues (e.g., 'Documentation quality issues', 'Dev environment setup friction'). Returns patterns with title, description, category, severity, and issue count.",
      inputSchema: zodToJsonSchema(ListPatternsInputSchema, { target: "openApi3" }),
    },
  ];
}

/**
 * Route a tool invocation to its handler by name.
 */
export async function callToolForUser(params: {
  user: User;
  toolName: string;
  toolArguments: Record<string, unknown>;
}): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const { user, toolName, toolArguments } = params;

  switch (toolName) {
    case "list_patterns": {
      const parsed = ListPatternsInputSchema.safeParse(toolArguments);
      if (!parsed.success) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Invalid input for list_patterns: ${parsed.error.message}`,
            },
          ],
        };
      }
      try {
        const results = await executeListPatterns({ user, input: parsed.data });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool execution failed: ${msg}`,
            },
          ],
        };
      }
    }

    default: {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${toolName}. Available tools: list_patterns.`,
          },
        ],
      };
    }
  }
}
