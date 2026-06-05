# Triage — Project Context

This file is the architectural constitution of Triage. Read this file before writing or modifying any code in this repo. It explains what Triage is, how it's structured, and the rules that keep it maintainable.

## What Triage is

Triage is a Slack agent that handles the GitHub triage burden for solo and small-team open-source maintainers. It watches a maintainer's GitHub repos for incoming issues and PRs, classifies them, drafts responses for human review, catches duplicates via embeddings, surfaces patterns in a weekly digest, and escalates the items that need urgent human attention.

The user is the OSS maintainer. The surface is Slack (for now). The goal is reducing maintainer burnout.

## Target user

- Solo or 1-3 person teams maintaining libraries with 1K-50K GitHub stars
- Getting 5-30 new issues/PRs per week
- Currently spending 5-15 hours/week on triage
- Not paid full-time to maintain it

## Architectural principle: three-ring separation

Triage is built on a strict separation between business logic and delivery layer. This is the single most important rule in the codebase.

### Inner ring: src/core/

Platform-agnostic domain logic. The triage engine, duplicate detector, pattern analyzer, response drafter live here.

Code in src/core/ must:
- Take structured inputs (a GitHub issue object, a list of prior issues, etc.)
- Produce structured outputs (a TriageResult, a Duplicate match, a Pattern report, a DraftResponse)
- Know nothing about Slack, Block Kit, channels, users, or any platform-specific concept
- Never import from src/formatters/ or src/adapters/

### Middle ring: src/formatters/

Platform-specific output shapers. Takes the structured outputs from src/core/ and turns them into the shape a specific platform expects.

Currently: src/formatters/slack/ converts TriageResult → Slack Block Kit JSON.

In the future: src/formatters/whatsapp/, src/formatters/web/, etc. Each future platform gets its own folder.

Code in src/formatters/ must:
- Import from src/core/ (to know the input types)
- Never call APIs or do I/O — pure transformation
- Never import from src/adapters/

### Outer ring: src/adapters/

Platform-specific I/O. Handles webhooks coming in, API calls going out, OAuth, etc.

Currently: src/adapters/slack/ handles Slack webhooks and posts messages to Slack.

In the future: src/adapters/whatsapp/, etc.

Code in src/adapters/ must:
- Import from src/formatters/ (to get the shaped output)
- Import from src/core/ (to call the business logic)
- Be the only place that touches a platform's SDK

### Integrations: src/integrations/

External services that are not user-facing surfaces. GitHub, the LLM, the MCP server.

These are not platforms in the three-ring sense because the user doesn't interact with them directly. They're upstream services Triage uses.

src/integrations/github/ — GitHub API client and webhook handler
src/integrations/llm/ — Gemini/Claude wrappers and prompt templates
src/integrations/mcp/ — MCP server and client

### Data layer: src/db/

Supabase queries, schema, types. Used by core and adapters but never imports them.

### Shared types: src/types/

Type definitions that are shared across rings. TriageResult, Issue, DraftResponse, Pattern, etc.

## The rule that matters most

When in doubt: code that knows about Slack lives ONLY in src/formatters/slack/ and src/adapters/slack/. Nothing else in this project should import from @slack/bolt or know what Block Kit is.

If you find yourself writing a Slack API call inside src/core/triage/classify.ts, stop. That call belongs in src/adapters/slack/ instead.

## Tech stack

- TypeScript (strict mode), Next.js 15 (App Router)
- Vercel for hosting (serverless functions + Cron)
- Supabase Postgres (with pgvector for embeddings)
- Slack Bolt for JS
- GitHub App (not Personal Access Token) for repo access
- Gemini 2.5 Flash and Pro for LLM calls
- MCP TypeScript SDK for the custom MCP server

## Code conventions

- Strict TypeScript. No `any`. Use Zod for runtime validation of LLM outputs and external API responses.
- Prompts live in their own files in src/integrations/llm/prompts/. One file per prompt. Keep prompts separate from the code that calls them.
- Async/await everywhere. No callbacks.
- Errors thrown from src/core/ should be typed (custom error classes). Adapters convert these to platform-appropriate responses.
- Functions in src/core/ should be pure where possible — same input, same output, no side effects.
- All I/O happens at the edge (adapters and integrations), not in the middle.

## Naming conventions

- Files use kebab-case: `classify-issue.ts`, not `classifyIssue.ts`
- Functions and variables use camelCase
- Types and interfaces use PascalCase
- One main export per file. Helpers can be in the same file if they're tightly coupled.

## How to direct Cursor in this project

When asking Cursor to implement something, always:
1. Tell it which folder the new code should live in (enforces the three-ring rule)
2. Tell it the function's input and output types
3. Tell it what it CAN import from and what it CANNOT
4. Reference @CONTEXT.md so Cursor reads this file

Example good prompt: "Add a function to src/core/triage/classify-issue.ts that takes a GitHubIssue and returns a TriageResult. It can import from src/types/ and src/integrations/llm/. It must not import from src/formatters/ or src/adapters/."

Example bad prompt: "Add issue classification." (Too vague — Cursor will reach for the shortest path and may violate the architecture.)

## Hackathon context

Triage is being submitted to the Slack Agent Builder Challenge (Slack Agent for Good track) by July 14, 2026. Target submission date: June 29, 2026 (early submission to allow buffer for the next project).

Key submission requirements:
- Slack AI capabilities (we use Slack AI for natural language inside Slack)
- MCP server integration (custom GitHub MCP server in src/integrations/mcp/)
- Agentic multi-step workflow (intake → classify → draft → review → post)
- Real-world impact (validated through pilot with an OSS maintainer)

## Out of scope for v1

These will NOT be built before the hackathon deadline:
- Voice intake or voice responses
- Multi-language support beyond English
- Auto-posting to GitHub without human review (everything is reviewed first)
- WhatsApp, Discord, web dashboard, or any non-Slack surface
- Paid tiers or billing
- More than basic settings (digest time, urgency threshold)

If a feature isn't in this file's scope, it doesn't get built before June 29.
