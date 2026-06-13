-- Create notification_targets table
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

-- Create indexes
CREATE UNIQUE INDEX notification_targets_user_repo_platform_unique 
  ON notification_targets(user_id, COALESCE(repo_id, '00000000-0000-0000-0000-000000000000'::UUID), platform) 
  WHERE deleted_at IS NULL;

CREATE INDEX notification_targets_user_repo_idx ON notification_targets(user_id, repo_id);
CREATE INDEX notification_targets_platform_idx ON notification_targets(platform);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_targets_updated_at BEFORE UPDATE ON notification_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
