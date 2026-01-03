-- Update match_ai_instructions function to return additional important columns
-- This allows the LLM to have access to document URLs, names, and metadata

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS match_ai_instructions(vector, double precision, integer, text);

-- Recreate the function with additional return columns
CREATE OR REPLACE FUNCTION match_ai_instructions(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  user_role_access TEXT DEFAULT 'all'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  instruction_type TEXT,
  role_access TEXT,
  category TEXT,
  url TEXT,
  document_url TEXT,
  document_name TEXT,
  priority INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id,
    ai.title,
    ai.content,
    ai.instruction_type,
    ai.role_access,
    ai.category,
    ai.url,
    ai.document_url,
    ai.document_name,
    ai.priority,
    1 - (ai.vector_embedding <=> query_embedding) AS similarity
  FROM
    ai_instructions ai
  WHERE
    ai.is_active = true
    AND ai.vector_embedding IS NOT NULL
    AND (
      ai.role_access = 'all' OR
      (ai.role_access = 'admin' AND user_role_access IN ('admin', 'super_admin')) OR
      (ai.role_access = 'user' AND user_role_access = 'user')
    )
    AND 1 - (ai.vector_embedding <=> query_embedding) > match_threshold
  ORDER BY
    ai.vector_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

