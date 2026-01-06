/**
 * OpenAI Embeddings Service
 * Uses OpenAI's text-embedding-3-large model for generating embeddings
 * Returns 768-dimensional vectors (matching database schema)
 * 
 * Token Limit: 8,191 tokens (~30,000+ characters)
 * Reference: https://platform.openai.com/docs/guides/embeddings
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

const OUTPUT_DIMENSIONALITY = 768; // Match database schema vector(768)
const MAX_CHARS_PER_CHUNK = 20000; // OpenAI supports ~8191 tokens (~20-24k chars, conservative estimate)
const OVERLAP_CHARS = 500; // Overlap between chunks for better context

/**
 * Calculate the Euclidean norm (magnitude) of a vector
 */
function calculateNorm(vector: number[]): number {
  let sum = 0;
  for (const val of vector) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length
 * Normalized embeddings provide better cosine similarity results
 */
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = calculateNorm(embedding);
  if (norm === 0) {
    console.warn('⚠️  Zero-norm embedding detected, returning as-is');
    return embedding;
  }
  return embedding.map(val => val / norm);
}

/**
 * Split text into chunks that fit within the token limit
 * @param text - The text to split
 * @returns Array of text chunks
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  const maxIterations = Math.ceil(text.length / (MAX_CHARS_PER_CHUNK - OVERLAP_CHARS)) + 10; // Safety limit
  let iterations = 0;

  while (start < text.length) {
    // Safety check to prevent infinite loops
    iterations++;
    if (iterations > maxIterations) {
      console.error(`⚠️  Chunking safety limit reached after ${iterations} iterations`);
      break;
    }

    let end = Math.min(start + MAX_CHARS_PER_CHUNK, text.length);
    
    // If this is not the last chunk, try to find a good breaking point
    if (end < text.length) {
      // Try to break at paragraph (double newline)
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + MAX_CHARS_PER_CHUNK * 0.7) {
        end = paragraphBreak + 2;
      } else {
        // Try to break at sentence
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + MAX_CHARS_PER_CHUNK * 0.7) {
          end = sentenceBreak + 2;
        } else {
          // Try to break at word
          const wordBreak = text.lastIndexOf(' ', end);
          if (wordBreak > start + MAX_CHARS_PER_CHUNK * 0.7) {
            end = wordBreak + 1;
          }
        }
      }
    }

    // Extract chunk
    const chunk = text.slice(start, end);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // If we've reached the end, stop
    if (end >= text.length) {
      break;
    }
    
    // Move start forward, with overlap for context
    // Make sure we always advance forward to avoid infinite loops
    const nextStart = end - OVERLAP_CHARS;
    if (nextStart <= start) {
      // If overlap would cause us to not advance, force advancement
      start = start + MAX_CHARS_PER_CHUNK;
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

/**
 * Average multiple embedding vectors into one
 * @param embeddings - Array of embedding vectors
 * @returns Averaged embedding vector
 */
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot average zero embeddings');
  }
  
  if (embeddings.length === 1) {
    return embeddings[0];
  }

  const dimensions = embeddings[0].length;
  const averaged = new Array(dimensions).fill(0);

  // Sum all embeddings
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      averaged[i] += embedding[i];
    }
  }

  // Divide by count to get average
  for (let i = 0; i < dimensions; i++) {
    averaged[i] /= embeddings.length;
  }

  return averaged;
}

/**
 * Generate a single embedding from the API (internal function)
 * @param text - The text to generate embedding for (must be under token limit)
 * @returns Promise<number[]> - Embedding vector
 */
async function generateSingleEmbedding(text: string): Promise<number[]> {
  if (!openai.apiKey) {
    throw new Error('OpenAI API key is not configured. Please set NEXT_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY environment variable.');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: OUTPUT_DIMENSIONALITY,
    });

    if (!response.data || response.data.length === 0) {
      console.error('❌ No embedding data returned from OpenAI');
      throw new Error('No embedding data returned from OpenAI API');
    }

    const embeddingValues = response.data[0].embedding;
    
    if (!embeddingValues || !Array.isArray(embeddingValues)) {
      console.error('❌ Invalid embedding format:', response.data[0]);
      throw new Error('Invalid embedding format from OpenAI API');
    }

    if (embeddingValues.length !== OUTPUT_DIMENSIONALITY) {
      console.warn(`Warning: Expected embedding size ${OUTPUT_DIMENSIONALITY}, got ${embeddingValues.length}`);
    }

    // OpenAI embeddings are already normalized, but we normalize again for consistency
    const normalized = normalizeEmbedding(embeddingValues);
    console.log(`✅ Embedding generated and normalized (norm: ${calculateNorm(normalized).toFixed(6)})`);
    return normalized;
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for text using OpenAI's text-embedding-3-large model
 * Handles long texts by chunking, generating embeddings for each chunk, and averaging them
 * 
 * @param text - The text to generate embeddings for (any length)
 * @returns Promise<number[]> - 768-dimensional embedding vector
 */
export async function generateGoogleEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const wordCount = text.split(/\s+/).length;
  console.log(`📝 Processing text: ${text.length} characters, ~${wordCount} words`);

  // Split text into chunks if necessary
  const chunks = chunkText(text);
  
  if (chunks.length > 1) {
    console.log(`📚 Text split into ${chunks.length} chunks for processing`);
  }

  // Generate embeddings for each chunk
  const embeddings: number[][] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`⚙️  Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
    const embedding = await generateSingleEmbedding(chunks[i]);
    embeddings.push(embedding);
    
    // Small delay between requests to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Average the embeddings if we have multiple chunks
  let finalEmbedding: number[];
  if (embeddings.length > 1) {
    console.log(`🔄 Averaging ${embeddings.length} chunk embeddings...`);
    finalEmbedding = averageEmbeddings(embeddings);
  } else {
    finalEmbedding = embeddings[0];
  }

  console.log(`✅ Generated embedding: ${finalEmbedding.length} dimensions from ${chunks.length} chunk(s)`);
  return finalEmbedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @returns Promise<number[][]> - Array of 768-dimensional embedding vectors
 */
export async function generateGoogleEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // OpenAI supports batch embeddings natively, but for consistency with chunking logic,
  // we process each text individually
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateGoogleEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

