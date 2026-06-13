-- Create patterns table
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

-- Create indexes
CREATE INDEX patterns_repo_status_severity_idx ON patterns(repo_id, status, severity);
CREATE INDEX patterns_repo_last_detected_idx ON patterns(repo_id, last_detected_at DESC);
CREATE INDEX patterns_category_idx ON patterns(category);
CREATE INDEX patterns_active_idx ON patterns(repo_id) WHERE status = 'active';

-- Create trigger for updated_at
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
