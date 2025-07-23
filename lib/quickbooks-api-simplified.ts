import { createClient } from '@/utils/supabase/server';

export interface QuickBooksConnection {
  id: string;
  user_id: string;
  company_id: string;
  company_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_at: string;
  last_sync: string | null;
  status: 'active' | 'expired' | 'error';
  qb_data: any;
  current_kpis: any;
}

export class QuickBooksAPISimplified {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Get QuickBooks connection for a user
   */
  async getConnection(userId: string): Promise<QuickBooksConnection | null> {
    const { data, error } = await this.supabase
      .from('quickbooks_data')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Save QuickBooks connection
   */
  async saveConnection(
    userId: string,
    companyId: string,
    companyName: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    const { error } = await this.supabase
      .from('quickbooks_data')
      .upsert({
        user_id: userId,
        company_id: companyId,
        company_name: companyName,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        qb_data: {},
        current_kpis: {}
      }, {
        onConflict: 'user_id,company_id'
      });

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    userId: string,
    companyId: string,
    status: 'active' | 'expired' | 'error'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({ status })
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      throw new Error(`Failed to update connection status: ${error.message}`);
    }
  }

  /**
   * Remove QuickBooks connection
   */
  async removeConnection(userId: string, companyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('quickbooks_data')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      throw new Error(`Failed to remove connection: ${error.message}`);
    }
  }

  /**
   * Store all QuickBooks data as JSON
   */
  async storeQuickBooksData(
    userId: string,
    invoices: any[],
    salesReceipts: any[],
    payments: any[],
    bills: any[],
    expenses: any[],
    estimates: any[]
  ): Promise<void> {
    // Transform data into our simplified JSON structure
    const revenueData = [
      ...invoices.map(inv => ({
        qb_id: inv.Id,
        type: 'invoice',
        customer_id: inv.CustomerRef?.value,
        customer_name: inv.CustomerRef?.name,
        amount: parseFloat(inv.TotalAmt || 0),
        date: inv.TxnDate,
        due_date: inv.DueDate,
        status: this.getInvoiceStatus(inv),
        job_name: inv.CustomerMemo?.value,
        description: inv.PrivateNote,
        qb_created_at: inv.MetaData?.CreateTime,
        qb_updated_at: inv.MetaData?.LastUpdatedTime
      })),
      ...salesReceipts.map(sr => ({
        qb_id: sr.Id,
        type: 'sales_receipt',
        customer_id: sr.CustomerRef?.value,
        customer_name: sr.CustomerRef?.name,
        amount: parseFloat(sr.TotalAmt || 0),
        date: sr.TxnDate,
        status: 'received',
        description: sr.PrivateNote,
        qb_created_at: sr.MetaData?.CreateTime,
        qb_updated_at: sr.MetaData?.LastUpdatedTime
      })),
      ...payments.map(pay => ({
        qb_id: pay.Id,
        type: 'payment',
        customer_id: pay.CustomerRef?.value,
        customer_name: pay.CustomerRef?.name,
        amount: parseFloat(pay.TotalAmt || 0),
        date: pay.TxnDate,
        status: 'received',
        qb_created_at: pay.MetaData?.CreateTime,
        qb_updated_at: pay.MetaData?.LastUpdatedTime
      }))
    ];

    const costData = [
      ...bills.map(bill => ({
        qb_id: bill.Id,
        type: 'bill',
        vendor_id: bill.VendorRef?.value,
        vendor_name: bill.VendorRef?.name,
        amount: parseFloat(bill.TotalAmt || 0),
        date: bill.TxnDate,
        due_date: bill.DueDate,
        category: this.categorizeCost(bill),
        description: bill.PrivateNote,
        qb_created_at: bill.MetaData?.CreateTime,
        qb_updated_at: bill.MetaData?.LastUpdatedTime
      })),
      ...expenses.map(exp => ({
        qb_id: exp.Id,
        type: 'expense',
        vendor_id: exp.EntityRef?.value,
        vendor_name: exp.EntityRef?.name,
        amount: parseFloat(exp.TotalAmt || 0),
        date: exp.TxnDate,
        category: this.categorizeCost(exp),
        description: exp.PrivateNote,
        qb_created_at: exp.MetaData?.CreateTime,
        qb_updated_at: exp.MetaData?.LastUpdatedTime
      }))
    ];

    const estimateData = estimates.map(est => ({
      qb_id: est.Id,
      customer_id: est.CustomerRef?.value,
      customer_name: est.CustomerRef?.name,
      estimate_number: est.DocNumber,
      amount: parseFloat(est.TotalAmt || 0),
      date: est.TxnDate,
      expiry_date: est.ExpirationDate,
      status: est.TxnStatus?.toLowerCase() || 'pending',
      converted_to_invoice: false, // Will be updated during sync
      job_name: est.CustomerMemo?.value,
      description: est.PrivateNote,
      qb_created_at: est.MetaData?.CreateTime,
      qb_updated_at: est.MetaData?.LastUpdatedTime
    }));

    // Store in database as JSON
    const qbData = {
      revenue_data: revenueData,
      cost_data: costData,
      estimates: estimateData,
      last_sync: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({
        qb_data: qbData,
        last_sync: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to store QuickBooks data: ${error.message}`);
    }
  }

  /**
   * Get stored QuickBooks data for a user
   */
  async getStoredData(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('quickbooks_data')
      .select('qb_data')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return { revenue_data: [], cost_data: [], estimates: [] };
    }

    return data.qb_data || { revenue_data: [], cost_data: [], estimates: [] };
  }

  /**
   * Store calculated KPIs
   */
  async storeKPIs(userId: string, period: string, kpis: any): Promise<void> {
    const { data: currentData } = await this.supabase
      .from('quickbooks_data')
      .select('current_kpis')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const currentKPIs = currentData?.current_kpis || {};
    currentKPIs[period] = {
      ...kpis,
      calculated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('quickbooks_data')
      .update({ current_kpis: currentKPIs })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to store KPIs: ${error.message}`);
    }
  }

  /**
   * Get stored KPIs for a user
   */
  async getStoredKPIs(userId: string, period?: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('quickbooks_data')
      .select('current_kpis')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return {};
    }

    if (period) {
      return data.current_kpis?.[period] || {};
    }

    return data.current_kpis || {};
  }

  /**
   * Make request to QuickBooks API
   */
  async makeQBRequest(accessToken: string, companyId: string, endpoint: string): Promise<any> {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://quickbooks-api.intuit.com' 
      : 'https://sandbox-quickbooks.intuit.com';

    const response = await fetch(`${baseUrl}/v3/company/${companyId}/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse || data;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    return response.json();
  }

  /**
   * Sync KPI-focused data for a user with incremental updates
   */
  async syncKPIData(userId: string, forceFullSync: boolean = false): Promise<void> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      throw new Error('No active QuickBooks connection found');
    }

    const { access_token, company_id, last_sync } = connection;
    const isIncrementalSync = !forceFullSync && last_sync;

    try {
      let syncStartTime: Date;
      
      if (isIncrementalSync) {
        syncStartTime = new Date(last_sync);
        console.log(`Starting incremental sync from ${syncStartTime.toISOString()}...`);
      } else {
        syncStartTime = new Date('2000-01-01');
        console.log('Starting full sync of all KPI data...');
      }

      // Fetch all required data from QuickBooks
      console.log('Fetching QuickBooks data...');
      const [invoices, salesReceipts, payments, bills, expenses, estimates] = await Promise.all([
        this.getInvoices(access_token, company_id, syncStartTime),
        this.getSalesReceipts(access_token, company_id, syncStartTime),
        this.getPayments(access_token, company_id, syncStartTime),
        this.getBills(access_token, company_id, syncStartTime),
        this.getExpenses(access_token, company_id, syncStartTime),
        this.getEstimates(access_token, company_id, syncStartTime)
      ]);

      // Store all data as JSON
      await this.storeQuickBooksData(
        userId,
        invoices,
        salesReceipts,
        payments,
        bills,
        expenses,
        estimates
      );

      const syncType = isIncrementalSync ? 'Incremental' : 'Full';
      console.log(`${syncType} KPI data sync completed successfully`);
      
    } catch (error) {
      console.error('Error during KPI data sync:', error);
      throw error;
    }
  }

  // Simplified fetch methods
  async getInvoices(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM Invoice";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.Invoice || [];
  }

  async getSalesReceipts(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM SalesReceipt";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.SalesReceipt || [];
  }

  async getPayments(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM Payment";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.Payment || [];
  }

  async getBills(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM Bill";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.Bill || [];
  }

  async getExpenses(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM Purchase WHERE PaymentType='Cash'";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` AND MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.Purchase || [];
  }

  async getEstimates(accessToken: string, companyId: string, since?: Date): Promise<any[]> {
    let query = "SELECT * FROM Estimate";
    if (since) {
      const sinceStr = since.toISOString().split('T')[0];
      query += ` WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`;
    }
    const response = await this.makeQBRequest(accessToken, companyId, `query?query=${encodeURIComponent(query)}`);
    return response?.Estimate || [];
  }

  // Helper methods
  private getInvoiceStatus(invoice: any): string {
    if (invoice.Balance === 0 || invoice.Balance === '0') {
      return 'paid';
    }
    if (invoice.DueDate && new Date(invoice.DueDate) < new Date()) {
      return 'overdue';
    }
    return 'pending';
  }

  private categorizeCost(transaction: any): string {
    const description = (transaction.PrivateNote || '').toLowerCase();
    if (description.includes('material') || description.includes('supply')) {
      return 'materials';
    }
    if (description.includes('labor') || description.includes('wage')) {
      return 'labor';
    }
    if (description.includes('overhead') || description.includes('rent') || description.includes('utility')) {
      return 'overhead';
    }
    return 'other';
  }
}