import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';
import { saveXeroData } from '@/lib/external-api-data';
import { XeroKPI } from '@/lib/xero-kpi';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      )
    }

    // Get tenant ID from request body (optional, defaults to first connection)
    const body = await request.json().catch(() => ({}));
    const { tenantId } = body;

    const xeroAPI = new XeroAPI(supabase);

    // Get connection(s)
    let connection;
    if (tenantId) {
      connection = await xeroAPI.getConnection(user.id, tenantId);
    } else {
      const connections = await xeroAPI.getAllConnections(user.id);
      connection = connections[0]; // Use first connection if no specific tenant requested
    }

    if (!connection) {
      return NextResponse.json(
        { error: 'No Xero connection found. Please connect to Xero first.' },
        { status: 404 }
      );
    }

    // Perform sync
    await xeroAPI.syncData(user.id, connection.tenant_id);

    // Get updated connection data
    const updatedConnection = await xeroAPI.getConnection(user.id, connection.tenant_id);

    // Save data to external_api_data table for historical tracking
    if (updatedConnection) {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Calculate KPIs for the synced data
        const xeroData = {
          invoices: updatedConnection.invoices || [],
          contacts: updatedConnection.contacts || [],
          accounts: updatedConnection.accounts || [],
          bank_transactions: updatedConnection.bank_transactions || [],
        };
        
        const kpiEngine = new XeroKPI(xeroData, 'monthly');
        const kpis = kpiEngine.getAllKPIs();
        
        // Prepare data for storage
        const xeroDataForStorage = {
          organization: {
            OrganisationID: connection.tenant_id,
            Name: connection.organization_name,
            // Add other organization fields if available
          },
          invoices: updatedConnection.invoices || [],
          contacts: updatedConnection.contacts || [],
          accounts: updatedConnection.accounts || [],
          bank_transactions: updatedConnection.bank_transactions || [],
          kpis: {
            totalRevenue: kpis.find(k => k.label === 'Total Revenue')?.value || 0,
            accountsReceivable: kpis.find(k => k.label === 'Accounts Receivable')?.value || 0,
            averageInvoiceValue: kpis.find(k => k.label === 'Average Invoice Value')?.value || 0,
            invoiceCount: kpis.find(k => k.label === 'Total Invoices')?.value || 0,
            customerCount: kpis.find(k => k.label === 'Total Customers')?.value || 0,
            cashFlow: kpis.find(k => k.label === 'Net Cash Flow')?.value || 0,
            overdueAmount: kpis.find(k => k.label === 'Overdue Amount')?.value || 0,
            daysSalesOutstanding: kpis.find(k => k.label === 'Days Sales Outstanding')?.value || 0,
          },
          rawApiResponse: {
            syncTimestamp: new Date().toISOString(),
            source: 'xero_sync_api'
          }
        };

        // Save to external_api_data table
        const saveResult = await saveXeroData(
          user.id,
          connection.tenant_id,
          connection.organization_name,
          xeroDataForStorage,
          today
        );

        if (saveResult.success) {
          console.log('Xero data saved to external_api_data table');
        } else {
          console.error('Failed to save Xero data to external_api_data table:', saveResult.error);
        }
      } catch (saveError) {
        console.error('Error saving Xero data to external_api_data table:', saveError);
        // Don't fail the sync if storage fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Xero data synced successfully',
      tenant_id: connection.tenant_id,
      organization_name: connection.organization_name,
      invoices: updatedConnection?.invoices?.length || 0,
      contacts: updatedConnection?.contacts?.length || 0,
      accounts: updatedConnection?.accounts?.length || 0,
      bank_transactions: updatedConnection?.bank_transactions?.length || 0,
      last_sync_at: updatedConnection?.last_sync_at,
      sync_status: updatedConnection?.sync_status
    });

  } catch (error) {
    console.error('Xero sync error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync Xero data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('Xero sync GET request received');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', user.id);
    const xeroAPI = new XeroAPI(supabase);
    const connections = await xeroAPI.getAllConnections(user.id);
    console.log('Found connections:', connections.length);

    if (connections.length === 0) {
      return NextResponse.json({
        connected: false,
        sync_status: 'disconnected',
        last_sync_at: null,
        error_message: null,
        connections: []
      });
    }

    // Return data for all connections
    const connectionsData = connections.map(conn => ({
      tenant_id: conn.tenant_id,
      organization_name: conn.organization_name,
      connected: !!conn.connected_at,
      sync_status: conn.sync_status || 'pending',
      last_sync_at: conn.last_sync_at,
      error_message: conn.error_message,
      invoices: conn.invoices || [],
      contacts: conn.contacts || [],
      accounts: conn.accounts || [],
      bank_transactions: conn.bank_transactions || []
    }));

    // Return summary for primary connection (first one)
    const primaryConnection = connectionsData[0];
    const response = {
      connected: true,
      sync_status: primaryConnection.sync_status,
      last_sync_at: primaryConnection.last_sync_at,
      error_message: primaryConnection.error_message,
      organization_name: primaryConnection.organization_name,
      invoices: primaryConnection.invoices,
      contacts: primaryConnection.contacts,
      accounts: primaryConnection.accounts,
      bank_transactions: primaryConnection.bank_transactions,
      connections: connectionsData // Include all connections for multi-tenant support
    };
    
    console.log('Returning Xero data:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Xero sync status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}