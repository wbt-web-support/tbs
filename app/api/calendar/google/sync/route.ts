import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncCalendarEventsToDatabase } from '@/lib/google-calendar';

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

    // Check if user has connected Google Calendar
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 400 }
      );
    }

    // Sync events
    const result = await syncCalendarEventsToDatabase(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to sync events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      eventCount: result.eventCount,
      message: `Successfully synced ${result.eventCount} events`
    });
  } catch (error: any) {
    console.error('Error syncing calendar:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

