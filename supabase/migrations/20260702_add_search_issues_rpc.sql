-- Layer 10 Block C: RPC function for semantic issue search.
-- Wraps pgvector similarity into a filterable, sortable query with score threshold.

CREATE OR REPLACE FUNCTION search_issues_by_similarity(
  query_embedding TEXT,
  repo_ids UUID[],
  match_limit INT,
  min_sim FLOAT
)
RETURNS TABLE (
  id UUID,
  github_issue_number INT,
  title TEXT,
  body TEXT,
  is_pull_request BOOLEAN,
  repo_id UUID,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.github_issue_number,
    i.title,
    i.body,
    i.is_pull_request,
    i.repo_id,
    i.created_at,
    (1 - (i.embedding <=> query_embedding::vector))::FLOAT AS similarity
  FROM issues i
  WHERE i.repo_id = ANY(repo_ids)
    AND i.embedding IS NOT NULL
    AND i.deleted_at IS NULL
    AND (1 - (i.embedding <=> query_embedding::vector)) >= min_sim
  ORDER BY i.embedding <=> query_embedding::vector ASC
  LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION search_issues_by_similarity IS
  'Semantic issue search via pgvector cosine similarity. Filters by allowed repo_ids, threshold, and limit. Returns results sorted by similarity DESC (closest first).';
