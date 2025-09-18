#!/usr/bin/env tsx

/**
 * Test script to verify external API metrics integration
 * This script tests the getExternalApiMetrics function and formatting
 */

import { createClient } from '@/utils/supabase/server';

// Helper function to get external API data metrics (copied from Gemini API route)
async function getExternalApiMetrics(userId: string) {
  if (!userId) {
    console.log('⚠️ [Supabase] No userId provided for getExternalApiMetrics');
    return null;
  }

  console.log(`🔄 [Supabase] Fetching external API metrics for user: ${userId}`);

  try {
    const supabase = await createClient();
    
    // Fetch latest metrics from all API sources
    const { data: externalApiData, error } = await supabase
      .from('external_api_data')
      .select('api_source, account_identifier, account_name, data_date, metrics, updated_at, status')
      .eq('user_id', userId)
      .eq('status', 'success')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] Error fetching external API metrics:', error);
      return null;
    }

    if (!externalApiData || externalApiData.length === 0) {
      console.log('⚠️ [Supabase] No external API data found for user');
      return null;
    }

    // Group by API source and get the latest for each
    const latestMetrics: Record<string, any> = {};
    const seenSources = new Set<string>();

    externalApiData.forEach(record => {
      const key = `${record.api_source}_${record.account_identifier}`;
      if (!seenSources.has(key)) {
        seenSources.add(key);
        latestMetrics[record.api_source] = {
          account_identifier: record.account_identifier,
          account_name: record.account_name,
          data_date: record.data_date,
          metrics: record.metrics,
          updated_at: record.updated_at
        };
      }
    });

    console.log(`✅ [Supabase] Fetched external API metrics for ${Object.keys(latestMetrics).length} sources`);
    return latestMetrics;
  } catch (error) {
    console.error('❌ [Supabase] Error fetching external API metrics:', error);
    return null;
  }
}

// Helper function to format external API metrics (copied from Gemini API route)
function formatExternalApiMetrics(externalApiMetrics: any) {
  if (!externalApiMetrics || Object.keys(externalApiMetrics).length === 0) {
    return '';
  }

  const parts: string[] = [`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📊 EXTERNAL API METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`];
  
  Object.entries(externalApiMetrics).forEach(([apiSource, data]: [string, any]) => {
    const sourceName = apiSource.charAt(0).toUpperCase() + apiSource.slice(1).replace('_', ' ');
    const lastUpdated = new Date(data.updated_at).toLocaleString();
    
    parts.push(`
📈 ${sourceName} Metrics:
────────────────────────────────────────────────────────
- Data Date: ${data.data_date}
- Last Updated: ${lastUpdated}
- Metrics:`);
    
    if (data.metrics) {
      // Format metrics based on API source
      if (apiSource === 'google_analytics') {
        if (data.metrics.summary) {
          parts.push(`  📊 Summary:`);
          parts.push(`    - Active Users: ${data.metrics.summary.totalActiveUsers || 0}`);
          parts.push(`    - New Users: ${data.metrics.summary.totalNewUsers || 0}`);
          parts.push(`    - Sessions: ${data.metrics.summary.totalSessions || 0}`);
          parts.push(`    - Page Views: ${data.metrics.summary.totalPageViews || 0}`);
          parts.push(`    - Bounce Rate: ${data.metrics.summary.averageBounceRate || 0}%`);
          parts.push(`    - Avg Session Duration: ${data.metrics.summary.averageSessionDuration || 0}s`);
        }
        if (data.metrics.topPages && data.metrics.topPages.length > 0) {
          parts.push(`  🔝 Top Pages:`);
          data.metrics.topPages.slice(0, 3).forEach((page: any, idx: number) => {
            parts.push(`    ${idx + 1}. ${page.page}: ${page.pageviews} views`);
          });
        }
      } else if (apiSource === 'xero') {
        if (data.metrics.summary) {
          parts.push(`  💰 Financial Summary:`);
          parts.push(`    - Total Invoices: ${data.metrics.summary.totalInvoices || 0}`);
          parts.push(`    - Total Customers: ${data.metrics.summary.totalCustomers || 0}`);
          parts.push(`    - Total Suppliers: ${data.metrics.summary.totalSuppliers || 0}`);
          parts.push(`    - Total Revenue: $${data.metrics.summary.totalRevenue || 0}`);
          parts.push(`    - Accounts Receivable: $${data.metrics.summary.accountsReceivable || 0}`);
          parts.push(`    - Net Cash Flow: $${data.metrics.summary.netCashFlow || 0}`);
        }
      } else if (apiSource === 'quickbooks') {
        parts.push(`  📊 QuickBooks Metrics:`);
        Object.entries(data.metrics).forEach(([key, value]) => {
          if (key !== 'summary' && value !== null && value !== undefined) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            parts.push(`    - ${formattedKey}: ${value}`);
          }
        });
      } else if (apiSource === 'servicem8') {
        parts.push(`  🔧 ServiceM8 Metrics:`);
        Object.entries(data.metrics).forEach(([key, value]) => {
          if (key !== 'summary' && value !== null && value !== undefined) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            parts.push(`    - ${formattedKey}: ${value}`);
          }
        });
      } else {
        // Generic formatting for other API sources
        parts.push(`  📊 Raw Metrics:`);
        Object.entries(data.metrics).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            if (typeof value === 'object') {
              parts.push(`    - ${formattedKey}: ${JSON.stringify(value)}`);
            } else {
              parts.push(`    - ${formattedKey}: ${value}`);
            }
          }
        });
      }
    }
  });

  return parts.join('\n');
}

async function testExternalApiMetrics() {
  console.log('🧪 Testing External API Metrics Integration...\n');

  try {
    // Get a test user ID (you can replace this with an actual user ID)
    const testUserId = process.argv[2];
    
    if (!testUserId) {
      console.error('❌ Please provide a user ID as an argument');
      console.log('Usage: npx tsx scripts/test-external-api-metrics.ts <user_id>');
      process.exit(1);
    }

    console.log(`🔍 Testing with user ID: ${testUserId}\n`);

    // Test fetching external API metrics
    console.log('1. Fetching external API metrics...');
    const externalApiMetrics = await getExternalApiMetrics(testUserId);
    
    if (!externalApiMetrics) {
      console.log('⚠️ No external API metrics found for this user');
      return;
    }

    console.log(`✅ Found metrics for ${Object.keys(externalApiMetrics).length} API sources:`);
    Object.keys(externalApiMetrics).forEach(source => {
      console.log(`   - ${source}`);
    });

    // Test formatting
    console.log('\n2. Testing metrics formatting...');
    const formattedMetrics = formatExternalApiMetrics(externalApiMetrics);
    
    if (formattedMetrics) {
      console.log('✅ Metrics formatted successfully!');
      console.log('\n📊 Formatted Output:');
      console.log('='.repeat(80));
      console.log(formattedMetrics);
      console.log('='.repeat(80));
    } else {
      console.log('⚠️ No formatted metrics generated');
    }

    console.log('\n✅ External API metrics integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testExternalApiMetrics();
