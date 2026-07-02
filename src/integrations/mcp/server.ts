import type { User } from "@/types/db";

/**
 * Tool definition shape for MCP tools/list responses.
 * Used by Block A route handler and by Blocks B/C/D that add real tools.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Registry of tools available for a given user.
 * Block A: empty. Blocks B/C/D append: list_patterns, get_digest, search_similar_issues.
 */
export function getToolsForUser(user: User): McpToolDefinition[] {
  // Suppress unused-var warning until later blocks use `user`
  void user;
  return [];
}

/**
 * Route a tool invocation to its handler.
 * Block A: throws "not implemented". Blocks B/C/D will implement individual tools.
 */
export async function callToolForUser(params: {
  user: User;
  toolName: string;
  toolArguments: Record<string, unknown>;
}): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  void params;
  throw new Error("No tools registered yet. Add tools in Layer 10 Blocks B/C/D.");
}
