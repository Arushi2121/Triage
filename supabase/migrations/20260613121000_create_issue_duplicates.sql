-- Create issue_duplicates table
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

-- Create indexes
CREATE INDEX issue_duplicates_source_idx ON issue_duplicates(source_issue_id);
CREATE INDEX issue_duplicates_target_idx ON issue_duplicates(duplicate_of_issue_id);
CREATE INDEX issue_duplicates_status_idx ON issue_duplicates(status, detected_at DESC);
CREATE INDEX issue_duplicates_confidence_idx ON issue_duplicates(confidence DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_issue_duplicates_updated_at BEFORE UPDATE ON issue_duplicates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
