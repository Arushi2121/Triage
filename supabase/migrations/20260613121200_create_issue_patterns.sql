-- Create issue_patterns table (many-to-many join table)
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

-- Create indexes
CREATE INDEX issue_patterns_issue_idx ON issue_patterns(issue_id);

-- Note: No updated_at trigger for issue_patterns (no updated_at column)
