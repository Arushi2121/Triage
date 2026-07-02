import type { User } from "@/types/db";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ListPatternsInputSchema,
  executeListPatterns,
} from "./tools/list_patterns";
import {
  SearchSimilarIssuesInputSchema,
  executeSearchSimilarIssues,
} from "./tools/search_similar_issues";
import {
  GetDigestInputSchema,
  executeGetDigest,
} from "./tools/get_digest";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
}

export function getToolsForUser(user: User): McpToolDefinition[] {
  void user;
  return [
    {
      name: "list_patterns",
      description: "List cross-issue patterns detected by Triage in the maintainer's repositories. Patterns are themes across multiple issues (e.g., 'Documentation quality issues', 'Dev environment setup friction'). Returns patterns with title, description, category, severity, and issue count.",
      inputSchema: zodToJsonSchema(ListPatternsInputSchema, { target: "openApi3" }),
    },
    {
      name: "search_similar_issues",
      description: "Search for GitHub issues semantically similar to a natural language query. Uses vector embeddings — matches on meaning, not just keywords. Returns issues with similarity score, title, body excerpt, classification, and GitHub URL. Useful for finding related issues, checking if a bug has been reported before, or discovering patterns across the maintainer's backlog.",
      inputSchema: zodToJsonSchema(SearchSimilarIssuesInputSchema, { target: "openApi3" }),
    },
    {
      name: "get_digest",
      description: "Generate a periodic digest of triage activity for a repo. Returns issue counts by type, PR counts by type, detected cross-issue patterns, and duplicates caught. Useful for weekly reports, backlog reviews, and understanding what's been happening in a repo. Same data as the /triage-digest Slack command but as structured JSON.",
      inputSchema: zodToJsonSchema(GetDigestInputSchema, { target: "openApi3" }),
    },
  ];
}

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
          content: [{ type: "text", text: `Invalid input for list_patterns: ${parsed.error.message}` }],
        };
      }
      try {
        const results = await executeListPatterns({ user, input: parsed.data });
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Tool execution failed: ${msg}` }],
        };
      }
    }

    case "search_similar_issues": {
      const parsed = SearchSimilarIssuesInputSchema.safeParse(toolArguments);
      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: "text", text: `Invalid input for search_similar_issues: ${parsed.error.message}` }],
        };
      }
      try {
        const results = await executeSearchSimilarIssues({ user, input: parsed.data });
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Tool execution failed: ${msg}` }],
        };
      }
    }

    case "get_digest": {
      const parsed = GetDigestInputSchema.safeParse(toolArguments);
      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: "text", text: `Invalid input for get_digest: ${parsed.error.message}` }],
        };
      }
      try {
        const result = await executeGetDigest({ user, input: parsed.data });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Tool execution failed: ${msg}` }],
        };
      }
    }

    default: {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${toolName}. Available tools: list_patterns, search_similar_issues, get_digest.`,
          },
        ],
      };
    }
  }
}
