import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MCP_ENDPOINT = process.env.MCP_TEST_ENDPOINT ?? "http://localhost:3000/api/mcp";
const API_KEY = process.env.MCP_TEST_API_KEY;

async function main() {
  console.log("=== Testing Layer 10 Block A: MCP scaffolding ===");
  console.log(`Endpoint: ${MCP_ENDPOINT}`);
  
  if (!API_KEY) {
    console.error("Missing MCP_TEST_API_KEY in .env.local");
    console.error("Set it to a test API key (after applying migration + generating a key)");
    process.exit(1);
  }
  
  // Test 1: Health check without auth
  console.log("\n--- Test 1: GET / (no auth) ---");
  const healthNoAuth = await fetch(MCP_ENDPOINT);
  const healthNoAuthJson = await healthNoAuth.json();
  console.log("Status:", healthNoAuth.status);
  console.log("Body:", healthNoAuthJson);
  
  // Test 2: Health check with auth
  console.log("\n--- Test 2: GET / (with auth) ---");
  const healthAuth = await fetch(MCP_ENDPOINT, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const healthAuthJson = await healthAuth.json();
  console.log("Status:", healthAuth.status);
  console.log("Body:", healthAuthJson);
  
  // Test 3: POST initialize (MCP handshake)
  console.log("\n--- Test 3: POST initialize ---");
  const initResp = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "triage-test-client", version: "0.1.0" },
      },
    }),
  });
  console.log("Status:", initResp.status);
  const initText = await initResp.text();
  console.log("Body:", initText);
  
  // Test 4: POST tools/list (should return empty array in Block A)
  console.log("\n--- Test 4: POST tools/list ---");
  const toolsResp = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
  console.log("Status:", toolsResp.status);
  const toolsText = await toolsResp.text();
  console.log("Body:", toolsText);
  
  console.log("\n✓ Block A test complete — check responses above");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
