# Scaling Roadmap: Single-Tenant Demo → Multi-Tenant Product

## Current State

The architecture works for 1-5 pilot users. This document outlines the path to opening publicly and scaling to thousands of users.

---

## Priority 1: Must Fix Before Public Launch

These items are **blockers** for public launch. Without them, the app will fail or expose security/reliability issues at even modest scale.

### 1.1 Slack OAuth v2 Install Flow

**Problem:** Current setup assumes a single workspace. Multi-workspace installs will overwrite each other.

**Solution:** Implement `installationStore` in Slack Bolt config
- Store installation tokens per team/enterprise in database
- Reference: [@slack/bolt Installation Store docs](https://slack.dev/bolt-js/concepts#authenticating-oauth)
- Tables needed: Already have `installations` table, ensure proper OAuth token storage

**Effort:** 1-2 days

---

### 1.2 Remove TEMP_DEFAULT_CHANNEL

**Problem:** Hardcoded channel routing prevents per-user/per-workspace configuration.

**Solution:** Use `notification_targets` table to route notifications
- Query user's preferred channel from `notification_targets` by user_id + workspace
- Fall back to DM if no channel configured
- Remove `TEMP_DEFAULT_CHANNEL` constant from codebase

**Effort:** 4-6 hours

**Files affected:**
- `src/adapters/slack/notifications.ts` (likely)
- Any file using `TEMP_DEFAULT_CHANNEL`

---

### 1.3 Rate Limiting

**Problem:** Webhook and Slack endpoints are unprotected. Malicious actors or bugs could cause runaway costs or DoS.

**Solution:** Implement rate limiting on critical endpoints
- GitHub webhook endpoint: 100 requests/min per installation_id
- Slack events endpoint: 50 requests/min per workspace_id
- Slack commands endpoint: 20 requests/min per user_id

**Options:**
- **Upstash Redis** (recommended): `@upstash/ratelimit` package
- **Vercel Edge Config**: Native Vercel integration
- **Supabase RLS + Postgres**: DB-based rate limiting (slower)

**Effort:** 1 day

**Reference:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});
```

---

### 1.4 Error Tracking (Sentry or equivalent)

**Problem:** Console.log is insufficient for production debugging. No visibility into errors affecting real users.

**Solution:** Integrate error tracking service
- **Sentry** (recommended): Best-in-class, free tier covers pilot
- **Datadog RUM**: Alternative if already using Datadog
- **Vercel Analytics**: Built-in but less detailed

**Must track:**
- All webhook handler errors
- Slack command failures
- Digest generation failures
- LLM API errors (rate limits, timeouts)

**Effort:** 4-6 hours (Sentry SDK + basic config)

**Setup:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

---

## Priority 2: Before Serious Growth

These items prevent scaling pain but aren't launch blockers. Implement before you have >50 active users or start charging money.

### 2.1 Web-Based OAuth Linking

**Problem:** Current lazy DM linking flow is manual and friction-heavy. Users don't understand the linking prompt.

**Solution:** Build web flow for Slack + GitHub OAuth
- Landing page: "Connect your Slack workspace"
- OAuth flow: Slack → GitHub → success screen
- Redirect to Slack after completion
- Replace DM-based `sendLinkingPrompt()` with web link

**Effort:** 2-3 days

**Pages needed:**
- `/connect` - Landing page
- `/auth/github/callback` - GitHub OAuth callback
- `/auth/slack/callback` - Slack OAuth callback
- `/success` - Post-linking confirmation

---

### 2.2 Per-User Gemini API Keys OR Usage Tracking

**Problem:** Current setup uses a single shared Gemini API key. High usage by one user affects everyone. No cost control.

**Solution (pick one):**

**Option A: Per-user API keys (enterprise model)**
- Add `gemini_api_key` column to `users` table (encrypted)
- Allow users to BYOK (Bring Your Own Key)
- No usage limits needed

**Option B: Usage tracking + throttling (SaaS model)**
- Track API calls per user (new table: `gemini_usage`)
- Implement monthly quotas (e.g., 100 digest generations/user/month)
- Return 429 when quota exceeded
- Offer paid tiers for higher limits

**Effort:** 
- Option A: 1 day
- Option B: 2-3 days

---

### 2.3 Row-Level Security (RLS) on Supabase

**Problem:** Application-level auth is the only defense. If a service key leaks or there's a bug, all data is exposed.

**Solution:** Enable RLS policies on all tables
- `users`: Can only read/update own row
- `issues`, `pull_requests`: Can only access via owned `repos`
- `repos`: Can only access via owned `installations`
- `installations`: Can only access own installations

**Effort:** 1-2 days (write + test policies)

**Reference:** [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

---

### 2.4 Structured Logging with Correlation IDs

**Problem:** Current logging is unstructured console.log. Hard to trace a single request through multiple async operations.

**Solution:** Implement structured logging
- Use `pino` or `winston` for structured JSON logs
- Generate correlation IDs for each webhook/command
- Thread correlation ID through all async operations
- Log: timestamp, level, correlation_id, user_id, repo_id, message, metadata

**Effort:** 1 day

**Example:**
```typescript
import pino from "pino";
const logger = pino();

