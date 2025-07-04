import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";
import { groqClient } from "@/lib/groq-client";
import { getRelevantInstructionsEnhanced } from "@/utils/enhanced-embeddings";
import { getCachedResponse, setCachedResponse } from "@/utils/cache";
import { fewShotManager } from "@/lib/few-shot-prompting";
import { responseQualityOptimizer } from "@/lib/response-quality-optimizer";

interface EnhancedChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  context?: any;
}

interface EnhancedChatRequest {
  messages: EnhancedChatMessage[];
  conversationId: string;
  options?: {
    useChunking?: boolean;
    enableReranking?: boolean;
    useFewShot?: boolean;
    vadEnabled?: boolean;
    adaptiveThreshold?: boolean;
    businessContext?: string;
    urgency?: 'low' | 'medium' | 'high';
    maxTokens?: number;
    temperature?: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  console.time('🚀 Enhanced Chat API Request');
  
  try {
    console.time('📥 Request Parsing');
    const {
      messages,
      conversationId,
      options = {}
    }: EnhancedChatRequest = await request.json();
    console.timeEnd('📥 Request Parsing');

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Extract configuration with defaults
    const {
      useChunking = true,
      enableReranking = true,
      useFewShot = true,
      adaptiveThreshold = true,
      businessContext,
      urgency = 'medium',
      maxTokens = 1000,
      temperature = 0.7
    } = options;

    console.log('🔧 [ENHANCED CHAT] Configuration:', {
      useChunking,
      enableReranking,
      useFewShot,
      adaptiveThreshold,
      urgency
    });

    // Get the last user message for context
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    const userQuery = lastUserMessage.content;

    // Initialize Supabase client
    const supabase = await createClient();

    // Step 1: Enhanced RAG retrieval with chunking and reranking
    console.time('🔍 Enhanced RAG Retrieval');
    let relevantInstructions: any[] = [];
    let ragPerformance = { retrievalTime: 0, chunks: 0 };

    try {
      const ragStartTime = performance.now();
      relevantInstructions = await getRelevantInstructionsEnhanced(
        supabase,
        userQuery,
        {
          limit: 8,
          useChunks: useChunking,
          enableReranking: enableReranking,
          adaptiveThreshold: adaptiveThreshold,
          maxSimilarityThreshold: 0.85,
          minSimilarityThreshold: 0.4
        }
      );
      
      ragPerformance.retrievalTime = performance.now() - ragStartTime;
      ragPerformance.chunks = relevantInstructions.filter(inst => inst.chunk_info?.is_chunk).length;
      
      console.log(`✅ [ENHANCED RAG] Retrieved ${relevantInstructions.length} instructions (${ragPerformance.chunks} chunks) in ${ragPerformance.retrievalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('❌ [ENHANCED RAG] Retrieval failed:', error);
      // Continue with empty instructions rather than failing
    }
    console.timeEnd('🔍 Enhanced RAG Retrieval');

    // Step 2: Few-shot prompting for consistency
    console.time('🎯 Few-shot Prompt Generation');
    let enhancedPrompt = '';
    let fewShotMetadata = { templateUsed: 'none', examplesCount: 0, reasoning: '' };
    
    if (useFewShot) {
      try {
        const promptResult = await fewShotManager.generatePrompt({
          userQuery,
          conversationHistory: messages.slice(-6), // Last 6 messages for context
          businessContext,
          urgency,
          queryType: detectQueryType(userQuery)
        });
        
        enhancedPrompt = promptResult.systemPrompt;
        fewShotMetadata = {
          templateUsed: promptResult.templateUsed,
          examplesCount: promptResult.examples.length,
          reasoning: promptResult.reasoning
        };
        
        console.log(`✅ [FEW-SHOT] Generated prompt with ${promptResult.examples.length} examples using ${promptResult.templateUsed}`);
      } catch (error) {
        console.error('❌ [FEW-SHOT] Prompt generation failed:', error);
        enhancedPrompt = getDefaultSystemPrompt();
      }
    } else {
      enhancedPrompt = getDefaultSystemPrompt();
    }
    
    // 🎯 QUALITY OPTIMIZATION: Add quality enhancement to the enhanced prompt
    const qualityEnhancement = responseQualityOptimizer.getPromptEnhancement('enhanced-chat', userQuery, 'text');
    const finalEnhancedPrompt = enhancedPrompt + qualityEnhancement;
    console.timeEnd('🎯 Few-shot Prompt Generation');

    // Step 3: Build enhanced context
    console.time('🧠 Context Building');
    const contextSections: string[] = [];

    // Add relevant instructions with chunk information
    if (relevantInstructions.length > 0) {
      contextSections.push('**Relevant Knowledge Base:**');
      relevantInstructions.forEach((instruction, index) => {
        const chunkInfo = instruction.chunk_info?.is_chunk 
          ? ` (Chunk ${instruction.chunk_info.chunk_index}/${instruction.chunk_info.total_chunks})`
          : '';
        const similarity = instruction.similarity ? ` [${(instruction.similarity * 100).toFixed(0)}% match]` : '';
        
        contextSections.push(
          `${index + 1}. **${instruction.title}**${chunkInfo}${similarity}\n${instruction.content}`
        );
      });
    }

    // Add conversation context
    if (messages.length > 1) {
      const recentMessages = messages.slice(-4, -1); // Last few messages excluding current
      if (recentMessages.length > 0) {
        contextSections.push('\n**Recent Conversation:**');
        recentMessages.forEach(msg => {
          contextSections.push(`${msg.role}: ${msg.content}`);
        });
      }
    }

    const contextContent = contextSections.join('\n\n');
    console.timeEnd('🧠 Context Building');

    // Step 4: Check cache
    console.time('💾 Cache Check');
    const cacheKey = `enhanced_chat_${conversationId}_${Buffer.from(userQuery + contextContent).toString('base64').slice(0, 32)}`;
    let cachedResponse = null;
    
    try {
      cachedResponse = await getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log('✅ [CACHE] Found cached response');
        const totalTime = performance.now() - startTime;
        console.timeEnd('🚀 Enhanced Chat API Request');
        
        return NextResponse.json({
          content: cachedResponse.content,
          cached: true,
          metadata: {
            ...cachedResponse.metadata,
            performance: {
              totalTime: totalTime.toFixed(2),
              ragTime: ragPerformance.retrievalTime.toFixed(2),
              cached: true
            }
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ [CACHE] Cache check failed:', error);
    }
    console.timeEnd('💾 Cache Check');

    // Step 5: Generate LLM response with quality optimization
    console.time('🤖 LLM Generation');
    const llmMessages = [
      {
        role: 'system' as const,
        content: finalEnhancedPrompt + (contextContent ? `\n\n**Context:**\n${contextContent}` : '')
      },
      {
        role: 'user' as const,
        content: userQuery
      }
    ];

    // Get quality-optimized generation configuration
    const qualityGenerationConfig = responseQualityOptimizer.getGenerationConfig('enhanced-chat', 'text');

    try {
      const llmResponse = await groqClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: llmMessages,
        temperature: qualityGenerationConfig.temperature,
        max_tokens: qualityGenerationConfig.maxOutputTokens,
        top_p: qualityGenerationConfig.topP,
        stream: false
      });

      const content = llmResponse.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
      const usage = llmResponse.usage;
      
      console.log(`✅ [LLM] Generated response (${usage?.total_tokens || 0} tokens)`);
      console.timeEnd('🤖 LLM Generation');

      // Step 6: Cache the response
      console.time('💾 Cache Storage');
      const responseMetadata = {
        ragResults: relevantInstructions.length,
        chunksUsed: ragPerformance.chunks,
        fewShot: fewShotMetadata,
        usage: usage,
        conversationId,
        query: userQuery.substring(0, 100)
      };

      try {
        await setCachedResponse(cacheKey, {
          content,
          metadata: responseMetadata
        }, 300); // 5 minute cache
      } catch (error) {
        console.warn('⚠️ [CACHE] Failed to cache response:', error);
      }
      console.timeEnd('💾 Cache Storage');

      // Calculate final metrics
      const totalTime = performance.now() - startTime;
      console.timeEnd('🚀 Enhanced Chat API Request');
      
      console.log(`⚡ Enhanced Chat API completed in ${totalTime.toFixed(2)}ms`);

      return NextResponse.json({
        content,
        cached: false,
        metadata: {
          ...responseMetadata,
          performance: {
            totalTime: totalTime.toFixed(2),
            ragTime: ragPerformance.retrievalTime.toFixed(2),
            cached: false
          },
          enhancements: {
            chunking: useChunking,
            reranking: enableReranking,
            fewShot: useFewShot,
            adaptiveThreshold: adaptiveThreshold
          }
        }
      });

    } catch (error) {
      console.error('❌ [LLM] Generation failed:', error);
      console.timeEnd('🤖 LLM Generation');
      
      return NextResponse.json(
        {
          error: 'Failed to generate LLM response',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [ENHANCED CHAT] API Error:', error);
    console.timeEnd('🚀 Enhanced Chat API Request');
    
    return NextResponse.json(
      {
        error: 'Enhanced chat API failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Detect query type for few-shot prompting
 */
function detectQueryType(query: string): 'question' | 'request' | 'complaint' | 'compliment' | 'other' {
  const lowerQuery = query.toLowerCase();
  
  if (/\?/.test(query) || /^(what|how|why|when|where|who|which|can|could|should|would|will|is|are|do|does)\b/.test(lowerQuery)) {
    return 'question';
  } else if (/^(please|can you|could you|help|assist|need|want|would like)/.test(lowerQuery)) {
    return 'request';
  } else if (/(problem|issue|error|broken|not working|frustrated|angry)/.test(lowerQuery)) {
    return 'complaint';
  } else if (/(great|amazing|excellent|love|thank|appreciate)/.test(lowerQuery)) {
    return 'compliment';
  }
  
  return 'other';
}

/**
 * Default system prompt fallback
 */
function getDefaultSystemPrompt(): string {
  return `You are an expert business advisor with deep knowledge across all business domains. 

### CRITICAL FORMATTING REQUIREMENTS:

**0. Content Policy:**
- Under no circumstances should you use any emojis in your response.

**1. Structure & Organization:**
- Start with a clear, compelling opening statement
- Use proper markdown headings (## for main sections, ### for subsections)
- Break content into digestible sections with clear headings
- Use numbered lists for sequential steps (1. 2. 3.)
- Use bullet points for related items or benefits (- or *)
- Add white space between sections for readability

**2. Content Presentation:**
- **Bold** key concepts, important points, and section headers
- Use *italic* for emphasis on specific terms
- Create clear, scannable content with proper paragraph breaks
- Keep paragraphs to 2-3 sentences maximum
- Use transition words between sections

**3. Actionable Elements:**
- Always include numbered action steps when providing guidance
- Use clear call-to-action statements
- Provide specific, measurable recommendations
- Include timelines or deadlines when relevant

**4. Visual Enhancement:**
- Create visual hierarchy with proper markdown formatting
- Use code blocks for specific instructions or examples
- Include relevant examples or case studies when helpful

### RESPONSE STRUCTURE TEMPLATE:

For most responses, follow this proven structure:

## Quick Summary
*Brief 1-2 sentence overview of what you're about to explain*

## Key Points
*Main concepts organized as bullet points*

## Step-by-Step Implementation
*Numbered action steps with clear instructions*

1. **First Action:** Specific description with context
2. **Second Action:** Clear next step with details
3. **Third Action:** Continue the logical sequence

## Additional Considerations
*Important factors, tips, or warnings*

## Next Steps
*Clear call-to-action or follow-up recommendations*

### FORMATTING RULES:

- **Never** write wall-of-text responses without breaks
- **Never** use "First, Second, Third, Finally" in running sentences
- **Always** use proper markdown headings and formatting
- **Always** break up content into scannable sections
- **Always** provide numbered steps for processes (use 1. 2. 3. format)
- **Always** use bullet points for lists of related items (use - or * format)
- **Always** bold important concepts and key terms
- **Always** end with clear next steps or call-to-action
- **Always** add line breaks between different points
- **Never** combine multiple sequential points in one paragraph

### AVOID THIS BAD FORMAT:
"Let's get this done. First, do this task and make sure it's complete. Second, move on to the next item and ensure quality. Third, review everything carefully. Finally, implement the changes."

### USE THIS GOOD FORMAT:
"Let's get this done effectively:

1. **Do This Task**
   Make sure it's complete and meets quality standards

2. **Move to Next Item** 
   Focus on ensuring quality throughout the process

3. **Review Everything**
   Carefully check all work before proceeding

4. **Implement Changes**
   Execute the final implementation with confidence"

Provide practical, actionable advice that is:

1. **Specific and Actionable** - Give concrete steps, not just general advice
2. **Context-Aware** - Consider the user's specific situation and constraints  
3. **Encouraging but Realistic** - Be supportive while setting proper expectations
4. **Well-Structured** - Use clear formatting with numbered steps or bullet points
5. **Follow-up Focused** - Always ask clarifying questions or suggest next steps

Keep responses comprehensive but scannable, and always prioritise the user's business success with properly formatted, easy-to-read responses.`;
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      chunking: true,
      reranking: true,
      fewShot: true,
      vad: true,
      adaptiveThreshold: true
    }
  });
} 