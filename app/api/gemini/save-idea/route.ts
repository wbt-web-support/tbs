import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

async function getUserId(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

// Function to generate summary using Gemini
async function generateIdeaSummary(messages: any[], title: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    
    // Prepare the conversation for summarization
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    
    const prompt = `Please analyze this chat conversation and create a concise summary that captures the key ideas, insights, and actionable points. The conversation is titled "${title}".

Conversation:
${conversationText}

Please provide a summary that:
1. Captures the main topic and key insights
2. Highlights any actionable ideas or next steps
3. Is concise but comprehensive (2-3 sentences)
4. Focuses on business value and innovation potential

Summary:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('❌ [Gemini] Error generating summary:', error);
    // Fallback summary
    return `Summary of conversation: ${title}. Contains ${messages.length} messages with insights and ideas.`;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { chatInstanceId, title, tags = [] } = await req.json();
    
    if (!chatInstanceId || !title) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: chatInstanceId and title' }),
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch the chat instance and messages
    const { data: chatInstance, error: chatError } = await supabase
      .from('chat_history')
      .select('*')
      .eq('id', chatInstanceId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chatInstance) {
      console.error('❌ [Save Idea] Error fetching chat instance:', chatError);
      return new NextResponse(
        JSON.stringify({ error: 'Chat instance not found' }),
        { status: 404 }
      );
    }

    // Generate summary using Gemini
    const summary = await generateIdeaSummary(chatInstance.messages, title);

    // Save the idea
    const { data: savedIdea, error: saveError } = await supabase
      .from('chat_ideas')
      .insert({
        user_id: userId,
        title: title,
        summary: summary,
        original_chat_id: chatInstanceId,
        original_messages: chatInstance.messages,
        tags: tags
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [Save Idea] Error saving idea:', saveError);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to save idea' }),
        { status: 500 }
      );
    }

    console.log('✅ [Save Idea] Idea saved successfully:', savedIdea.id);
    
    return new NextResponse(
      JSON.stringify({
        success: true,
        idea: savedIdea
      })
    );

  } catch (error) {
    console.error('❌ [Save Idea] Unexpected error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Fetch user's ideas
    const { data: ideas, error } = await supabase
      .from('chat_ideas')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Get Ideas] Error fetching ideas:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch ideas' }),
        { status: 500 }
      );
    }

    return new NextResponse(
      JSON.stringify({
        success: true,
        ideas: ideas || []
      })
    );

  } catch (error) {
    console.error('❌ [Get Ideas] Unexpected error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { ideaId } = await req.json();
    
    if (!ideaId) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing ideaId' }),
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('chat_ideas')
      .update({ is_active: false })
      .eq('id', ideaId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Delete Idea] Error deleting idea:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to delete idea' }),
        { status: 500 }
      );
    }

    return new NextResponse(
      JSON.stringify({
        success: true,
        message: 'Idea deleted successfully'
      })
    );

  } catch (error) {
    console.error('❌ [Delete Idea] Unexpected error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
} 

export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { ideaId, title, tags, summary } = await req.json();
    if (!ideaId || !title) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: ideaId and title' }),
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const updatePayload: any = { title };
    if (tags) updatePayload.tags = tags;
    if (summary) updatePayload.summary = summary;
    const { data: updated, error } = await supabase
      .from('chat_ideas')
      .update(updatePayload)
      .eq('id', ideaId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update idea' }),
        { status: 500 }
      );
    }
    return new NextResponse(
      JSON.stringify({ success: true, idea: updated })
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
} 