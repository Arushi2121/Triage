-- Create installations table
CREATE TABLE installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  github_installation_id BIGINT UNIQUE NOT NULL,
  github_account_login TEXT NOT NULL,
  github_account_id BIGINT NOT NULL,
  github_account_type TEXT NOT NULL,
  github_target_type TEXT NOT NULL,
  suspended_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT installations_account_type_check CHECK (github_account_type IN ('User', 'Organization')),
  CONSTRAINT installations_target_type_check CHECK (github_target_type IN ('all', 'selected'))
);

-- Create indexes
CREATE INDEX installations_user_id_idx ON installations(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_installations_updated_at BEFORE UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
