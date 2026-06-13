-- Create issues table
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE RESTRICT,
  github_issue_id BIGINT UNIQUE NOT NULL,
  github_issue_number INTEGER NOT NULL,
  github_node_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,
  author_github_id BIGINT NOT NULL,
  author_github_login TEXT NOT NULL,
  author_association TEXT NOT NULL,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments_count INTEGER NOT NULL DEFAULT 0,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pull_request BOOLEAN NOT NULL DEFAULT false,
  embedding vector(1536),
  embedding_model TEXT,
  embedded_at TIMESTAMPTZ,
  github_created_at TIMESTAMPTZ NOT NULL,
  github_updated_at TIMESTAMPTZ NOT NULL,
  github_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT issues_state_check CHECK (state IN ('open', 'closed'))
);

-- Create indexes
CREATE INDEX issues_repo_id_idx ON issues(repo_id);
CREATE INDEX issues_repo_state_idx ON issues(repo_id, state) WHERE deleted_at IS NULL;
CREATE INDEX issues_github_updated_at_idx ON issues(github_updated_at DESC);
CREATE INDEX issues_embedding_idx ON issues USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
