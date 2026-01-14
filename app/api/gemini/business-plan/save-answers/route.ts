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
      return NextResponse.json({ error: 'Invalid answers data' }, { status: 400 });
    }

    // Get team ID
    const { data: businessInfo } = await supabase
      .from('business_info')
      .select('team_id')
      .eq('user_id', user.id)
      .single();

    const teamId = businessInfo?.team_id;

    // Store answers in a user_answers table or similar
    // For now, we'll just return success as the answers are stored in localStorage
    // and passed to the generation endpoint
    // In the future, you might want to persist these in the database

    return NextResponse.json({
      success: true,
      message: 'Answers saved successfully'
    });

  } catch (error) {
    console.error('Error saving answers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save answers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
