# QuickBooks Single Table Implementation Guide

## Overview
This implementation uses a simplified single-table approach with JSON storage instead of multiple normalized tables. This makes the schema much simpler while maintaining all functionality.

## Files Created

### 1. Database Migration
- `supabase/migrations/20250121120000_simplified_quickbooks_schema.sql`
  - Creates single `quickbooks_data` table
  - Drops existing multiple tables
  - Includes helper functions and RLS policies

### 2. API Services (Simplified)
- `lib/quickbooks-api-simplified.ts` - Main QuickBooks API service
- `lib/quickbooks-kpi-simplified.ts` - KPI calculation service

### 3. API Endpoints (Updated)
- `app/api/quickbooks/connect/route-single.ts`
- `app/api/quickbooks/callback/route-single.ts`
- `app/api/quickbooks/sync/route-single.ts`
- `app/api/quickbooks/kpis/route-single.ts`
- `app/api/quickbooks/disconnect/route-single.ts`

## Implementation Steps

### Step 1: Run Database Migration
```bash
# In Supabase SQL Editor or via CLI
# Run: supabase/migrations/20250121120000_simplified_quickbooks_schema.sql
```

### Step 2: Replace API Files
Replace the existing files with the simplified versions:

```bash
# Replace the API service files
mv lib/quickbooks-api-simplified.ts lib/quickbooks-api.ts
mv lib/quickbooks-kpi-simplified.ts lib/quickbooks-kpi.ts

# Replace API route files
mv app/api/quickbooks/connect/route-single.ts app/api/quickbooks/connect/route.ts
mv app/api/quickbooks/callback/route-single.ts app/api/quickbooks/callback/route.ts
mv app/api/quickbooks/sync/route-single.ts app/api/quickbooks/sync/route.ts
mv app/api/quickbooks/kpis/route-single.ts app/api/quickbooks/kpis/route.ts
mv app/api/quickbooks/disconnect/route-single.ts app/api/quickbooks/disconnect/route.ts
```

### Step 3: Update Imports in UI Components
The UI components should continue to work as they use the same API endpoints. The data structure returned is compatible.

## Key Changes

### Database Schema
- **Before**: 4+ tables (quickbooks_connections, qb_revenue_data, qb_cost_data, qb_estimates, qb_kpi_snapshots)
- **After**: 1 table (quickbooks_data) with JSON fields:
  - `qb_data` - All QuickBooks raw data as JSON
  - `current_kpis` - Pre-calculated KPIs as JSON

### Data Structure
```json
{
  "qb_data": {
    "revenue_data": [...],
    "cost_data": [...],
    "estimates": [...]
  },
  "current_kpis": {
    "monthly": {
      "revenue": {"value": 50000, "change": 15.5},
      "gross_profit": {"value": 25000, "change": 12.3}
    }
  }
}
```

## Benefits of Single Table Approach

1. **Simplified Schema** - Only 1 table instead of 4+
2. **Flexible JSON Storage** - Easy to add new data types
3. **Faster Queries** - All data in one place with JSON indexes
4. **Easier Maintenance** - Fewer migrations and schema changes
5. **Better Performance** - No complex JOINs needed

## API Compatibility
All existing API endpoints work the same way. The UI components don't need changes as the response format is maintained.

## Testing
After implementation:
1. Test QuickBooks connection
2. Test data sync (both incremental and full)
3. Test KPI calculations
4. Verify UI displays correctly

## Rollback Plan
If issues occur, you can rollback by:
1. Restoring the previous API files
2. Running the old database migration
3. Re-syncing data

The simplified implementation is drop-in compatible with the existing UI.