import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveGoogleAnalyticsData } from '@/lib/external-api-data';

export async function POST(request: NextRequest) {
  try {
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
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_analytics_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'No Google Analytics connection found' },
        { status: 400 }
      );
    }

    // Create test data matching your dashboard
    const testData = {
      // Core metrics from your dashboard
      activeUsers: 4370,
      newUsers: 3848,
      sessions: 5294,
      pageViews: 10725,
      bounceRate: 0.412, // 41.2%
      averageSessionDuration: 180, // 3 minutes
      sessionsPerUser: 1.21,
      
      // Legacy fields for backward compatibility
      totalUsers: 4370,
      totalSessions: 5294,
      totalPageviews: 10725,
      sessionDuration: 180,
      
      // Device breakdown
      usersByDevice: [
        { device: 'desktop', users: 2620 },
        { device: 'mobile', users: 1500 },
        { device: 'tablet', users: 250 }
      ],
      
      // Top pages
      topPages: [
        { page: '/dashboard', pageviews: 2150 },
        { page: '/profile', pageviews: 1800 },
        { page: '/battle-plan', pageviews: 1650 },
        { page: '/growth-machine', pageviews: 1200 },
        { page: '/chat', pageviews: 1100 }
      ],
      
      // Users by country
      usersByCountry: [
        { country: 'United States', users: 2200 },
        { country: 'Canada', users: 800 },
        { country: 'United Kingdom', users: 600 },
        { country: 'Australia', users: 400 },
        { country: 'Germany', users: 370 }
      ],
      
      // Daily users for the last 30 days
      dailyUsers: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        users: Math.floor(Math.random() * 200) + 100,
      })),
      
      // Raw API response for debugging
      rawApiResponse: {
        testData: true,
        timestamp: new Date().toISOString(),
        source: 'manual_test'
      }
    };

    // Save the data
    const today = new Date().toISOString().split('T')[0];
    const saveResult = await saveGoogleAnalyticsData(
      user.id,
      tokenData.property_id || 'test-property',
      tokenData.account_name || 'Test Account',
      testData,
      today
    );

    if (saveResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Google Analytics data saved successfully',
        data: {
          userId: user.id,
          propertyId: tokenData.property_id,
          accountName: tokenData.account_name,
          dataDate: today,
          metrics: {
            activeUsers: testData.activeUsers,
            newUsers: testData.newUsers,
            sessions: testData.sessions,
            pageViews: testData.pageViews,
            bounceRate: testData.bounceRate,
            deviceBreakdown: testData.usersByDevice
          }
        }
      });
    } else {
      return NextResponse.json(
        { error: `Failed to save data: ${saveResult.error}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Test GA storage API error:', error);
    return NextResponse.json(
      { error: 'Failed to save test data' },
      { status: 500 }
    );
  }
}
