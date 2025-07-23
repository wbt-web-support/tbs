import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';
import { XeroKPI } from '@/lib/xero-kpi';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    const tenantId = searchParams.get('tenantId'); // Optional specific tenant
    
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

    // Prepare data for KPI calculation
    const xeroData = {
      invoices: connection.invoices || [],
      contacts: connection.contacts || [],
      accounts: connection.accounts || [],
      bank_transactions: connection.bank_transactions || [],
    };

    // Calculate KPIs
    const kpiEngine = new XeroKPI(xeroData, period);
    const kpis = kpiEngine.getAllKPIs();

    return NextResponse.json({ 
      kpis,
      period,
      tenant_id: connection.tenant_id,
      organization_name: connection.organization_name,
      last_sync_at: connection.last_sync_at
    });

  } catch (error) {
    console.error('Xero KPIs error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate KPIs',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}