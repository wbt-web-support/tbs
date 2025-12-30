import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('google_calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (startDate) {
      query = query.gte('start_time', startDate);
    }

    if (endDate) {
      query = query.lte('end_time', endDate);
    }

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: events || [] });
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

