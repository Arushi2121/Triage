-- Function to find similar issues to a given embedding within a repo.
-- Uses cosine distance (<=>) which matches the IVFFlat index on issues.embedding.
-- Returns issues ordered by similarity (most similar first).

CREATE OR REPLACE FUNCTION find_similar_issues(
  query_embedding vector(1536),
  target_repo_id uuid,
  similarity_threshold float,
  match_limit int,
  exclude_issue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  github_issue_id bigint,
  github_issue_number integer,
  title text,
  state text,
  similarity float,
  github_created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    i.id,
    i.github_issue_id,
    i.github_issue_number,
    i.title,
    i.state,
    1 - (i.embedding <=> query_embedding) AS similarity,
    i.github_created_at
  FROM issues i
  WHERE i.repo_id = target_repo_id
    AND i.deleted_at IS NULL
    AND i.embedding IS NOT NULL
    AND (exclude_issue_id IS NULL OR i.id != exclude_issue_id)
    AND 1 - (i.embedding <=> query_embedding) > similarity_threshold
  ORDER BY i.embedding <=> query_embedding ASC
  LIMIT match_limit;
$$;
