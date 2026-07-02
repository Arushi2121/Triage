-- Layer 10 Block A: Add API key column for MCP server authentication.
-- Users generate a unique API key that MCP clients use in Authorization header.

ALTER TABLE users
  ADD COLUMN api_key TEXT;

-- Partial unique index: multiple NULLs allowed, non-NULLs must be unique
CREATE UNIQUE INDEX users_api_key_unique_idx
  ON users(api_key)
  WHERE api_key IS NOT NULL;

COMMENT ON COLUMN users.api_key IS
  'MCP API key for authenticating MCP client requests. Format: trg_<random>. NULL until user generates one.';
