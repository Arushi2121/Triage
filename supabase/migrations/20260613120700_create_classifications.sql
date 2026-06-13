-- Create classifications table
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

-- Create indexes
CREATE INDEX classifications_issue_id_idx ON classifications(issue_id);
CREATE INDEX classifications_type_severity_idx ON classifications(issue_type, severity);
CREATE INDEX classifications_confidence_idx ON classifications(confidence);
CREATE INDEX classifications_classified_at_idx ON classifications(classified_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_classifications_updated_at BEFORE UPDATE ON classifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
