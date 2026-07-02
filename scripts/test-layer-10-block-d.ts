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
  console.log("=== Testing Layer 10 Block D: get_digest tool ===");
  
  if (!API_KEY) {
    console.error("Missing MCP_TEST_API_KEY in .env.local");
    process.exit(1);
  }

  // Test 1: tools/list now shows 3 tools
  console.log("\n--- Test 1: tools/list (should show 3 tools) ---");
  const listResp = await callMcp("tools/list");
  console.log("Status:", listResp.status);
  const toolNames = (listResp.body as { result: { tools: Array<{ name: string }> } }).result.tools.map((t) => t.name);
  console.log("Tool names:", toolNames);

  // Test 2: get_digest with defaults (7 days, default repo)
  console.log("\n--- Test 2: get_digest (defaults) ---");
  const defaultResp = await callMcp("tools/call", {
    name: "get_digest",
    arguments: {},
  });
  console.log("Status:", defaultResp.status);
  console.log("Body:", JSON.stringify(defaultResp.body, null, 2));

  // Test 3: get_digest with 30 day window
  console.log("\n--- Test 3: get_digest (30 days) ---");
  const wideResp = await callMcp("tools/call", {
    name: "get_digest",
    arguments: { window_days: 30 },
  });
  console.log("Status:", wideResp.status);
  console.log("Body:", JSON.stringify(wideResp.body, null, 2));

  // Test 4: get_digest for nonexistent repo
  console.log("\n--- Test 4: get_digest for nonexistent repo ---");
  const badRepoResp = await callMcp("tools/call", {
    name: "get_digest",
    arguments: { repo_full_name: "fake/nonexistent" },
  });
  console.log("Status:", badRepoResp.status);
  console.log("Body:", JSON.stringify(badRepoResp.body, null, 2));

  // Test 5: invalid input (window_days out of range)
  console.log("\n--- Test 5: invalid input (window_days=100) ---");
  const invalidResp = await callMcp("tools/call", {
    name: "get_digest",
    arguments: { window_days: 100 },
  });
  console.log("Status:", invalidResp.status);
  console.log("Body:", JSON.stringify(invalidResp.body, null, 2));

  console.log("\n✓ Block D test complete");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
