import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';
import { XeroKPI } from '@/lib/xero-kpi';
import { saveXeroData } from '@/lib/external-api-data';

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

    // Save data to external_api_data table for historical tracking
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Prepare data for storage
      const xeroDataForStorage = {
        organization: {
          OrganisationID: connection.tenant_id,
          Name: connection.organization_name,
        },
        invoices: xeroData.invoices,
        contacts: xeroData.contacts,
        accounts: xeroData.accounts,
        bank_transactions: xeroData.bank_transactions,
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
          kpiTimestamp: new Date().toISOString(),
          period: period,
          source: 'xero_kpis_api'
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
        console.log('Xero KPIs data saved to external_api_data table');
      } else {
        console.error('Failed to save Xero KPIs data to external_api_data table:', saveResult.error);
      }
    } catch (saveError) {
      console.error('Error saving Xero KPIs data to external_api_data table:', saveError);
      // Don't fail the request if storage fails
    }

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