# Triage Schema v1 — Design Document

Last updated: 2026-06-08
Status: Locked. This is the source of truth for the initial database schema.

## Overview

This document specifies the database schema for Triage v1. It contains 13 tables that together support: GitHub repo management, issue ingestion and classification, draft response generation, action tracking, duplicate detection, pattern detection, and weekly digest generation.

The schema is platform-agnostic where it matters. Slack-specific data lives in JSONB config columns, not in dedicated tables, so adding WhatsApp/Discord/email later requires no schema migration — only application code.

## Prerequisites

Before running any migration, the following Postgres extensions must be enabled in Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

The `vector` extension provides the `vector(n)` type used in the issues table for duplicate detection via embeddings.

## Naming Conventions

- Table names: lowercase, snake_case, plural (e.g., `notification_targets` not `NotificationTarget`)
- Column names: lowercase, snake_case
- Primary keys: always `id` of type UUID
- Foreign keys: `<table>_id` (e.g., `user_id`, `repo_id`)
- Timestamps: TIMESTAMPTZ (with timezone), suffixed `_at` (e.g., `created_at`)
- Booleans: prefixed `is_` or descriptive verbs (e.g., `is_active`, `triage_enabled`)
- JSONB columns: descriptive nouns (e.g., `config`, `payload`, `metrics`)

## Common Patterns

### UUIDs

All primary keys are UUIDs generated with `gen_random_uuid()`. No serial/auto-increment integers.

### Soft Delete

Most tables have a nullable `deleted_at` column. Setting this to NOW() instead of DELETE preserves history and foreign key integrity. All read queries must filter `WHERE deleted_at IS NULL`.

Tables WITHOUT soft delete: `webhook_events`, `actions`, `issue_patterns`, `digests`. These are append-only or join tables where deletion isn't meaningful.

### Timestamps

Every table has:
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

The `updated_at` should be updated on every row modification. Use a trigger or handle in application code.

### Foreign Key ON DELETE Behavior

Specified explicitly for every FK. Default is RESTRICT (prevents deletion if dependents exist). Other values used:
- CASCADE: dependent rows are deleted when parent is deleted
- SET NULL: dependent FK becomes NULL when parent is deleted

---

## Table 1: users

**Purpose:** A person who has installed Triage on at least one GitHub account.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  github_avatar_url TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
```

**Indexes:**
- Primary key on `id`
- Unique index on `github_id` (enforced by UNIQUE constraint)
- Conditional unique index on `email` where present and not deleted

**Notes:**
- `github_id` is GitHub's permanent user ID; usernames may change, IDs do not
- `github_username` is denormalized for display
- `timezone` is critical for digest delivery timing
- No password column; auth is via GitHub OAuth only

---

## Table 2: installations

**Purpose:** A GitHub App installation, mapping a user to an account (personal or org) where Triage is installed.

```sql
CREATE TABLE installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  github_installation_id BIGINT UNIQUE NOT NULL,
  github_account_login TEXT NOT NULL,
  github_account_id BIGINT NOT NULL,
  github_account_type TEXT NOT NULL,
  github_target_type TEXT NOT NULL,
  suspended_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT installations_account_type_check CHECK (github_account_type IN ('User', 'Organization')),
  CONSTRAINT installations_target_type_check CHECK (github_target_type IN ('all', 'selected'))
);

CREATE INDEX installations_user_id_idx ON installations(user_id);
```

**Indexes:**
- Primary key on `id`
- Unique on `github_installation_id`
- Index on `user_id`

**Notes:**
- No token storage; tokens are derived on-demand from the private key + installation ID
- `suspended_at` is for temporary disable; `uninstalled_at` is for permanent removal
- ON DELETE RESTRICT on user_id prevents deleting a user with active installations

---

## Table 3: repos

**Purpose:** A GitHub repository where Triage is active.

```sql
CREATE TABLE repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE RESTRICT,
  github_repo_id BIGINT UNIQUE NOT NULL,
  github_full_name TEXT NOT NULL,
  github_default_branch TEXT NOT NULL DEFAULT 'main',
  github_private BOOLEAN NOT NULL DEFAULT false,
  star_count INTEGER NOT NULL DEFAULT 0,
  issue_count_open INTEGER NOT NULL DEFAULT 0,
  language_primary TEXT,
  description TEXT,
  triage_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX repos_installation_id_idx ON repos(installation_id);
