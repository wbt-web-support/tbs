/**
 * Test script to verify Google Analytics dashboard data storage
 * This matches the data structure shown in your dashboard
 */

import { saveGoogleAnalyticsData, getLatestGoogleAnalyticsData } from '../lib/external-api-data';

async function testGADashboardData() {
  console.log('🧪 Testing Google Analytics Dashboard Data Storage...\n');

  try {
    // Test data matching your dashboard
    const testUserId = 'test-user-id';
    const testPropertyId = 'GA4-PROPERTY-ID';
    const testAccountName = 'Boiler Sure - GA4';
    const testDate = new Date().toISOString().split('T')[0];

    // Data matching your dashboard metrics
    const dashboardData = {
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
      
      // Device breakdown (from your dashboard)
      usersByDevice: [
        { device: 'desktop', users: 2620 },
        { device: 'mobile', users: 1500 },
        { device: 'tablet', users: 250 }
      ],
      
      // Top pages (example data)
      topPages: [
        { page: '/dashboard', pageviews: 2150 },
        { page: '/profile', pageviews: 1800 },
        { page: '/battle-plan', pageviews: 1650 },
        { page: '/growth-machine', pageviews: 1200 },
        { page: '/chat', pageviews: 1100 }
      ],
      
      // Users by country (example data)
      usersByCountry: [
        { country: 'United States', users: 2200 },
        { country: 'Canada', users: 800 },
        { country: 'United Kingdom', users: 600 },
        { country: 'Australia', users: 400 },
        { country: 'Germany', users: 370 }
      ],
      
      // Daily users for the last 30 days (example data)
      dailyUsers: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        users: Math.floor(Math.random() * 200) + 100, // Random between 100-300
      })),
      
      // Raw API response for debugging
      rawApiResponse: {
        mainReport: { rows: [{ metricValues: [{ value: '4370' }, { value: '3848' }, { value: '5294' }, { value: '10725' }, { value: '0.412' }, { value: '180' }, { value: '1.21' }] }] },
        deviceData: { rows: [{ dimensionValues: [{ value: 'desktop' }], metricValues: [{ value: '2620' }] }] },
        metadata: {
          propertyId: testPropertyId,
          dateRange: { startDate: '30daysAgo', endDate: 'today' },
          timestamp: new Date().toISOString(),
          dataSource: 'user'
        }
      }
    };

    console.log('1. Saving dashboard data...');
    console.log('   - Active Users:', dashboardData.activeUsers);
    console.log('   - New Users:', dashboardData.newUsers);
    console.log('   - Sessions:', dashboardData.sessions);
    console.log('   - Page Views:', dashboardData.pageViews);
    console.log('   - Bounce Rate:', (dashboardData.bounceRate * 100).toFixed(1) + '%');
    console.log('   - Device Breakdown:', dashboardData.usersByDevice.length, 'devices');

    const saveResult = await saveGoogleAnalyticsData(
      testUserId,
      testPropertyId,
      testAccountName,
      dashboardData,
      testDate
    );

    if (saveResult.success) {
      console.log('✅ Dashboard data saved successfully');
    } else {
      console.log('❌ Failed to save dashboard data:', saveResult.error);
      return;
    }

    console.log('\n2. Retrieving latest data...');
    const latestResult = await getLatestGoogleAnalyticsData(testUserId, testPropertyId);
    
    if (latestResult.data) {
      console.log('✅ Latest data retrieved successfully');
      console.log('   - Account:', latestResult.data.account_name);
      console.log('   - Data Date:', latestResult.data.data_date);
      console.log('   - Status:', latestResult.data.status);
      
      if (latestResult.data.metrics) {
        console.log('\n📊 Stored Metrics:');
        console.log('   - Active Users:', latestResult.data.metrics.activeUsers);
        console.log('   - New Users:', latestResult.data.metrics.newUsers);
        console.log('   - Sessions:', latestResult.data.metrics.sessions);
        console.log('   - Page Views:', latestResult.data.metrics.pageViews);
        console.log('   - Bounce Rate:', (latestResult.data.metrics.bounceRate * 100).toFixed(1) + '%');
        console.log('   - Device Breakdown:', latestResult.data.metrics.deviceBreakdown?.length || 0, 'devices');
        
        if (latestResult.data.metrics.summary) {
          console.log('\n📈 Summary:');
          console.log('   - Total Active Users:', latestResult.data.metrics.summary.totalActiveUsers);
          console.log('   - Total New Users:', latestResult.data.metrics.summary.totalNewUsers);
          console.log('   - Total Sessions:', latestResult.data.metrics.summary.totalSessions);
          console.log('   - Total Page Views:', latestResult.data.metrics.summary.totalPageViews);
          console.log('   - Average Bounce Rate:', (latestResult.data.metrics.summary.averageBounceRate * 100).toFixed(1) + '%');
        }
      }
    } else {
      console.log('❌ Failed to retrieve latest data:', latestResult.error);
    }

    console.log('\n🎉 Dashboard data test completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Apply the database migration');
    console.log('   2. Visit your analytics dashboard to trigger data storage');
    console.log('   3. Check the admin page at /admin/external-api-data');
    console.log('   4. View stored data in the external_api_data table');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testGADashboardData();
}

export { testGADashboardData };
