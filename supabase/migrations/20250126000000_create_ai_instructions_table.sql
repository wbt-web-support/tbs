-- Enable the pgvector extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the ai_instructions table
CREATE TABLE public.ai_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  instruction_type TEXT NOT NULL CHECK (instruction_type IN ('loom', 'text', 'pdf', 'sheet', 'url', 'document')),
  role_access TEXT NOT NULL CHECK (role_access IN ('admin', 'user', 'all')) DEFAULT 'all',
  category TEXT NOT NULL CHECK (category IN ('company_info', 'product_info', 'service_info', 'other')) DEFAULT 'other',
  url TEXT, -- For URL-based instructions
  document_url TEXT, -- Supabase storage URL for uploaded documents
  document_name TEXT, -- Original filename
  extraction_metadata JSONB, -- Store extraction details (similar to chatbot_instructions)
  vector_embedding vector(768), -- Google's text-embedding-004 uses 768 dimensions
  embedding_updated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_ai_instructions_role_access ON ai_instructions(role_access);
CREATE INDEX idx_ai_instructions_category ON ai_instructions(category);
CREATE INDEX idx_ai_instructions_type ON ai_instructions(instruction_type);
CREATE INDEX idx_ai_instructions_is_active ON ai_instructions(is_active);
CREATE INDEX idx_ai_instructions_created_by ON ai_instructions(created_by);

-- Create vector similarity search index
CREATE INDEX idx_ai_instructions_embedding ON ai_instructions 
USING ivfflat (vector_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create a trigger to update the updated_at timestamp automatically
CREATE TRIGGER update_ai_instructions_updated_at 
BEFORE UPDATE ON ai_instructions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();



-- Create a function for vector similarity search
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
  extraction_metadata JSONB,
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
    ai.extraction_metadata,
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

-- Helper function to update embedding (optional, for programmatic updates)
CREATE OR REPLACE FUNCTION update_ai_instruction_embedding(
  instruction_id uuid,
  embedding_vector vector(768),
  updated_at timestamptz DEFAULT now()
)
RETURNS void AS $$
BEGIN
  UPDATE ai_instructions
  SET 
    vector_embedding = embedding_vector,
    embedding_updated_at = updated_at
  WHERE id = instruction_id;
END;
$$ LANGUAGE plpgsql;

