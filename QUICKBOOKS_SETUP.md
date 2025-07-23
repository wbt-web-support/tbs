# QuickBooks Integration Setup Guide

## Overview
This guide will help you complete the QuickBooks integration setup for your TBS application. The integration allows users to connect their QuickBooks accounts and sync financial data to your Supabase database.

## What We've Implemented

### ✅ Completed Components

1. **Sidebar Integration**
   - Added "Integrations" section with QuickBooks tab
   - Consistent styling with existing sidebar components
   - Icon: CreditCard from Lucide React

2. **QuickBooks Integration Page**
   - Located at: `/integrations/quickbooks`
   - Connection status display
   - Data sync controls
   - Company information display
   - Data overview with counts

3. **Database Schema**
   - Migration file: `supabase/migrations/20250121000000_create_quickbooks_integration.sql`
   - Tables created:
     - `quickbooks_connections` - OAuth tokens and connection info
     - `qb_accounts` - Chart of Accounts
     - `qb_customers` - Customer data
     - `qb_vendors` - Vendor information
     - `qb_invoices` - Sales invoices
     - `qb_bills` - Vendor bills
     - `qb_payments` - Payment records
     - `qb_items` - Products/Services
     - `qb_employees` - Employee data
   - Row Level Security (RLS) policies implemented
   - Automatic timestamps and data isolation

4. **API Endpoints**
   - `/api/quickbooks/connect` - Initiate OAuth flow
   - `/api/quickbooks/callback` - Handle OAuth callback
   - `/api/quickbooks/sync` - Sync QuickBooks data
   - `/api/quickbooks/disconnect` - Remove connection

5. **QuickBooks API Service**
   - Located at: `lib/quickbooks-api.ts`
   - OAuth management
   - Data fetching and transformation
   - Token refresh handling
   - Database operations

6. **Environment Variables**
   - Added to your `.env.local` file
   - Ready for QuickBooks credentials

## Next Steps to Complete Setup

### 1. Run Database Migration

```bash
# Navigate to your project directory
cd /mnt/c/Users/NJ-25/Documents/Chatbot/tbs

# Apply the migration to create QuickBooks tables
npx supabase db push
```

### 2. Set Up QuickBooks Developer Account

1. **Create Intuit Developer Account**
   - Go to: https://developer.intuit.com/
   - Sign up or log in with existing account

2. **Create New App**
   - Click "Create an app"
   - Choose "QuickBooks Online and Payments"
   - Fill in app details:
     - App name: "TBS QuickBooks Integration"
     - Description: "Business coaching platform with QuickBooks data sync"

3. **Configure OAuth Settings**
   - Redirect URIs: `http://localhost:3000/api/quickbooks/callback`
   - For production: `https://yourdomain.com/api/quickbooks/callback`

4. **Get Credentials**
   - Copy Client ID and Client Secret
   - Update your `.env.local` file:

```env
QUICKBOOKS_CLIENT_ID=your_actual_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_actual_client_secret_here
```

### 3. Test the Integration

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Integration Page**
   - Go to: http://localhost:3000/integrations/quickbooks
   - Click "Connect to QuickBooks"
   - Complete OAuth flow

3. **Test Data Sync**
   - After connection, click "Sync Now"
   - Check Supabase dashboard for synced data

### 4. Production Deployment

1. **Update Environment Variables**
   - Set production QuickBooks credentials
   - Update redirect URI to production domain

2. **Deploy Database Migration**
   ```bash
   npx supabase db push --project-ref your-project-ref
   ```

## Security Features

- **Row Level Security**: Each user can only access their own QuickBooks data
- **Encrypted Tokens**: OAuth tokens are stored securely
- **State Validation**: OAuth flow includes state parameter validation
- **Token Refresh**: Automatic token refresh when expired
- **User Isolation**: Complete data separation between users

## Supported QuickBooks Data

The integration syncs the following QuickBooks entities:

- **Accounts**: Chart of Accounts with balances
- **Customers**: Customer information and contact details
- **Vendors**: Vendor information and contact details
- **Items**: Products and services with pricing
- **Invoices**: Sales invoices with line items
- **Bills**: Vendor bills and expenses
- **Payments**: Customer payments and methods
- **Employees**: Employee information and details

## API Usage Examples

### Check Connection Status
```javascript
const response = await fetch('/api/quickbooks/sync');
const status = await response.json();
```

### Trigger Manual Sync
```javascript
const response = await fetch('/api/quickbooks/sync', {
  method: 'POST'
});
```

### Disconnect QuickBooks
```javascript
const response = await fetch('/api/quickbooks/disconnect', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ keepData: true }) // or false to delete data
});
```

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**
   - Ensure redirect URI in Intuit Developer matches exactly
   - Check for trailing slashes and protocol (http vs https)

2. **Token Expired**
   - Integration handles automatic token refresh
   - If refresh fails, user needs to reconnect

3. **Missing Environment Variables**
   - Verify all QuickBooks variables are set in `.env.local`
   - Restart development server after changes

4. **Database Connection Issues**
   - Ensure migration has been applied
   - Check Supabase connection and RLS policies

### Debug Mode

To enable detailed logging, add to your `.env.local`:
```env
QUICKBOOKS_DEBUG=true
```

## Support

- QuickBooks API Documentation: https://developer.intuit.com/app/developer/qbo/docs/develop
- Supabase Documentation: https://supabase.com/docs
- Project Issues: Contact your development team

## Next Features (Future Enhancements)

- Real-time webhooks for instant data updates
- Advanced reporting and analytics
- Bulk data operations
- Custom field mapping
- Multi-company support
- Data export functionality

---

**Note**: This integration uses QuickBooks Sandbox by default. For production, update the base URL configuration and use production QuickBooks credentials.