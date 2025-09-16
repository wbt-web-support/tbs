/**
 * Test script for external API data storage functionality
 * This script tests the Google Analytics data storage and retrieval
 */

import { createClient } from '../utils/supabase/server';
import { saveGoogleAnalyticsData, getGoogleAnalyticsData, getLatestGoogleAnalyticsData } from '../lib/external-api-data';

async function testExternalApiData() {
  console.log('🧪 Testing External API Data Storage...\n');

  try {
    // Test data
    const testUserId = 'test-user-id';
    const testPropertyId = 'test-property-123';
    const testAccountName = 'Test Analytics Account';
    const testDate = new Date().toISOString().split('T')[0];

    const testAnalyticsData = {
      totalUsers: 1250,
      totalSessions: 1800,
      totalPageviews: 3200,
      bounceRate: 0.35,
      sessionDuration: 180,
      topPages: [
        { page: '/dashboard', pageviews: 850 },
        { page: '/profile', pageviews: 420 },
        { page: '/battle-plan', pageviews: 380 },
      ],
      usersByCountry: [
        { country: 'United States', users: 650 },
        { country: 'Canada', users: 180 },
      ],
      usersByDevice: [
        { device: 'desktop', users: 720 },
        { device: 'mobile', users: 380 },
      ],
      dailyUsers: [
        { date: testDate, users: 45 },
        { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], users: 42 },
      ],
    };

    console.log('1. Testing data saving...');
    const saveResult = await saveGoogleAnalyticsData(
      testUserId,
      testPropertyId,
      testAccountName,
      testAnalyticsData,
      testDate
    );

    if (saveResult.success) {
      console.log('✅ Data saved successfully');
    } else {
      console.log('❌ Failed to save data:', saveResult.error);
      return;
    }

    console.log('\n2. Testing latest data retrieval...');
    const latestResult = await getLatestGoogleAnalyticsData(testUserId, testPropertyId);
    
    if (latestResult.data) {
      console.log('✅ Latest data retrieved successfully');
      console.log('   - Data date:', latestResult.data.data_date);
      console.log('   - Account name:', latestResult.data.account_name);
      console.log('   - Total users:', latestResult.data.metrics?.totalUsers);
    } else {
      console.log('❌ Failed to retrieve latest data:', latestResult.error);
    }

    console.log('\n3. Testing data retrieval by date range...');
    const rangeResult = await getGoogleAnalyticsData(
      testUserId,
      testPropertyId,
      testDate,
      testDate
    );

    if (rangeResult.data.length > 0) {
      console.log('✅ Data retrieved by date range successfully');
      console.log('   - Records found:', rangeResult.data.length);
    } else {
      console.log('❌ No data found for date range:', rangeResult.error);
    }

    console.log('\n4. Testing database connection...');
    const supabase = await createClient();
    const { data: tableData, error: tableError } = await supabase
      .from('external_api_data')
      .select('*')
      .eq('user_id', testUserId)
      .eq('api_source', 'google_analytics')
      .limit(1);

    if (tableError) {
      console.log('❌ Database connection failed:', tableError.message);
    } else {
      console.log('✅ Database connection successful');
      console.log('   - Table exists and accessible');
      console.log('   - Sample record found:', !!tableData?.[0]);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testExternalApiData();
}

export { testExternalApiData };
