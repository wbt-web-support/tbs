/**
 * Google Embeddings Service
 * Uses Google's text-embedding-004 model for generating embeddings
 * Returns 768-dimensional vectors
 */

const GOOGLE_EMBEDDING_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Note: If text-embedding-004 is not available, we can use text-embedding-3 or text-embedding-2
// The dimensions may vary (text-embedding-004: 768, text-embedding-3: 768, text-embedding-2: 768)

/**
 * Generate embeddings for text using Google's text-embedding-004 model
 * @param text - The text to generate embeddings for
 * @returns Promise<number[]> - 768-dimensional embedding vector
 */
export async function generateGoogleEmbedding(text: string): Promise<number[]> {
  if (!API_KEY) {
    throw new Error('Google API key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY or GEMINI_API_KEY environment variable.');
  }

  try {
    const response = await fetch(`${GOOGLE_EMBEDDING_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [
            {
              text: text,
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google Embeddings API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    
    if (!data.embedding || !data.embedding.values) {
      throw new Error('Invalid response format from Google Embeddings API');
    }

    const embedding = data.embedding.values;
    
    if (embedding.length !== 768) {
      console.warn(`Warning: Expected embedding size 768, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error('Error generating Google embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @returns Promise<number[][]> - Array of 768-dimensional embedding vectors
 */
export async function generateGoogleEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // Google's API supports batch requests, but for simplicity, we'll process sequentially
  // In production, you might want to implement proper batching
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateGoogleEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

