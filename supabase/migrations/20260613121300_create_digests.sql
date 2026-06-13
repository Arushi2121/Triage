-- Create digests table
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

-- Create indexes
CREATE INDEX digests_user_generated_idx ON digests(user_id, generated_at DESC);
CREATE INDEX digests_pending_idx ON digests(status, generated_at) WHERE status IN ('queued', 'failed');
CREATE INDEX digests_period_idx ON digests(period_start, period_end);

-- Create trigger for updated_at
CREATE TRIGGER update_digests_updated_at BEFORE UPDATE ON digests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
