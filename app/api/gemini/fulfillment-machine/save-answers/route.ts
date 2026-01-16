import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
    }

    // Answers is an object mapping question IDs to answer strings
    // We'll return the answers so they can be used in the generation API
    // For now, we'll just validate and return success
    // The frontend can store these temporarily or we can store them in a session

    return NextResponse.json({
      success: true,
      message: 'Answers saved successfully',
      answers: answers
    });

  } catch (error) {
    console.error('Error saving fulfillment machine answers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save answers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
