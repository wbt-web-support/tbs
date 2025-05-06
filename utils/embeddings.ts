import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// Generate embeddings for a query
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 1536,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating query embedding:", error);
    throw error;
  }
}

interface ChatbotInstruction {
  content: string;
  content_type: string;
  url: string | null;
  updated_at: string;
  created_at: string;
  extraction_metadata: any;
  title?: string;
}

// Retrieve relevant instructions based on vector similarity
export async function getRelevantInstructions(
  supabase: SupabaseClient<any, "public", any>,
  query: string,
  limit: number = 10,
  similarityThreshold: number = 0.6
): Promise<ChatbotInstruction[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Perform vector similarity search
    const { data: instructions, error } = await supabase.rpc(
      'match_chatbot_instructions',
      {
        query_embedding: queryEmbedding,
        match_threshold: similarityThreshold,
        match_count: limit
      }
    );
    
    if (error) {
      console.error(
        "CRITICAL: Vector search RPC 'match_chatbot_instructions' failed. Proceeding with no retrieved instructions.", 
        error
      );
      return []; // Return empty on RPC failure, do not fall back to fetching all instructions here
    }
    
    return instructions || []; // instructions from RPC can be null if no matches, or an array
  } catch (error) {
    console.error("Error in getRelevantInstructions during embedding generation or RPC call:", error);
    // Catch any other error (e.g., from generateQueryEmbedding) and return empty
    return [];
  }
}

// SQL function to add to your database (to be run in the Supabase SQL editor):
/*
-- Function to find similar instructions based on embedding similarity
CREATE OR REPLACE FUNCTION match_chatbot_instructions(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type TEXT,
  url TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  extraction_metadata JSONB,
  title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.content,
    ci.content_type,
    ci.url,
    ci.updated_at,
    ci.created_at,
    ci.extraction_metadata,
    ci.title,
    1 - (ci.embedding <=> query_embedding) AS similarity
  FROM
    chatbot_instructions ci
  WHERE
    ci.is_active = true
    AND ci.embedding IS NOT NULL
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY
    ci.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
*/ 