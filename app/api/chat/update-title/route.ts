import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instanceId, newTitle } = await request.json();

    if (!instanceId || !newTitle) {
      return NextResponse.json(
        { error: 'Instance ID and new title are required' },
        { status: 400 }
      );
    }

    // Validate title
    if (typeof newTitle !== 'string' || newTitle.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title must be a non-empty string' },
        { status: 400 }
      );
    }

    if (newTitle.trim().length > 100) {
      return NextResponse.json(
        { error: 'Title must be 100 characters or less' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Update the chat title
    const { data, error } = await supabase
      .from('chat_history')
      .update({ title: newTitle.trim() })
      .eq('id', instanceId)
      .eq('user_id', userId)
      .select('id, title')
      .single();

    if (error) {
      console.error('Error updating chat title:', error);
      return NextResponse.json(
        { error: 'Failed to update chat title' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Chat not found or not accessible' },
        { status: 404 }
      );
    }

    console.log(`✅ [MANUAL-TITLE] User ${userId} updated chat ${instanceId} title to: "${newTitle.trim()}"`);

    return NextResponse.json({
      success: true,
      instanceId: data.id,
      newTitle: data.title,
      message: 'Chat title updated successfully'
    });

  } catch (error) {
    console.error('Error in manual title update:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}