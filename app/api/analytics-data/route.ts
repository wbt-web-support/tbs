import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '30daysAgo';
    const endDate = searchParams.get('endDate') || 'today';
    
    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's Google Analytics tokens
    const { data: tokenData, error } = await supabase
      .from('google_analytics_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error || !tokenData) {
      return NextResponse.json(
        { error: 'No Google Analytics connection found' },
        { status: 404 }
      );
    }

    const { access_token, property_id } = tokenData;
    
    if (!property_id) {
      return NextResponse.json(
        { error: 'No property ID configured' },
        { status: 400 }
      );
    }

    // Extract property ID number from the full property ID (e.g., "properties/123456789" -> "123456789")
    const propertyIdNumber = property_id.includes('/') ? property_id.split('/').pop() : property_id;

    // Fetch main metrics data (daily breakdown)
    const mainReportResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyIdNumber}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'sessionsPerUser' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }]
      }),
    });

    if (!mainReportResponse.ok) {
      const errorText = await mainReportResponse.text();
      console.error('Main report API Error:', {
        status: mainReportResponse.status,
        statusText: mainReportResponse.statusText,
        errorText,
        propertyId: propertyIdNumber
      });
      
      return NextResponse.json({
        error: `Failed to fetch main report: ${mainReportResponse.status} ${mainReportResponse.statusText}`,
        details: errorText
      }, { status: mainReportResponse.status });
    }

    // Fetch device data
    const deviceDataResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyIdNumber}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
      }),
    });

    if (!deviceDataResponse.ok) {
      const errorText = await deviceDataResponse.text();
      console.error('Device data API Error:', {
        status: deviceDataResponse.status,
        statusText: deviceDataResponse.statusText,
        errorText
      });
    }

    const mainReportData = await mainReportResponse.json();
    const deviceData = deviceDataResponse.ok ? await deviceDataResponse.json() : { rows: [] };

    // Return the data in the format expected by the component
    return NextResponse.json({
      mainReport: mainReportData,
      deviceData: deviceData,
      metadata: {
        propertyId: propertyIdNumber,
        dateRange: { startDate, endDate },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 