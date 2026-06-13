-- Create actions table
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

-- Create indexes
CREATE INDEX actions_repo_created_idx ON actions(repo_id, created_at DESC);
CREATE INDEX actions_issue_created_idx ON actions(issue_id, created_at DESC);
CREATE INDEX actions_draft_id_idx ON actions(draft_id) WHERE draft_id IS NOT NULL;
CREATE INDEX actions_retry_idx ON actions(status, retry_count) WHERE status IN ('failed', 'retrying');

-- Create trigger for updated_at
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