logger.info({
  correlation_id: "req_abc123",
  user_id: "user_456",
  repo_id: "repo_789",
  event: "digest_started",
  window_days: 7
});
```

---

## Priority 3: For 10K+ Users

These are true scale problems. Don't pre-optimize. Wait for actual performance issues before implementing.

### 3.1 HNSW Index for pgvector

**Problem:** Current IVFFlat index degrades at high volume. Similarity search becomes slow with >100K issue vectors.

**Solution:** Switch to HNSW (Hierarchical Navigable Small World) index
- Better query performance at scale
- More consistent latency
- Higher memory usage (acceptable tradeoff)

**Effort:** 2 hours (re-index)

**SQL:**
```sql
-- Drop old index
DROP INDEX IF EXISTS issue_embeddings_ivfflat_idx;

-- Create HNSW index
CREATE INDEX issue_embeddings_hnsw_idx 
ON issues 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Trigger:** Query latency >500ms or >100K total issues

---

### 3.2 Table Partitioning

**Problem:** Large tables slow down queries, backups, and maintenance.

**Solution:** Partition high-traffic tables by time or tenant
- `issues`: Partition by `created_at` (monthly or quarterly)
- `pull_requests`: Partition by `created_at`
- `webhook_events`: Partition by `received_at` (daily), with aggressive retention

**Effort:** 1-2 days (migration + testing)

**Trigger:** Tables exceed 10M rows or query planning slows significantly

---

### 3.3 Supabase Read Replicas

**Problem:** Heavy read load (digest generation, similarity queries) impacts write performance.

**Solution:** Add read replicas
- Route all read-only queries to replica
- Use primary only for writes
- Supabase Pro plan includes read replicas

**Effort:** 4-6 hours (configure + update connection logic)

**Trigger:** Primary database CPU consistently >70%

---

### 3.4 Per-Tenant Database Sharding

**Problem:** Single Postgres instance becomes bottleneck. Multi-region latency issues.

**Solution:** Shard by tenant (workspace or organization)
- Route tenant A → Database A, tenant B → Database B
- Requires significant app refactor (tenant-aware connection pooling)
- Consider managed sharding solutions (Citus, Vitess) first

**Effort:** 2-4 weeks (major refactor)

**Trigger:** >1M total users or need for multi-region active-active

---

## Why Deferred?

**Hackathon Scope:** 1-5 pilot users demonstrate product value.

**Scale work is real engineering** (~4-8 weeks total for Priority 1-2) but doesn't move hackathon judging outcomes. Focus on:
1. Working demo with compelling use cases
2. Clean user experience for pilot users
3. Evidence of product-market fit signals

**Post-pilot signal**, execute Priority 1 before public launch. Scale work becomes ROI-positive only after validation.

---

## Decision Log

| Priority | Item | Status | Implemented | Notes |
|----------|------|--------|-------------|-------|
| P1 | Slack OAuth v2 | Pending | - | Blocker for multi-workspace |
| P1 | Remove TEMP_DEFAULT_CHANNEL | Pending | - | Blocker for per-user routing |
| P1 | Rate limiting | Pending | - | Security/cost risk |
| P1 | Sentry integration | Pending | - | Observability baseline |
| P2 | Web OAuth linking | Pending | - | UX improvement |
| P2 | Usage tracking | Pending | - | Cost control |
| P2 | RLS policies | Pending | - | Defense in depth |
| P2 | Structured logging | Pending | - | Debugging at scale |
| P3 | HNSW index | Pending | - | Performance at 100K+ issues |
| P3 | Table partitioning | Pending | - | Database maintenance |
| P3 | Read replicas | Pending | - | Read/write separation |
| P3 | Database sharding | Pending | - | True scale (1M+ users) |

---

## Next Steps

1. **Finish hackathon demo** (current focus)
2. **Pilot with 3-5 users** → gather feedback
3. **Implement Priority 1 items** → prepare for public launch
4. **Monitor metrics** → implement Priority 2/3 as needed

---

*Last updated: 2026-07-02*
