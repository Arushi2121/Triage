import { NextResponse } from "next/server";
import { getUserByApiKey } from "@/db/users";
import type { User } from "@/types/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// MCP protocol version we speak
const MCP_PROTOCOL_VERSION = "2025-03-26";

// Server identity announced during initialize
const SERVER_INFO = {
  name: "triage-mcp",
  version: "1.0.0",
};

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number | string | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: number | string | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Authenticate the request via Bearer token.
 * Returns the authenticated user or null.
 */
async function authenticate(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) return null;

  try {
    return await getUserByApiKey(apiKey);
  } catch (err) {
    console.error("Auth lookup failed:", err);
    return null;
  }
}

/**
 * Route MCP JSON-RPC method to its handler.
 * `user` is available for tools/call to scope data queries (Blocks B, C, D).
 */
async function handleMcpMethod(
  req: JsonRpcRequest,
  user: User,
): Promise<JsonRpcSuccess | JsonRpcError | null> {
  // Suppress unused-var warning until Blocks B, C, D use `user`
  void user;

  const id = req.id ?? null;

  switch (req.method) {
    case "initialize": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      };
    }

    case "notifications/initialized": {
      // Notification — no response per JSON-RPC 2.0 spec
      return null;
    }

    case "tools/list": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            // Block A: empty. Blocks B, C, D will add: list_patterns, get_digest, search_similar_issues.
          ],
        },
      };
    }

    case "tools/call": {
      // Block A: no tools registered
      const params = req.params as { name?: string } | undefined;
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Tool not found: ${params?.name ?? "(unknown)"}. Available tools will be added in Layer 10 Blocks B/C/D.`,
        },
      };
    }

    default: {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${req.method}`,
        },
      };
    }
  }
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Include 'Authorization: Bearer <api_key>' header." },
      { status: 401 },
    );
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch (err) {
    console.error("Failed to parse JSON body:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 },
    );
  }

  // Validate JSON-RPC shape
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32600, message: "Invalid Request" },
      },
      { status: 400 },
    );
  }

  try {
    const response = await handleMcpMethod(body, user);
    if (response === null) {
      // Notification — return 204 (no content)
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error("MCP method handler failed:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32603, message: "Internal error" },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user) {
    return NextResponse.json({
      status: "ok",
      authenticated: true,
      user: user.github_username,
    });
  }
  return NextResponse.json({
    status: "ok",
    authenticated: false,
  });
}
