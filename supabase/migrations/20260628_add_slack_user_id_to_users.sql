-- Add slack_user_id to users table for Slack→GitHub identity linking.
-- Nullable because: (1) existing users have no Slack ID, (2) GitHub-only users may never link.
-- UNIQUE because one Slack user maps to one GitHub user.

ALTER TABLE users
  ADD COLUMN slack_user_id TEXT;

CREATE UNIQUE INDEX users_slack_user_id_unique_idx
  ON users(slack_user_id)
  WHERE slack_user_id IS NOT NULL;

COMMENT ON COLUMN users.slack_user_id IS
  'Slack workspace user ID (e.g., U01ABC123). NULL until user links via Slack DM flow.';