CREATE INDEX repos_full_name_idx ON repos(github_full_name);
```

**Indexes:**
- Primary key on `id`
- Unique on `github_repo_id`
- Index on `installation_id` (FK lookup)
- Index on `github_full_name` (webhook lookup)

**Notes:**
- Cached metrics (star_count, issue_count_open, language_primary, description) reduce GitHub API calls
- `triage_enabled = false` is a kill switch — webhooks still received but no triage actions
- ON DELETE RESTRICT on installation_id prevents accidental orphaning

---

## Table 4: notification_targets

**Purpose:** Where to deliver Triage messages. Uses a hybrid pattern: user-level default + per-repo override.

```sql
CREATE TABLE notification_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  config JSONB NOT NULL,
  credentials_ref TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT notification_targets_platform_check CHECK (platform IN ('slack', 'whatsapp', 'discord', 'email'))
);

CREATE UNIQUE INDEX notification_targets_user_repo_platform_unique 
  ON notification_targets(user_id, COALESCE(repo_id, '00000000-0000-0000-0000-000000000000'::UUID), platform) 
  WHERE deleted_at IS NULL;

CREATE INDEX notification_targets_user_repo_idx ON notification_targets(user_id, repo_id);
CREATE INDEX notification_targets_platform_idx ON notification_targets(platform);
```

**Indexes:**
- Primary key on `id`
- Conditional unique on (user_id, repo_id, platform) — uses COALESCE to handle NULL repo_id
- Composite index on (user_id, repo_id) for the hybrid lookup query
- Index on platform

**Notes:**
- `config` JSONB shape depends on platform; validated in application code via Zod
- `repo_id NULL` means "user default"; `repo_id` set means "override for this repo"
- `credentials_ref` is a pointer to where credentials live (env var for v1, separate credentials table later)
- ON DELETE CASCADE on repo_id: if a repo is removed, its notification overrides are removed too
- The unique constraint uses COALESCE because Postgres treats NULL as not-equal, so we need a sentinel value

**Example config:**
```json
{
  "workspace_id": "T0B5PTQNCQ6",
  "channel_id": "C0B5AG6F747"
}
```

---

## Table 5: issues

**Purpose:** Current state of every GitHub issue Triage has seen. One row per issue.

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE RESTRICT,
  github_issue_id BIGINT UNIQUE NOT NULL,
  github_issue_number INTEGER NOT NULL,
  github_node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,
  author_github_id BIGINT NOT NULL,
  author_github_login TEXT NOT NULL,
  author_association TEXT NOT NULL,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments_count INTEGER NOT NULL DEFAULT 0,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pull_request BOOLEAN NOT NULL DEFAULT false,
  embedding vector(1536),
  embedding_model TEXT,
  embedded_at TIMESTAMPTZ,
  github_created_at TIMESTAMPTZ NOT NULL,
  github_updated_at TIMESTAMPTZ NOT NULL,
  github_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT issues_state_check CHECK (state IN ('open', 'closed'))
);

CREATE INDEX issues_repo_id_idx ON issues(repo_id);
CREATE INDEX issues_repo_state_idx ON issues(repo_id, state) WHERE deleted_at IS NULL;
CREATE INDEX issues_github_updated_at_idx ON issues(github_updated_at DESC);
CREATE INDEX issues_embedding_idx ON issues USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;
```

**Indexes:**
- Primary key on `id`
- Unique on `github_issue_id`
- Index on `repo_id`
- Partial composite index on (repo_id, state) where not deleted
- Index on github_updated_at DESC
- pgvector IVFFlat index on embedding for similarity search

