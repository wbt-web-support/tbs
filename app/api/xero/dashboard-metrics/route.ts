import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { XeroAPI } from '@/lib/xero-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
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

    // Prepare data for metrics calculation
    const xeroData = {
      invoices: connection.invoices || [],
      contacts: connection.contacts || [],
      accounts: connection.accounts || [],
      bank_transactions: connection.bank_transactions || [],
    };

    // Calculate time-series data
    const timeSeriesData = calculateTimeSeriesData(xeroData, period);
    
    // Calculate aggregated metrics
    const aggregatedMetrics = calculateAggregatedMetrics(xeroData);
    
    // Calculate KPI trends
    const kpiTrends = calculateKPITrends(xeroData, period);

    return NextResponse.json({ 
      timeSeriesData,
      aggregatedMetrics,
      kpiTrends,
      period,
      tenant_id: connection.tenant_id,
      organization_name: connection.organization_name,
      last_sync_at: connection.last_sync_at
    });

  } catch (error) {
    console.error('Xero dashboard metrics error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate dashboard metrics',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

function calculateTimeSeriesData(data: any, period: string) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const timeSeriesData = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Filter data for this specific date
    const dayInvoices = data.invoices.filter((inv: any) => {
      const invoiceDate = new Date(inv.Date);
      return invoiceDate.toISOString().split('T')[0] === dateStr;
    });
    
    const dayTransactions = data.bank_transactions.filter((txn: any) => {
      const txnDate = new Date(txn.Date);
      return txnDate.toISOString().split('T')[0] === dateStr;
    });
    
    // Calculate daily metrics
    const revenue = dayInvoices
      .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID')
      .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
    
    const expenses = dayInvoices
      .filter((inv: any) => inv.Type === 'ACCPAY' && inv.Status === 'PAID')
      .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
    
    const cashInflow = dayTransactions
      .filter((txn: any) => txn.Type === 'RECEIVE')
      .reduce((sum: number, txn: any) => sum + (txn.Total || 0), 0);
    
    const cashOutflow = dayTransactions
      .filter((txn: any) => txn.Type === 'SPEND')
      .reduce((sum: number, txn: any) => sum + (txn.Total || 0), 0);
    
    timeSeriesData.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue,
      expenses,
      netCashFlow: revenue - expenses,
      cashInflow,
      cashOutflow,
      invoiceCount: dayInvoices.length,
      transactionCount: dayTransactions.length,
      invoicesIn: dayInvoices.filter((inv: any) => inv.Type === 'ACCREC').length,
      invoicesOut: dayInvoices.filter((inv: any) => inv.Type === 'ACCPAY').length,
    });
  }
  
  return timeSeriesData;
}

