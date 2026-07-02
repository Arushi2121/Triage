import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MCP_ENDPOINT = process.env.MCP_TEST_ENDPOINT ?? "http://localhost:3000/api/mcp";
const API_KEY = process.env.MCP_TEST_API_KEY;

async function callMcp(method: string, params: unknown = {}) {
  const resp = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000),
      method,
      params,
    }),
  });
  return { status: resp.status, body: await resp.json() };
}

async function main() {
  console.log("=== Testing Layer 10 Block B: list_patterns tool ===");
  
  if (!API_KEY) {
    console.error("Missing MCP_TEST_API_KEY in .env.local");
    process.exit(1);
  }

  // Test 1: tools/list should now return list_patterns
  console.log("\n--- Test 1: tools/list ---");
  const listResp = await callMcp("tools/list");
  console.log("Status:", listResp.status);
  console.log("Body:", JSON.stringify(listResp.body, null, 2));

  // Test 2: tools/call with list_patterns, no filters
  console.log("\n--- Test 2: tools/call list_patterns (no filters) ---");
  const callResp = await callMcp("tools/call", {
    name: "list_patterns",
    arguments: {},
  });
  console.log("Status:", callResp.status);
  console.log("Body:", JSON.stringify(callResp.body, null, 2));

  // Test 3: tools/call with severity filter
  console.log("\n--- Test 3: tools/call list_patterns (severity=high) ---");
  const highResp = await callMcp("tools/call", {
    name: "list_patterns",
    arguments: { severity: "high" },
  });
  console.log("Status:", highResp.status);
  console.log("Body:", JSON.stringify(highResp.body, null, 2));

  // Test 4: tools/call with invalid tool name
  console.log("\n--- Test 4: tools/call unknown_tool ---");
  const unknownResp = await callMcp("tools/call", {
    name: "unknown_tool",
    arguments: {},
  });
  console.log("Status:", unknownResp.status);
  console.log("Body:", JSON.stringify(unknownResp.body, null, 2));

  console.log("\n✓ Block B test complete");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