**Notes:**
- Triple timestamps: `github_created_at` (from GitHub), `created_at` (when we stored it), `github_updated_at` (last GitHub modification)
- `embedding` is nullable; population is async via background job
- `is_pull_request` filters PR-only or issue-only queries cleanly
- JSONB defaults specified to prevent NULL surprises in application code

---

## Table 6: webhook_events

**Purpose:** Audit log of every GitHub webhook received. Append-only, never updated except processing_status.

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE RESTRICT,
  repo_id UUID REFERENCES repos(id) ON DELETE SET NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  github_delivery_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_action TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received',
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_events_status_check CHECK (processing_status IN ('received', 'processing', 'completed', 'failed', 'skipped'))
);

CREATE INDEX webhook_events_installation_idx ON webhook_events(installation_id);
CREATE INDEX webhook_events_repo_received_idx ON webhook_events(repo_id, received_at DESC);
CREATE INDEX webhook_events_event_type_idx ON webhook_events(event_type, event_action);
CREATE INDEX webhook_events_unfinished_idx ON webhook_events(processing_status) WHERE processing_status != 'completed';
```

**Indexes:**
- Primary key on `id`
- Unique on `github_delivery_id` (idempotency)
- Index on installation_id
- Composite index on (repo_id, received_at DESC)
- Index on (event_type, event_action)
- Partial index on processing_status for unfinished rows only

**Notes:**
- No soft delete; this is append-only audit data
- ON DELETE SET NULL on repo_id and issue_id allows audit history to survive their parents
- `payload` stores full raw webhook body for debugging
- `signature_valid = false` rows track potential attack attempts

---

## Table 7: classifications

**Purpose:** LLM's structured analysis of each issue. One per issue (UPDATE on re-classify).

```sql
CREATE TABLE classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  suggested_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(3,2) NOT NULL,
  reasoning TEXT NOT NULL,
  raw_llm_response JSONB NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  llm_model TEXT NOT NULL,
  llm_temperature NUMERIC(3,2) NOT NULL,
  token_count_input INTEGER NOT NULL,
  token_count_output INTEGER NOT NULL,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classifications_type_check CHECK (issue_type IN ('bug', 'feature', 'question', 'duplicate', 'spam', 'documentation', 'discussion')),
  CONSTRAINT classifications_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low', 'none')),
  CONSTRAINT classifications_confidence_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX classifications_issue_id_idx ON classifications(issue_id);
CREATE INDEX classifications_type_severity_idx ON classifications(issue_type, severity);
CREATE INDEX classifications_confidence_idx ON classifications(confidence);
CREATE INDEX classifications_classified_at_idx ON classifications(classified_at DESC);
```

**Indexes:**
- Primary key on `id`
- Unique on `issue_id` (one classification per issue)
- Index on issue_id
- Composite index on (issue_type, severity)
- Index on confidence
- Index on classified_at DESC

**Notes:**
- ON DELETE CASCADE on issue_id: classification has no meaning without its issue
- NUMERIC(3,2) for confidence prevents floating-point comparison bugs
- `raw_llm_response` mandatory for debugging

---

## Table 8: drafts

**Purpose:** Proposed responses to issues, with full lifecycle tracking.

```sql
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  classification_id UUID NOT NULL REFERENCES classifications(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  draft_type TEXT NOT NULL,
  content TEXT NOT NULL,
  edited_content TEXT,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  raw_llm_response JSONB NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  llm_model TEXT NOT NULL,
  llm_temperature NUMERIC(3,2) NOT NULL,
  token_count_input INTEGER NOT NULL,
  token_count_output INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT drafts_status_check CHECK (status IN ('pending', 'approved', 'edited', 'rejected', 'expired', 'posted')),
  CONSTRAINT drafts_type_check CHECK (draft_type IN ('comment', 'label-application', 'close-as-duplicate', 'close-as-spam', 'request-info'))
);

