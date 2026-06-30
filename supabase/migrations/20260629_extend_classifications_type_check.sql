-- Layer 8 Block E fix: extend classifications.issue_type to allow PR types
-- The 'issues' table holds both issues and PRs (is_pull_request discriminator).
-- The 'classifications' table now needs to accept both type vocabularies.

ALTER TABLE classifications
  DROP CONSTRAINT classifications_type_check;

ALTER TABLE classifications
  ADD CONSTRAINT classifications_type_check CHECK (
    issue_type IN (
      'bug', 'feature', 'question', 'duplicate', 'spam', 'documentation', 'discussion',
      'bug-fix', 'feature-addition', 'docs-only', 'refactor',
      'dependency-bump', 'breaking-change', 'chore', 'wip'
    )
  );

COMMENT ON COLUMN classifications.issue_type IS
  'Classification category. Issues use: bug, feature, question, duplicate, spam, documentation, discussion. PRs use: bug-fix, feature-addition, docs-only, refactor, dependency-bump, breaking-change, chore, wip.';
