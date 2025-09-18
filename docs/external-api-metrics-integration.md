# External API Metrics Integration

This document describes the integration of external API metrics into the Gemini chat context.

## Overview

The system now includes external API metrics from the `external_api_data` table in the chat context, providing the AI assistant with access to real-time business metrics from various external services.

## Supported API Sources

- **Google Analytics** - Website traffic and user behavior metrics
- **Xero** - Financial data and accounting metrics  
- **QuickBooks** - Financial and business metrics
- **ServiceM8** - Service business metrics

## Implementation Details

### 1. Data Fetching

The `getExternalApiMetrics()` function fetches the latest metrics for each API source:

```typescript
async function getExternalApiMetrics(userId: string) {
  // Fetches latest metrics from external_api_data table
  // Groups by API source and gets the most recent data for each
  // Returns formatted metrics object
}
```

### 2. Context Integration

External API metrics are included in the user context via the `getUserData()` function:

```typescript
const userData = {
  businessInfo: businessInfo || null,
  chatHistory: chatHistoryData?.messages || [],
  teamMembers: teamMembersData || [],
  externalApiMetrics: externalApiMetrics || null, // ← New field
  additionalData: {} as Record<string, any[]>
};
```

### 3. Formatting

The `prepareUserContext()` function formats the metrics for the AI model:

- **Google Analytics**: Active users, sessions, page views, bounce rate, top pages
- **Xero**: Financial summary, invoices, customers, revenue, cash flow
- **QuickBooks**: Business metrics and KPIs
- **ServiceM8**: Service-specific metrics

## Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📊 EXTERNAL API METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Google Analytics Metrics:
────────────────────────────────────────────────────────
- Data Date: 2024-01-15
- Last Updated: 1/15/2024, 2:30:00 PM
- Metrics:
  📊 Summary:
    - Active Users: 1250
    - New Users: 340
    - Sessions: 2100
    - Page Views: 4500
    - Bounce Rate: 35%
    - Avg Session Duration: 2m 30s
  🔝 Top Pages:
    1. /home: 1200 views
    2. /products: 800 views
    3. /about: 400 views

📈 Xero Metrics:
────────────────────────────────────────────────────────
- Data Date: 2024-01-15
- Last Updated: 1/15/2024, 3:00:00 PM
- Metrics:
  💰 Financial Summary:
    - Total Invoices: 45
    - Total Customers: 120
    - Total Suppliers: 25
    - Total Revenue: $125,000
    - Accounts Receivable: $15,000
    - Net Cash Flow: $8,500
```

## Testing

Use the test script to verify the integration:

```bash
npx tsx scripts/test-external-api-metrics.ts <user_id>
```

This will:
1. Fetch external API metrics for the specified user
2. Format the metrics according to the source type
3. Display the formatted output

## Benefits

1. **Contextual Awareness**: The AI assistant now has access to real-time business metrics
2. **Informed Responses**: Can provide insights based on actual data
3. **Business Intelligence**: Can answer questions about performance, trends, and metrics
4. **Multi-Source Integration**: Combines data from multiple external services

## Data Structure

The metrics are stored in the `external_api_data` table with the following structure:

```sql
CREATE TABLE public.external_api_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_source text NOT NULL, -- 'google_analytics', 'xero', 'quickbooks', 'servicem8'
  account_identifier text,
  account_name text,
  data_date date NOT NULL,
  fetched_at timestamp with time zone DEFAULT now(),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb, -- ← Key metrics for quick access
  status text DEFAULT 'success'::text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

The `metrics` field contains pre-calculated, formatted metrics for quick access and display in the chat context.