CREATE INDEX drafts_issue_id_idx ON drafts(issue_id);
CREATE INDEX drafts_pending_idx ON drafts(status, created_at) WHERE status = 'pending';
CREATE INDEX drafts_reviewed_by_idx ON drafts(reviewed_by_user_id) WHERE reviewed_by_user_id IS NOT NULL;
```

**Indexes:**
- Primary key on `id`
- Index on issue_id
- Partial index on (status, created_at) for pending drafts only
- Conditional index on reviewed_by_user_id

**Notes:**
- ON DELETE CASCADE on issue_id; RESTRICT on classification_id (preserve classification audit)
- SET NULL on reviewed_by_user_id allows user deletion without losing draft history
- `content` is immutable; `edited_content` captures maintainer changes

---

## Table 9: actions

**Purpose:** Things Triage actually did. Outcome layer.

```sql
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE RESTRICT,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  target_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  response JSONB,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT actions_actor_check CHECK (actor_type IN ('user', 'triage')),
  CONSTRAINT actions_type_check CHECK (action_type IN (
    'github-comment-posted',
    'github-label-applied',
    'github-label-removed',
    'github-issue-closed',
    'github-issue-reopened',
    'slack-card-posted',
    'slack-card-updated',
    'slack-dm-sent',
    'slack-digest-posted',
    'whatsapp-message-sent'
  )),
  CONSTRAINT actions_platform_check CHECK (target_platform IN ('github', 'slack', 'whatsapp', 'discord', 'email')),
  CONSTRAINT actions_status_check CHECK (status IN ('pending', 'in-flight', 'completed', 'failed', 'retrying'))
);

CREATE INDEX actions_repo_created_idx ON actions(repo_id, created_at DESC);
CREATE INDEX actions_issue_created_idx ON actions(issue_id, created_at DESC);
CREATE INDEX actions_draft_id_idx ON actions(draft_id) WHERE draft_id IS NOT NULL;
CREATE INDEX actions_retry_idx ON actions(status, retry_count) WHERE status IN ('failed', 'retrying');
```

**Indexes:**
- Primary key on `id`
- Composite (repo_id, created_at DESC)
- Composite (issue_id, created_at DESC)
- Partial index on draft_id where not null
- Partial index on (status, retry_count) for retry workers

**Notes:**
- No soft delete; actions are immutable audit records
- SET NULL on issue_id and draft_id allows their deletion without losing action history
- `target_ref` is platform-specific identifier (e.g., GitHub comment URL, Slack message ts)

---

## Table 10: issue_duplicates

**Purpose:** Cross-issue duplicate relationships.

```sql
CREATE TABLE issue_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  duplicate_of_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE RESTRICT,
  confidence NUMERIC(3,2) NOT NULL,
  similarity_score NUMERIC(4,3) NOT NULL,
  reasoning TEXT NOT NULL,
  detection_method TEXT NOT NULL,
  raw_llm_response JSONB,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'suggested',
  linked_action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT issue_duplicates_no_self CHECK (source_issue_id != duplicate_of_issue_id),
  CONSTRAINT issue_duplicates_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT issue_duplicates_similarity_check CHECK (similarity_score >= 0 AND similarity_score <= 1),
  CONSTRAINT issue_duplicates_status_check CHECK (status IN ('suggested', 'confirmed', 'rejected', 'auto-confirmed')),
  CONSTRAINT issue_duplicates_method_check CHECK (detection_method IN ('embedding-similarity', 'llm-judgment', 'manual', 'hybrid')),
  CONSTRAINT issue_duplicates_unique UNIQUE (source_issue_id, duplicate_of_issue_id)
);

