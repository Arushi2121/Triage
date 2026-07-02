# Connecting to Triage's MCP Server

Triage exposes a Model Context Protocol (MCP) server that AI clients can use to query classified issues, detected patterns, and periodic digests from your GitHub repos.

## Available Tools

Triage exposes 3 MCP tools:

### `list_patterns`
List cross-issue patterns detected by Triage. Patterns are recurring themes across multiple issues (e.g., "Documentation quality issues", "Dev environment setup friction"). 

**Optional filters**: `repo_full_name`, `severity` (critical/high/medium/low), `category`, `limit`.

### `search_similar_issues`
Semantic search across your issues using vector embeddings. Matches on meaning, not just keywords. Useful for finding related issues, checking if a bug has been reported before, or exploring the backlog.

**Required**: `query` (natural language string, min 3 chars).
**Optional**: `repo_full_name`, `limit` (default 5, max 20), `min_similarity` (0-1, default 0.6).

### `get_digest`
Generate a structured digest of triage activity for a repo over a time window. Returns issue counts by type, PR counts by type, detected patterns, and duplicates caught.

**Optional**: `repo_full_name` (defaults to first repo), `window_days` (1-90, default 7).

## Authentication

All tools require an API key passed as a Bearer token. Generate one:

1. Ensure Triage is installed on at least one of your GitHub repos.
2. Contact the Triage admin (or run the SQL below in your Supabase console if self-hosted):
```sql
   UPDATE users
   SET api_key = 'trg_' || encode(gen_random_bytes(16), 'hex')
   WHERE github_username = 'YOUR_GITHUB_USERNAME'
   RETURNING api_key;
```
3. Save the returned key. Keep it secret.

## Endpoint

Production URL: `https://triage-orcin.vercel.app/api/mcp`

Uses JSON-RPC 2.0 over HTTP POST. Include the Bearer token in the `Authorization` header on every request.

## Connecting Claude Desktop

Claude Desktop supports remote MCP servers via its config file.

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add Triage under `mcpServers`:

```json
{
  "mcpServers": {
    "triage": {
      "url": "https://triage-orcin.vercel.app/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

Replace `YOUR_API_KEY_HERE` with your actual API key. Restart Claude Desktop. The 3 Triage tools become available in any Claude conversation.

## Example Prompts

Once connected, ask Claude:

- "What patterns has Triage detected in my repos this week?"
- "Search for issues about authentication or login problems."
- "Give me a 30-day digest of my main repo."
- "Are there any critical or high severity patterns I should know about?"

Claude will call the MCP tools and use the results to answer.

## Testing with MCP Inspector

Anthropic's MCP Inspector is a web UI for testing MCP servers manually:

```bash
npx @modelcontextprotocol/inspector
```

1. Select transport: Streamable HTTP
2. URL: `https://triage-orcin.vercel.app/api/mcp`
3. Add header: `Authorization: Bearer YOUR_API_KEY_HERE`
4. Click Connect

You can then invoke each tool interactively and inspect the JSON-RPC traffic.

## Protocol Details

- MCP Protocol Version: 2025-03-26
- Server: `triage-mcp v1.0.0`
- Transport: Streamable HTTP (stateless mode)
- Methods supported: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`
