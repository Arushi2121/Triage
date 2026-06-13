-- Create webhook_events table
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

-- Create indexes
CREATE INDEX webhook_events_installation_idx ON webhook_events(installation_id);
CREATE INDEX webhook_events_repo_received_idx ON webhook_events(repo_id, received_at DESC);
CREATE INDEX webhook_events_event_type_idx ON webhook_events(event_type, event_action);
CREATE INDEX webhook_events_unfinished_idx ON webhook_events(processing_status) WHERE processing_status != 'completed';

-- Note: No updated_at trigger for webhook_events (append-only table)