CREATE INDEX issue_duplicates_source_idx ON issue_duplicates(source_issue_id);
CREATE INDEX issue_duplicates_target_idx ON issue_duplicates(duplicate_of_issue_id);
CREATE INDEX issue_duplicates_status_idx ON issue_duplicates(status, detected_at DESC);
CREATE INDEX issue_duplicates_confidence_idx ON issue_duplicates(confidence DESC);
```

**Indexes:**
- Primary key on `id`
- Both source and target FK indexes for bidirectional queries
- Composite (status, detected_at DESC)
- Index on confidence DESC

**Notes:**
- CASCADE on source: if source issue deleted, dup suggestion is gone
- RESTRICT on duplicate_of: cannot delete an issue while others reference it as duplicate
- Application code must normalize direction (source = newer, duplicate_of = older)

---

## Table 11: patterns

**Purpose:** Cross-issue findings detected over time.

```sql
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  issue_count INTEGER NOT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reasoning TEXT NOT NULL,
  suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_llm_response JSONB NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  llm_model TEXT NOT NULL,
  llm_temperature NUMERIC(3,2) NOT NULL,
  token_count_input INTEGER NOT NULL,
  token_count_output INTEGER NOT NULL,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT patterns_category_check CHECK (category IN ('performance', 'documentation', 'usability', 'compatibility', 'feature-request', 'bug-cluster', 'workflow-friction', 'other')),
  CONSTRAINT patterns_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT patterns_status_check CHECK (status IN ('active', 'monitoring', 'resolved', 'dismissed')),
  CONSTRAINT patterns_count_check CHECK (issue_count >= 0)
);

CREATE INDEX patterns_repo_status_severity_idx ON patterns(repo_id, status, severity);
CREATE INDEX patterns_repo_last_detected_idx ON patterns(repo_id, last_detected_at DESC);
CREATE INDEX patterns_category_idx ON patterns(category);
CREATE INDEX patterns_active_idx ON patterns(repo_id) WHERE status = 'active';
```

**Indexes:**
- Primary key on `id`
- Composite (repo_id, status, severity) for digest queries
- Composite (repo_id, last_detected_at DESC)
- Index on category
- Partial index on repo_id where status = 'active'

**Notes:**
- CASCADE on repo_id: patterns are scoped to their repo
- `issue_count` is denormalized; updated when issue_patterns rows are added/removed

---

## Table 12: issue_patterns

**Purpose:** Many-to-many join between issues and patterns.

```sql
CREATE TABLE issue_patterns (
  pattern_id UUID NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  confidence NUMERIC(3,2) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_method TEXT NOT NULL,
  PRIMARY KEY (pattern_id, issue_id),
  CONSTRAINT issue_patterns_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT issue_patterns_method_check CHECK (added_method IN ('llm-detection', 'manual', 'similarity-clustering'))
);

CREATE INDEX issue_patterns_issue_idx ON issue_patterns(issue_id);
```

**Indexes:**
- Composite primary key (pattern_id, issue_id)
- Index on issue_id (for "what patterns is this issue in?")

**Notes:**
- No surrogate `id` column; composite PK is the identity
- CASCADE on both sides; join rows have no meaning without both parents

---

## Table 13: digests

**Purpose:** Periodic summary records.

```sql
CREATE TABLE digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  sections JSONB NOT NULL,
  metrics JSONB NOT NULL,
  included_repo_ids JSONB NOT NULL,
  raw_llm_response JSONB NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  llm_model TEXT NOT NULL,
  llm_temperature NUMERIC(3,2) NOT NULL,
  token_count_input INTEGER NOT NULL,
  token_count_output INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT digests_period_type_check CHECK (period_type IN ('weekly', 'monthly', 'daily', 'ad-hoc')),
  CONSTRAINT digests_status_check CHECK (status IN ('generated', 'queued', 'sent', 'failed', 'skipped')),
  CONSTRAINT digests_period_check CHECK (period_end > period_start)
);