function calculateAggregatedMetrics(data: any) {
  const invoices = data.invoices || [];
  const contacts = data.contacts || [];
  const transactions = data.bank_transactions || [];
  
  // Revenue metrics
  const totalRevenue = invoices
    .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const totalExpenses = invoices
    .filter((inv: any) => inv.Type === 'ACCPAY' && inv.Status === 'PAID')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const netCashFlow = totalRevenue - totalExpenses;
  
  // Receivables and payables
  const accountsReceivable = invoices
    .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'AUTHORISED')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const accountsPayable = invoices
    .filter((inv: any) => inv.Type === 'ACCPAY' && inv.Status === 'AUTHORISED')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  // Overdue amounts
  const now = new Date();
  const overdueReceivables = invoices
    .filter((inv: any) => {
      const dueDate = new Date(inv.DueDate);
      return inv.Type === 'ACCREC' && inv.Status === 'AUTHORISED' && dueDate < now;
    })
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const overduePayables = invoices
    .filter((inv: any) => {
      const dueDate = new Date(inv.DueDate);
      return inv.Type === 'ACCPAY' && inv.Status === 'AUTHORISED' && dueDate < now;
    })
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  // Customer and supplier metrics
  const customerCount = contacts.filter((contact: any) => contact.IsCustomer).length;
  const supplierCount = contacts.filter((contact: any) => contact.IsSupplier).length;
  
  // Invoice metrics
  const paidInvoices = invoices.filter((inv: any) => inv.Status === 'PAID');
  const averageInvoiceValue = paidInvoices.length > 0 
    ? paidInvoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0) / paidInvoices.length
    : 0;
  
  // Cash flow metrics
  const totalCashInflow = transactions
    .filter((txn: any) => txn.Type === 'RECEIVE')
    .reduce((sum: number, txn: any) => sum + (txn.Total || 0), 0);
  
  const totalCashOutflow = transactions
    .filter((txn: any) => txn.Type === 'SPEND')
    .reduce((sum: number, txn: any) => sum + (txn.Total || 0), 0);
  
  return {
    totalRevenue,
    totalExpenses,
    netCashFlow,
    accountsReceivable,
    accountsPayable,
    overdueReceivables,
    overduePayables,
    customerCount,
    supplierCount,
    totalInvoices: invoices.length,
    paidInvoices: paidInvoices.length,
    averageInvoiceValue,
    totalCashInflow,
    totalCashOutflow,
    totalTransactions: transactions.length,
  };
}

function calculateKPITrends(data: any, period: string) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(currentPeriodStart.getDate() - days);
  
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
  
  // Calculate current period metrics
  const currentPeriodInvoices = data.invoices.filter((inv: any) => {
    const invoiceDate = new Date(inv.Date);
    return invoiceDate >= currentPeriodStart;
  });
  
  const previousPeriodInvoices = data.invoices.filter((inv: any) => {
    const invoiceDate = new Date(inv.Date);
    return invoiceDate >= previousPeriodStart && invoiceDate < currentPeriodStart;
  });
  
  // Revenue trends
  const currentRevenue = currentPeriodInvoices
    .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const previousRevenue = previousPeriodInvoices
    .filter((inv: any) => inv.Type === 'ACCREC' && inv.Status === 'PAID')
    .reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
  
  const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  
  // Invoice count trends
  const currentInvoiceCount = currentPeriodInvoices.length;
  const previousInvoiceCount = previousPeriodInvoices.length;
  const invoiceCountChange = previousInvoiceCount > 0 ? ((currentInvoiceCount - previousInvoiceCount) / previousInvoiceCount) * 100 : 0;
  
  // Average invoice value trends
  const currentPaidInvoices = currentPeriodInvoices.filter((inv: any) => inv.Status === 'PAID');
  const previousPaidInvoices = previousPeriodInvoices.filter((inv: any) => inv.Status === 'PAID');
  
  const currentAvgInvoice = currentPaidInvoices.length > 0 
    ? currentPaidInvoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0) / currentPaidInvoices.length
    : 0;
  
  const previousAvgInvoice = previousPaidInvoices.length > 0 
    ? previousPaidInvoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0) / previousPaidInvoices.length
    : 0;
  
  const avgInvoiceChange = previousAvgInvoice > 0 ? ((currentAvgInvoice - previousAvgInvoice) / previousAvgInvoice) * 100 : 0;
  
  return {
    revenue: {
      current: currentRevenue,
      previous: previousRevenue,
      change: revenueChange,
      trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'neutral'
    },
    invoiceCount: {
      current: currentInvoiceCount,
      previous: previousInvoiceCount,
      change: invoiceCountChange,
      trend: invoiceCountChange > 0 ? 'up' : invoiceCountChange < 0 ? 'down' : 'neutral'
    },
    averageInvoiceValue: {
      current: currentAvgInvoice,
      previous: previousAvgInvoice,
      change: avgInvoiceChange,
      trend: avgInvoiceChange > 0 ? 'up' : avgInvoiceChange < 0 ? 'down' : 'neutral'
    }
  };
} 