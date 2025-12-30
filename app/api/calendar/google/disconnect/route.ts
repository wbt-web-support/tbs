import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete calendar events
    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('user_id', user.id);

    // Delete calendar tokens
    const { error: deleteError } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Google Calendar disconnected successfully' });
  } catch (error: any) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

