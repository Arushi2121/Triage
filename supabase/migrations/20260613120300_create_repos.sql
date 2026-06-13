-- Create repos table
CREATE TABLE repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE RESTRICT,
  github_repo_id BIGINT UNIQUE NOT NULL,
  github_full_name TEXT NOT NULL,
  github_default_branch TEXT NOT NULL DEFAULT 'main',
  github_private BOOLEAN NOT NULL DEFAULT false,
  star_count INTEGER NOT NULL DEFAULT 0,
  issue_count_open INTEGER NOT NULL DEFAULT 0,
  language_primary TEXT,
  description TEXT,
  triage_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX repos_installation_id_idx ON repos(installation_id);
CREATE INDEX repos_full_name_idx ON repos(github_full_name);

-- Create trigger for updated_at
CREATE TRIGGER update_repos_updated_at BEFORE UPDATE ON repos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
