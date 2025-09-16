# External API Data Storage

This document describes the new external API data storage system that allows you to store and retrieve data from Google Analytics, Xero, ServiceM8, and QuickBooks in a centralized database.

## Overview

The system stores daily snapshots of external API data in JSON format, allowing for:
- Historical data analysis
- Reduced API calls to external services
- Faster data retrieval
- Data persistence across sessions

## Database Schema

### `external_api_data` Table

```sql
CREATE TABLE external_api_data (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    api_source TEXT CHECK (api_source IN ('google_analytics', 'xero', 'servicem8', 'quickbooks')),
    account_identifier TEXT, -- Property ID, Tenant ID, Company ID, etc.
    account_name TEXT, -- Human-readable account name
    data_date DATE NOT NULL, -- The date this data represents
    fetched_at TIMESTAMPTZ DEFAULT NOW(), -- When this data was fetched
    raw_data JSONB NOT NULL DEFAULT '{}', -- Raw API data
    metrics JSONB DEFAULT '{}', -- Processed metrics for quick access
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, api_source, account_identifier, data_date)
);
```

## Features

### 1. Google Analytics Integration

- **Automatic Data Storage**: Google Analytics data is automatically saved to the database when fetched
- **Caching**: Recent data (within 24 hours) is served from the database instead of making new API calls
- **Historical Data**: Store daily snapshots for trend analysis

### 2. Data Management

- **Upsert Operations**: Data is upserted based on user, API source, account, and date
- **Error Handling**: Failed API calls are stored with error status and messages
- **Data Retention**: Built-in cleanup function for old data (default: 365 days)

### 3. Query Capabilities

- **Latest Data**: Get the most recent data for any API source
- **Date Range Queries**: Retrieve data for specific date ranges
- **Filtering**: Filter by API source, account, and date

## API Endpoints

### 1. Store Data
```typescript
// Save Google Analytics data
await saveGoogleAnalyticsData(userId, propertyId, accountName, analyticsData, dataDate);

// Save any external API data
await saveExternalApiData({
  user_id: userId,
  api_source: 'google_analytics',
  account_identifier: propertyId,
  account_name: accountName,
  data_date: dataDate,
  raw_data: apiData,
  metrics: processedMetrics,
  status: 'success'
});
```

### 2. Retrieve Data
```typescript
// Get latest data
const { data } = await getLatestGoogleAnalyticsData(userId, propertyId);

// Get data by date range
const { data } = await getGoogleAnalyticsData(userId, propertyId, startDate, endDate);

// Get any external API data
const { data } = await getExternalApiData(userId, 'google_analytics', startDate, endDate, propertyId);
```

### 3. HTTP Endpoints

- `GET /api/analytics-stored` - Retrieve stored Google Analytics data
- `GET /api/analytics-data` - Fetch fresh data and store it (existing endpoint, now with storage)

## Admin Interface

Access the admin interface at `/admin/external-api-data` to:
- View all stored external API data
- Filter by API source, date range
- Monitor data status and errors
- View metrics and raw data

## Usage Examples

### 1. Basic Google Analytics Data Storage

```typescript
import { saveGoogleAnalyticsData, getLatestGoogleAnalyticsData } from '@/lib/external-api-data';

// Save data
const analyticsData = {
  totalUsers: 1250,
  totalSessions: 1800,
  totalPageviews: 3200,
  bounceRate: 0.35,
  sessionDuration: 180,
  // ... other data
};

await saveGoogleAnalyticsData(userId, propertyId, accountName, analyticsData);

// Retrieve latest data
const { data: latestData } = await getLatestGoogleAnalyticsData(userId, propertyId);
```

### 2. Custom External API Data

```typescript
import { saveExternalApiData } from '@/lib/external-api-data';

// Save Xero data
await saveExternalApiData({
  user_id: userId,
  api_source: 'xero',
  account_identifier: tenantId,
  account_name: 'My Xero Company',
  data_date: '2024-02-03',
  raw_data: xeroData,
  metrics: { totalInvoices: 150, totalRevenue: 50000 },
  status: 'success'
});
```

## Data Cleanup

The system includes a cleanup function to remove old data:

```typescript
import { cleanupOldExternalApiData } from '@/lib/external-api-data';

// Clean up data older than 365 days (default)
await cleanupOldExternalApiData();

// Clean up data older than 90 days
await cleanupOldExternalApiData(90);
```

## Testing

Run the test script to verify functionality:

```bash
npx tsx scripts/test-external-api-data.ts
```

## Migration

To apply the database migration:

```bash
# The migration file is already created at:
# supabase/migrations/20250203000000_create_external_api_data_table.sql
```

## Future Enhancements

1. **Xero Integration**: Add automatic Xero data storage
2. **ServiceM8 Integration**: Add automatic ServiceM8 data storage  
3. **QuickBooks Integration**: Add automatic QuickBooks data storage
4. **Data Analytics**: Add built-in analytics and reporting
5. **Scheduled Sync**: Add scheduled data synchronization
6. **Data Export**: Add data export functionality

## Troubleshooting

### Common Issues

1. **Data Not Saving**: Check database permissions and RLS policies
2. **API Errors**: Check external API credentials and rate limits
3. **Performance**: Consider adding indexes for large datasets

### Debugging

Enable debug logging by setting the log level in your environment:

```bash
DEBUG=external-api-data
```

## Security

- All data is protected by Row Level Security (RLS)
- Users can only access their own data
- API credentials are stored securely in separate tables
- Data is encrypted at rest in the database
