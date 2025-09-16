import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGoogleAnalyticsData } from '@/lib/external-api-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const propertyId = searchParams.get('propertyId');
    
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get stored Google Analytics data
    const { data, error } = await getGoogleAnalyticsData(
      user.id,
      propertyId || undefined,
      startDate || undefined,
      endDate || undefined
    );

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch stored analytics data: ${error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      count: data.length,
      dateRange: {
        startDate: startDate || 'not specified',
        endDate: endDate || 'not specified'
      }
    });

  } catch (error) {
    console.error('Stored analytics data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stored analytics data' },
      { status: 500 }
    );
  }
}
