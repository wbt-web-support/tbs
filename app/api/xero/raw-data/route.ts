import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSamples = searchParams.get('samples') === 'true';
    const tenantId = searchParams.get('tenantId');
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

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

    // Prepare raw data response
    const rawData: any = {
      connection_info: {
        tenant_id: connection.tenant_id,
        organization_name: connection.organization_name,
        connected_at: connection.connected_at,
        last_sync_at: connection.last_sync_at,
        sync_status: connection.sync_status,
        error_message: connection.error_message
      },
      data_summary: {
        invoices_count: connection.invoices?.length || 0,
        contacts_count: connection.contacts?.length || 0,
        accounts_count: connection.accounts?.length || 0,
        bank_transactions_count: connection.bank_transactions?.length || 0
      },
      raw_data: {
        invoices: connection.invoices || [],
        contacts: connection.contacts || [],
        accounts: connection.accounts || [],
        bank_transactions: connection.bank_transactions || []
      }
    };

    // Add sample data if requested
    if (includeSamples) {
      rawData.samples = {
        sample_invoice: connection.invoices?.[0] || null,
        sample_contact: connection.contacts?.[0] || null,
        sample_account: connection.accounts?.[0] || null,
        sample_bank_transaction: connection.bank_transactions?.[0] || null
      };
    }

    return NextResponse.json(rawData);

  } catch (error) {
    console.error('Xero raw data error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get raw data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 