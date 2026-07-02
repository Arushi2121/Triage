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
  console.log("=== Testing Layer 10 Block C: search_similar_issues tool ===");
  
  if (!API_KEY) {
    console.error("Missing MCP_TEST_API_KEY in .env.local");
    process.exit(1);
  }

  // Test 1: tools/list now includes search_similar_issues
  console.log("\n--- Test 1: tools/list (should show 2 tools) ---");
  const listResp = await callMcp("tools/list");
  console.log("Status:", listResp.status);
  const toolNames = (listResp.body as { result: { tools: Array<{ name: string }> } }).result.tools.map((t) => t.name);
  console.log("Tool names:", toolNames);

  // Test 2: Search for dev environment issues
  console.log("\n--- Test 2: search 'dev server not starting' ---");
  const devResp = await callMcp("tools/call", {
    name: "search_similar_issues",
    arguments: {
      query: "dev server not starting or won't run locally",
      limit: 5,
    },
  });
  console.log("Status:", devResp.status);
  console.log("Body:", JSON.stringify(devResp.body, null, 2));

  // Test 3: Search for docs issues
  console.log("\n--- Test 3: search 'documentation typo' ---");
  const docsResp = await callMcp("tools/call", {
    name: "search_similar_issues",
    arguments: {
      query: "documentation typo or spelling error",
      limit: 5,
    },
  });
  console.log("Status:", docsResp.status);
  console.log("Body:", JSON.stringify(docsResp.body, null, 2));

  // Test 4: Search with high threshold — should return fewer or no results
  console.log("\n--- Test 4: search with min_similarity=0.9 ---");
  const strictResp = await callMcp("tools/call", {
    name: "search_similar_issues",
    arguments: {
      query: "authentication broken",
      limit: 5,
      min_similarity: 0.9,
    },
  });
  console.log("Status:", strictResp.status);
  console.log("Body:", JSON.stringify(strictResp.body, null, 2));

  // Test 5: Invalid input (query too short)
  console.log("\n--- Test 5: invalid input (query too short) ---");
  const invalidResp = await callMcp("tools/call", {
    name: "search_similar_issues",
    arguments: {
      query: "ab",
    },
  });
  console.log("Status:", invalidResp.status);
  console.log("Body:", JSON.stringify(invalidResp.body, null, 2));

  console.log("\n✓ Block C test complete");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