CREATE INDEX digests_user_generated_idx ON digests(user_id, generated_at DESC);
CREATE INDEX digests_pending_idx ON digests(status, generated_at) WHERE status IN ('queued', 'failed');
CREATE INDEX digests_period_idx ON digests(period_start, period_end);
```

**Indexes:**
- Primary key on `id`
- Composite (user_id, generated_at DESC)
- Partial index for pending/failed deliveries
- Composite (period_start, period_end)

**Notes:**
- CASCADE on user_id; digests don't outlive their users
- SET NULL on delivery_action_id
- Multiple digests for same period are allowed (e.g., for re-generation with new prompt)

---

## Cross-cutting Concerns

### Soft-delete Query Discipline

Every query that reads from these tables (where applicable) must include `WHERE deleted_at IS NULL`:
- users
- repos
- notification_targets
- issues
- classifications (no soft-delete needed; cascades from issue)
- drafts (no soft-delete needed; cascades from issue)
- patterns

Implement helper functions in `src/db/` that wrap queries with the filter so it's not forgotten.

### Migration Order

Tables must be created in this order due to FK dependencies:

1. users
2. installations (depends on users)
3. repos (depends on installations)
4. notification_targets (depends on users, repos)
5. issues (depends on repos)
6. webhook_events (depends on installations, repos, issues)
7. classifications (depends on issues)
8. drafts (depends on issues, classifications, users)
9. actions (depends on users, repos, issues, drafts)
10. issue_duplicates (depends on issues, users, actions)
11. patterns (depends on repos, users)
12. issue_patterns (depends on patterns, issues)
13. digests (depends on users, actions)

### Encryption

Supabase encrypts data at rest by default. For v1 this is sufficient for `notification_targets.credentials_ref` and any token storage. Application-level encryption is deferred to post-launch.

### Trigger for updated_at

Add a trigger on every table with `updated_at` to auto-update it on row modifications:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to each table:
CREATE TRIGGER update_<table>_updated_at BEFORE UPDATE ON <table>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Apply to: users, installations, repos, notification_targets, issues, classifications, drafts, actions, issue_duplicates, patterns, digests.

NOT needed for: webhook_events, issue_patterns (no updated_at column).

---

## Out of Scope (Deferred Items)

These are intentionally NOT in v1 schema. See deferred items plan for sequencing:

- Per-user LLM credentials (env vars for v1)
- Per-user OAuth credentials table (env vars for v1)
- Application-level encryption (Supabase at-rest is sufficient)
- Partitioning of webhook_events (operational, not v1)
- Materialized views for analytics (only if profiling demands it)
- prompt_versions table for A/B testing (column on classifications/drafts for v1)
- denormalized user_id columns on issues/drafts/etc (only if 4-deep JOINs are slow)
- archived/cold storage for old webhook_events (retention policy applied later)

---

## Verification Checklist for Migrations

After Cursor generates migration SQL files, verify:

### Schema verification queries

Run these in Supabase SQL editor to dump actual schema:

```sql
-- Column inventory
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Constraint inventory
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conname;

-- Index inventory
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Compare each row against this spec. Mismatches indicate bugs.

### Specific things to verify

1. All 13 tables exist
2. Every foreign key has explicit ON DELETE behavior (RESTRICT, CASCADE, or SET NULL)
3. Every CHECK constraint matches the exact enum values in this doc
4. NUMERIC columns have correct precision (3,2 vs 4,3)
5. Soft-delete columns (`deleted_at`) only exist on tables that need them
6. JSONB columns with NOT NULL have explicit defaults
7. pgvector extension is enabled
8. The updated_at trigger is applied to the 11 tables that need it
9. Unique constraint on notification_targets uses COALESCE for NULL handling
10. pgvector IVFFlat index on issues.embedding exists with cosine ops

### Application-level verification

After migrations apply, run these test inserts to verify the constraints work:

```sql
-- Should fail: invalid enum value
INSERT INTO classifications (issue_type, severity, ...) VALUES ('not-a-real-type', ...);

-- Should fail: confidence out of range
INSERT INTO classifications (confidence, ...) VALUES (1.5, ...);

-- Should fail: self-duplicate
INSERT INTO issue_duplicates (source_issue_id, duplicate_of_issue_id, ...) VALUES (<same-uuid>, <same-uuid>, ...);

-- Should succeed
INSERT INTO users (github_id, github_username) VALUES (12345, 'testuser');
```

If any "should fail" insert succeeds, the constraint is missing or wrong.