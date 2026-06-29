# Deferred Items

Items intentionally postponed during development. NOT bugs. NOT missing functionality. Conscious tradeoffs with clear revisit triggers.

Last updated: 2026-06-28 (evening)

---

## Quick Index by Revisit Trigger

### Tomorrow morning (quota refresh)
- [Layer 7] Block D visual verification in Slack

### Cosmetic (anytime)
- [Layer 1] Slack app display name still shows "PilotApp" in workspace

### Before launch (last week of June 2026)
- [Layer 3] installation.created event handler
- [Layer 3] installation.deleted event handler
- [Layer 4/6/7] Gemini free tier rate limits (20 req/day insufficient for pilot)

### Pilot feedback-driven (Week of June 22-29)
- [Layer 4] Prompt quality improvements based on misclassifications
- [Layer 4] Gemini 503 retry logic if failure rate >5%
- [Layer 6] Embedding token count from Gemini SDK (defaulting to 0)
- [Layer 6] Duplicate threshold tuning (currently 0.85, calibrate during pilot)

### Feature-dependent
- [Layer 3] Octokit github_target_type fetch — when adding repo-selection UI
- [Layer 4] Background classification queue — when first background task is needed

### Post-launch hardening
- [Layer 2] Per-user LLM credentials (env var for v1)
- [Layer 2] Per-user OAuth credentials (env var for v1)
- [Layer 2] Application-level encryption (Supabase at-rest sufficient)
- [Layer 2] webhook_events partitioning
- [Layer 2] Materialized views for analytics queries
- [Layer 2] Retention policy for old webhook_events

---

## Completed Layers

### Layer 6 — Duplicate Detection (shipped 2026-06-18, polished 2026-06-28)
- Block A: Embedding generation (Gemini gemini-embedding-001, 1536 dims, semantic similarity verified at 79%/55% gap)
- Block B: DB integration (updateIssueEmbedding wired into webhook flow; embedded_at populated on every new issue)
- Block C: Similarity search via pgvector RPC function (find_similar_issues)
- Block D: Duplicate detection in core decision engine (threshold 0.85, override to flag-duplicate)
- Block E: Rich Slack display with clickable duplicate links + similarity %
- Block F: Backfill script + duplicate analysis report (idempotent, batched, demo-worthy artifact)
  - Initial bug: used RETRIEVAL_QUERY task type for document-to-document comparison
  - Fix: switched to RETRIEVAL_DOCUMENT on both sides
  - Threshold raised from 0.80 to 0.85 to eliminate category-clustering false positives

---

## Full Details

### [Layer 1] Slack display name "PilotApp"
**What:** The Slack app's bot was originally named "PilotApp" before being renamed to "Triage" in api.slack.com. The display name in the workspace still shows the old name.
**Why deferred:** Cosmetic. Doesn't affect functionality.
**Revisit trigger:** Anytime — 5 min fix in Slack app settings.

### [Layer 3] installation.created event handler
**What:** Webhook event fired when someone installs Triage on a new GitHub account. Should bootstrap user + installation rows.
**Why deferred:** User + installation rows get created on first issue webhook anyway. No user-facing impact until onboarding flows exist.
**Revisit trigger:** Before launch OR when adding Slack onboarding flow OR when a user complains "I installed but nothing happened."

### [Layer 3] installation.deleted event handler
**What:** Webhook event fired when someone uninstalls Triage. Should set installations.uninstalled_at = NOW().
**Why deferred:** GitHub stops sending webhooks after uninstall, so no stale data processing. DB just shows users as "still installed" cosmetically.
**Revisit trigger:** Before launch OR when adding usage analytics.

### [Layer 3] Octokit github_target_type fetching
**What:** Currently hardcoded to 'all' in upsertInstallation calls. Real value (all repos vs specific repos) should come from GitHub API.
**Why deferred:** Column unused by any feature yet.
**Revisit trigger:** When adding repo-selection UI OR when filtering installations by target_type.

### [Layer 4] Prompt quality improvements
**What:** Stress-tested with 6 adversarial issues. 4/6 correct. Misses:
- User-environment problems (e.g., missing Python for node-gyp) classified as bugs instead of question/documentation
- Multi-category ambiguity given inflated confidence (0.98 instead of ~0.7)
**Why deferred:** Real iteration data comes from pilot users, not synthetic tests.
**Revisit trigger:** After 1 week of pilot data. Add 2-3 adversarial examples targeting observed failure modes.

