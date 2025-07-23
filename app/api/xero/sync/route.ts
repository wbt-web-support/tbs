import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

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

    console.log('Xero sync POST - User ID:', user.id);

    // Get tenant ID from request body (optional, defaults to first connection)
    const body = await request.json().catch(() => ({}));
    const { tenantId } = body;

    const xeroAPI = new XeroAPI(supabase);

    // Get connection(s)
    let connection;
    try {
      if (tenantId) {
        console.log('Looking for specific tenant:', tenantId);
        connection = await xeroAPI.getConnection(user.id, tenantId);
      } else {
        console.log('Looking for any connections for user');
        const connections = await xeroAPI.getAllConnections(user.id);
        console.log('Found connections:', connections.length);
        connection = connections[0]; // Use first connection if no specific tenant requested
      }
    } catch (connError) {
      console.error('Error getting connection:', connError);
      return NextResponse.json(
        { error: 'Failed to retrieve Xero connection', details: connError.message },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { error: 'No Xero connection found. Please connect to Xero first.' },
        { status: 404 }
      );
    }

    console.log('Found connection:', { 
      tenant_id: connection.tenant_id, 
      organization_name: connection.organization_name,
      sync_status: connection.sync_status 
    });

    // Perform sync
    try {
      await xeroAPI.syncData(user.id, connection.tenant_id);
    } catch (syncError) {
      console.error('Sync error:', syncError);
      return NextResponse.json(
        { error: 'Failed to sync Xero data', details: syncError.message },
        { status: 500 }
      );
    }

    // Get updated connection data
    const updatedConnection = await xeroAPI.getConnection(user.id, connection.tenant_id);

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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const xeroAPI = new XeroAPI(supabase);
    const connections = await xeroAPI.getAllConnections(user.id);

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

    return NextResponse.json({
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
    });

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