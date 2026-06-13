-- Create drafts table
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

-- Create indexes
CREATE INDEX drafts_issue_id_idx ON drafts(issue_id);
CREATE INDEX drafts_pending_idx ON drafts(status, created_at) WHERE status = 'pending';
CREATE INDEX drafts_reviewed_by_idx ON drafts(reviewed_by_user_id) WHERE reviewed_by_user_id IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