### [Layer 4] Gemini 503 retry logic
**What:** Gemini 2.5 Flash occasionally returns 503 (UNAVAILABLE). Currently logged + classificationFailed=true + flow continues.
**Why deferred:** Graceful degradation already works. Retry adds latency.
**Revisit trigger:** If 503 rate exceeds 5% during pilot. Add exponential backoff (1 retry, 2s delay).

### [Layer 4] Background classification queue
**What:** For issues where classification failed, retry later via background worker.
**Why deferred:** Requires infrastructure (Vercel Cron or queue). Lossy behavior acceptable for v1.
**Revisit trigger:** Layer 7+ when multiple background tasks need similar infrastructure.

### [Layer 6] Embedding token count from Gemini SDK
**What:** Gemini SDK 2.8 doesn't expose embedding token counts at response.embeddings[0].statistics.tokenCount. Currently defaulting to 0 in src/integrations/llm/embed.ts.
**Why deferred:** Token counts are for cost tracking. Embeddings are free in current Gemini usage tier. Non-blocking for v1.
**Revisit trigger:** Pre-launch cost audit, or if Gemini SDK updates expose this field, or if usage tier moves to paid.

### [Layer 6] Duplicate threshold tuning
**What:** DUPLICATE_SIMILARITY_THRESHOLD is set to 0.85 in src/core/triage/decide.ts based on Block A semantic similarity tests (similar issues scored ~0.79 in synthetic test).
**Why deferred:** Real-world calibration requires actual repo data and maintainer feedback. May need to be lowered (catch more) or raised (fewer false positives).
**Revisit trigger:** Pilot week. Track false positives and false negatives. Adjust threshold based on real maintainer feedback.

### [Layer 7] Block D visual verification
**What:** Block D rendered correctly per unit tests (11 passing) but Slack visual verification was blocked by Gemini free-tier quota (20 req/day exhausted).
**Why deferred:** Gemini quota resets at midnight Pacific. Trivial test once quota refreshes.
**Revisit trigger:** Tomorrow morning — open one test issue, screenshot the Slack message, verify draft block + Approve/Skip buttons render correctly.

### [Layer 4/6/7] Gemini free tier rate limits
**What:** Gemini 2.5 Flash free tier is 20 requests/day. Each Triage webhook uses 3-5 calls (classify, embed, draft, sometimes duplicate detection). Realistically supports ~5-6 issues/day in testing.
**Why deferred:** Acceptable for solo development. NOT acceptable for pilot users (a real maintainer would hit this in their first hour).
**Revisit trigger:** BEFORE PILOT LAUNCH. Either upgrade Gemini billing tier OR move to paid model. Estimated cost at pilot volume: $0.10-1.00/day per maintainer.

### [Layer 2] Per-user LLM credentials
**What:** Currently single GEMINI_API_KEY env var. Future: each user provides their own.
**Why deferred:** Post-launch concern. v1 uses Triage's own credentials.
**Revisit trigger:** Post-launch when scaling beyond pilot OR when first user requests their own key.

### [Layer 2] Per-user OAuth credentials
**What:** Currently single GitHub App credentials. Future: per-user Slack OAuth.
**Why deferred:** Single Slack workspace for now (pilot only).
**Revisit trigger:** When supporting multiple Slack workspaces.

### [Layer 2] Application-level encryption
**What:** Currently relying on Supabase encryption-at-rest. Future: encrypt sensitive columns (raw_llm_response, payloads) at app layer.
**Why deferred:** Supabase encryption is sufficient for pilot scope.
**Revisit trigger:** Pre-launch security review OR if processing sensitive customer data.

### [Layer 2] webhook_events partitioning
**What:** webhook_events grows unbounded. Partitioning by month would improve query performance.
**Why deferred:** Volume too low to matter for v1.
**Revisit trigger:** When webhook_events exceeds 1M rows OR query performance degrades.

### [Layer 2] Materialized views for analytics
**What:** Common analytics queries (pattern detection, digest generation) might benefit from precomputed views.
**Why deferred:** Profile before optimizing. Don't speculate.
**Revisit trigger:** When digest generation in Layer 9 is slow OR analytics queries hit timeouts.

### [Layer 2] webhook_events retention policy
**What:** webhook_events grows unbounded forever. Need policy: archive >90 days old? Delete?
**Why deferred:** Volume too low. No storage pressure yet.
**Revisit trigger:** Pre-launch operational review OR when Supabase storage exceeds plan limits.

---

## How to Use This File

When making a decision to defer something during development:
1. Add an entry under Full Details with What/Why/Trigger
2. Add the one-liner to the Quick Index under the appropriate trigger
3. Commit with the layer's other work

When picking up deferred work:
1. Find it in the Quick Index
2. Read full details
3. Move the entry to a "Completed" section at the bottom (don't delete — preserves history)
