import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedResponseWithContext } from '@/lib/optimized-contextual-llm';
import { responseQualityOptimizer } from '@/lib/response-quality-optimizer';
import { generateGroqAIResponse } from '@/lib/groq-ai-generator';
import { generateChatTitle, shouldGenerateTitle, validateTitle, getTitleGenerationOptions } from '@/lib/title-generator';

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  console.time('🔥 Total Chat API Request');
  
  try {
    console.time('📥 Request JSON Parse');
    const { messages, conversationId, relevantMessages, currentTitle } = await request.json();
    console.timeEnd('📥 Request JSON Parse');

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

    // Get response from the LLM with enhanced context (optimized)
    console.time('🤖 Groq LLM Response');
    const userQuery = messages[messages.length - 1]?.content || '';
    // For now, instructions and userData are not passed (can be extended)
    const responseContent = await generateGroqAIResponse({
      message: userQuery,
      mode: 'text',
    });
    console.timeEnd('🤖 Groq LLM Response');

    // Generate title for new conversations only (STRICT: only generic titles)
    let title: string | undefined;
    const titleToCheck = currentTitle || 'New Chat';
    if (shouldGenerateTitle(titleToCheck)) {
      try {
        console.time('🏷️ Title Generation');
        const titleResult = await generateChatTitle(
          getTitleGenerationOptions(userQuery, responseContent, 'text')
        );
        if (validateTitle(titleResult.title)) {
          title = titleResult.title;
        }
        console.timeEnd('🏷️ Title Generation');
      } catch (error) {
        console.warn('Title generation failed:', error);
      }
    }

    const totalTime = performance.now() - startTime;
    console.timeEnd('🔥 Total Chat API Request');
    console.log(`⚡ Chat API total time: ${totalTime.toFixed(2)}ms`);
    return NextResponse.json(
      {
        content: responseContent,
        title,
        augmentedMessages: [],
        performance: {
          totalTime: totalTime.toFixed(2),
          processingTime: undefined,
          cacheHits: 0
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
} 