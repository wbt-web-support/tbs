// Supabase Edge Function to generate embeddings for business_owner_instructions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1'

// Configure OpenAI
const openAiKey = Deno.env.get('OPENAI_API_KEY')
if (!openAiKey) {
  console.error('Missing OPENAI_API_KEY environment variable')
}
const openaiConfig = new Configuration({ apiKey: openAiKey })
const openai = new OpenAIApi(openaiConfig)

// Configure Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.createEmbedding({
      model: 'text-embedding-3-large',
      input: text,
    })
    
    return response.data.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}

// HTTP handler for the Edge Function
serve(async (req) => {
  try {
    // Parse request body
    const body = await req.json()
    const { record_id, content } = body

    // Validate input
    if (!record_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing record_id' }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content is empty or missing' }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log(`Generating embedding for record ${record_id}`)

    // Generate the embedding
    const embedding = await generateEmbedding(content)

    // Verify embedding dimension (should be 1536 for text-embedding-3-large)
    if (embedding.length !== 1536) {
      throw new Error(`Unexpected embedding dimension: ${embedding.length}, expected 1536`)
    }

    console.log(`Generated embedding with dimension ${embedding.length}`)

    // Update the database with the embedding
    const { error: updateError } = await supabase
      .from('business_owner_instructions')
      .update({ embeddings: embedding })
      .eq('id', record_id)

    if (updateError) {
      console.error('Error updating database:', updateError)
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    console.log(`Successfully updated embedding for record ${record_id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        record_id,
        embedding_dimension: embedding.length
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in edge function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
